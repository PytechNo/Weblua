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

const LUA_VALUE = Symbol("LuaValue");
const JS_VALUE = Symbol("JsValue");
const JS_MUTABLE = Symbol("JsMutable");

function createRuntimeSeed(): LuauRuntime {
  return {
    LUA_VALUE,
    JS_VALUE,
    JS_MUTABLE,
    securityTransmitList: new Map(),
    options: new Map([["LUA_IMPLICIT_ARRAYS_TO_JS_ARRAYS", true]]),
    states: []
  } as unknown as LuauRuntime;
}

async function createRuntime(): Promise<LuauRuntime> {
  const runtime = createRuntimeSeed();
  const moduleInstance = await AsyncifyWasmModule(runtime);
  Object.assign(runtime, moduleInstance);
  return runtime;
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

  map.set(JS_MUTABLE, true);

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
  private readonly runtime: LuauRuntime;
  state = 0;
  stateIdx: number;

  static async createAsync(initialEnv?: Record<string, unknown>): Promise<LuauState> {
    // luau-web@1.4.0 leaves native maps keyed by lua_State* populated when a
    // state closes. Reusing that WebAssembly instance lets a newly allocated
    // state inherit stale registry references when its pointer is recycled.
    // Keep each state in an isolated instance until upstream teardown clears
    // those maps. This costs initialization time but permits safe worker reuse
    // and still releases the complete instance after destroy/garbage collection.
    const runtime = await createRuntime();
    const instance = new LuauState(runtime);
    instance.state = await runtime._makeLuaState(instance.stateIdx);
    instance.env = runtime.states[instance.stateIdx]?.env as LuauEnv;

    if (initialEnv) {
      for (const [key, value] of Object.entries(initialEnv)) {
        if (!instance.env.set(key, value, true)) {
          runtime.fprintwarn(`illegal state: lua globals key ${key} wasn't set`);
        }
      }
    }

    return instance;
  }

  constructor(runtime?: LuauRuntime) {
    if (!runtime) {
      throw new Error("Luau not initialized. Use LuauState.createAsync() instead of new LuauState()");
    }

    this.runtime = runtime;
    runtime.states = runtime.states || [];
    this.stateIdx = runtime.states.length + 1;
    runtime.states[this.stateIdx] = {
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
      throw new this.runtime.GlueError("Cannot use destroyed Luau state");
    }

    const transactionId = this.runtime._getLuaValue(this.state, idx);
    let luauValue: unknown = null;

    try {
      luauValue = JSON.parse(
        String(this.runtime.states[this.stateIdx]?.transactionData?.[transactionId])
      );
    } catch {
      // Keep null for non-JSON transaction data, matching luau-web's wrapper.
    }

    return this.runtime.luauToJsValue(this.stateIdx, this.state, luauValue);
  }

  makeTransaction(value: unknown): number {
    if (this.destroyed) {
      throw new this.runtime.GlueError("Cannot use destroyed Luau state");
    }

    const state = this.runtime.states[this.stateIdx];
    if (!state?.transactionData) {
      throw new this.runtime.GlueError("Cannot use uninitialized Luau state");
    }

    const idx = state.nextTXKey ?? 0;
    state.nextTXKey = idx + 1;
    state.transactionData[idx] = value;

    return idx;
  }

  setOutputHandlers(
    info: (...args: unknown[]) => void,
    warn: (...args: unknown[]) => void = info,
    error: (...args: unknown[]) => void = warn
  ): void {
    if (this.destroyed) {
      throw new this.runtime.GlueError("Cannot use destroyed Luau state");
    }

    this.runtime.fprint = info;
    this.runtime.fprintwarn = warn;
    this.runtime.fprinterr = error;
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
      throw new this.runtime.GlueError("Cannot use destroyed Luau state");
    }

    const loadStatus = this.runtime._luauLoad(
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
      throw new this.runtime.GlueError("Cannot use destroyed Luau state");
    }

    this.destroyed = true;
    this.runtime.states[this.stateIdx] = null;
    this.runtime._luauClose(this.state);
  }
}

export { CompileError, LuauState, Mutable };
