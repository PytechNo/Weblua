import type {
  InternalLuauWasmModule as InternalLuauWasmModuleType,
  LuauEnv,
  LuauFunction
} from "luau-web";
import AsyncifyWasmModule from "luau-web/src/lib/Luau.Web.Asyncify.js";

type RuntimeState = {
  luaValueCache: Map<number, object>;
  jsValueCache: Map<number, object>;
  jsValueReverse: Map<object, number>;
  transactionData: unknown[];
  nextJSRef: number;
  nextTXKey: number;
  env: LuauEnv;
};

type LuauRuntime = Omit<InternalLuauWasmModuleType, "states"> & {
  _makeLuaState(envId: number): number | Promise<number>;
  _getLuaValue(state: number, idx: number): number;
  _luauLoad(state: number, sourceTransaction: number, chunkTransaction: number): number;
  _luauClose(state: number): void;
  luauToJsValue(stateIdx: number, state: number, value: unknown): unknown;
  states: Array<Partial<RuntimeState> | null>;
};

const Luau = {
  LUA_VALUE: Symbol("LuaValue"),
  JS_VALUE: Symbol("JsValue"),
  JS_MUTABLE: Symbol("JsMutable"),
  securityTransmitList: new Map(),
  options: new Map([["LUA_IMPLICIT_ARRAYS_TO_JS_ARRAYS", true]]),
  states: []
} as unknown as LuauRuntime;

let initialized = false;
let initPromise: Promise<boolean> | null = null;

// luau-web@1.4.0 auto-selects JSPI in modern browsers, but that build does not
// catch Luau runtime errors inside pcall/xpcall. The Asyncify bundle does.
async function ensureInitialized(): Promise<boolean> {
  if (initPromise) return initPromise;
  if (initialized) return true;

  initPromise = (async () => {
    const moduleInstance = await AsyncifyWasmModule(Luau);
    Object.assign(Luau, moduleInstance);
    initialized = true;
    return true;
  })();

  return initPromise;
}

class CompileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompileError";
  }
}

function Mutable<T extends object>(object: T): Map<keyof T, T[keyof T]> & T {
  const map =
    object instanceof Map
      ? (object as Map<PropertyKey, unknown>)
      : new Map<PropertyKey, unknown>(Object.entries(object));

  map.set(Luau.JS_MUTABLE, true);

  const proxy = new Proxy(map, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") return value.bind(target);
      if (target.has(prop)) return target.get(prop);
      return value;
    },
    set(target, prop, value) {
      target.set(prop, value);
      return true;
    },
    getPrototypeOf() {
      return Map.prototype;
    }
  });

  return proxy as Map<keyof T, T[keyof T]> & T;
}

class LuauState {
  destroyed = false;
  env!: LuauEnv;
  state = 0;
  stateIdx: number;

  static async createAsync(initialEnv?: Record<string, unknown>): Promise<LuauState> {
    await ensureInitialized();

    const instance = new LuauState();
    instance.state = await Luau._makeLuaState(instance.stateIdx);
    instance.env = Luau.states[instance.stateIdx]?.env as LuauEnv;

    if (initialEnv) {
      for (const [key, value] of Object.entries(initialEnv)) {
        if (!instance.env.set(key, value, true)) {
          Luau.fprintwarn(`illegal state: lua globals key ${key} wasn't set`);
        }
      }
    }

    return instance;
  }

  constructor() {
    if (!initialized) {
      throw new Error("Luau not initialized. Use LuauState.createAsync() instead of new LuauState()");
    }

    Luau.states = Luau.states || [];
    this.stateIdx = Luau.states.length + 1;
    Luau.states[this.stateIdx] = {
      luaValueCache: new Map(),
      jsValueCache: new Map(),
      jsValueReverse: new Map(),
      transactionData: [],
      nextJSRef: -1,
      nextTXKey: 0
    };
  }

  getValue(idx: number): unknown {
    if (this.destroyed) {
      throw new Luau.GlueError("Cannot use destroyed Luau state");
    }

    const transactionId = Luau._getLuaValue(this.state, idx);
    let luauValue: unknown = null;

    try {
      luauValue = JSON.parse(
        String(Luau.states[this.stateIdx]?.transactionData?.[transactionId])
      );
    } catch {
      // Keep null for non-JSON transaction data, matching luau-web's wrapper.
    }

    return Luau.luauToJsValue(this.stateIdx, this.state, luauValue);
  }

  makeTransaction(value: unknown): number {
    if (this.destroyed) {
      throw new Luau.GlueError("Cannot use destroyed Luau state");
    }

    const state = Luau.states[this.stateIdx];
    if (!state?.transactionData) {
      throw new Luau.GlueError("Cannot use uninitialized Luau state");
    }

    const idx = state.nextTXKey ?? 0;
    state.nextTXKey = idx + 1;
    state.transactionData[idx] = value;

    return idx;
  }

  loadstring(source: string, chunkname: string, throwOnCompilationError: true): LuauFunction;
  loadstring(
    source: string,
    chunkname?: string,
    throwOnCompilationError?: boolean
  ): LuauFunction | string;
  loadstring(
    source: string,
    chunkname = "LuauWeb",
    throwOnCompilationError = false
  ): LuauFunction | string {
    if (this.destroyed) {
      throw new Luau.GlueError("Cannot use destroyed Luau state");
    }

    const loadStatus = Luau._luauLoad(
      this.state,
      this.makeTransaction(source),
      this.makeTransaction(chunkname)
    );

    if (loadStatus !== 0) {
      const error = String(this.getValue(-1));
      if (throwOnCompilationError) {
        throw new CompileError(error);
      }
      return error;
    }

    return this.getValue(-1) as LuauFunction;
  }

  destroy(): void {
    if (this.destroyed) {
      throw new Luau.GlueError("Cannot use destroyed Luau state");
    }

    this.destroyed = true;
    Luau.states[this.stateIdx] = null;
    Luau._luauClose(this.state);
  }
}

export { CompileError, Luau as InternalLuauWasmModule, LuauState, Mutable };
