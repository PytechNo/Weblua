import { isNormalizedProjectPath, validateProjectPayload } from "./project";
import type { ProjectPayload, Workspace } from "./types";

/**
 * A project saved in the local library. `workspace.activeProjectId` always
 * matches `id`, so callers can open `record.workspace` directly.
 */
export interface StoredWorkspaceProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  workspace: Workspace;
}

export type WorkspaceStoreMode = "indexeddb" | "memory";

export interface WorkspaceStore {
  /** The currently selected persistence backend. */
  readonly mode: WorkspaceStoreMode;

  getDraft(): Promise<Workspace | null>;
  saveDraft(workspace: Workspace): Promise<boolean>;
  clearDraft(): Promise<boolean>;

  listProjects(): Promise<StoredWorkspaceProject[]>;
  getProject(id: string): Promise<StoredWorkspaceProject | null>;
  createProject(name: string, workspace: Workspace): Promise<StoredWorkspaceProject | null>;
  updateProject(id: string, workspace: Workspace): Promise<StoredWorkspaceProject | null>;
  renameProject(id: string, name: string): Promise<StoredWorkspaceProject | null>;
  deleteProject(id: string): Promise<boolean>;

  /**
   * Persist the recovery draft and, when the workspace belongs to a named
   * project, update that project too. This is the intended debounced autosave
   * entry point for the editor.
   */
  saveWorkspace(workspace: Workspace): Promise<boolean>;
}

export interface WorkspaceStoreOptions {
  /** Override IndexedDB for tests or alternate browser contexts. `null` forces memory. */
  indexedDB?: IDBFactory | null;
  /** A distinct name is useful for tests and lets future app versions migrate cleanly. */
  dbName?: string;
  /** Test hook for deterministic timestamps. */
  now?: () => number;
  /** Test hook for deterministic project IDs. */
  createId?: () => string;
  /** Explicitly opt into the non-persistent backend, primarily for tests. */
  memoryOnly?: boolean;
}

const DATABASE_NAME = "weblua-workspace";
const DATABASE_VERSION = 1;
const DRAFT_STORE = "drafts";
const PROJECT_STORE = "projects";
const DRAFT_KEY = "recovery";
const FALLBACK_PROJECT_NAME = "Untitled project";
interface DraftRecord {
  key: typeof DRAFT_KEY;
  workspace: Workspace;
}

interface WorkspaceBackend {
  getDraft(): Promise<Workspace | null>;
  putDraft(workspace: Workspace): Promise<void>;
  deleteDraft(): Promise<void>;
  getProjects(): Promise<StoredWorkspaceProject[]>;
  getProject(id: string): Promise<StoredWorkspaceProject | null>;
  putProject(project: StoredWorkspaceProject): Promise<void>;
  deleteProject(id: string): Promise<void>;
}

/**
 * Creates the browser-only workspace persistence service. IndexedDB is used
 * whenever it can be opened; unavailable or failing browser storage falls
 * back to an in-memory store so an editor session never crashes on save.
 */
export function createWorkspaceStore(options: WorkspaceStoreOptions = {}): WorkspaceStore {
  return new BrowserWorkspaceStore(options);
}

/** A convenient isolated store for unit tests and non-persistent embeds. */
export function createMemoryWorkspaceStore(
  options: Omit<WorkspaceStoreOptions, "indexedDB" | "memoryOnly"> = {}
): WorkspaceStore {
  return createWorkspaceStore({ ...options, indexedDB: null, memoryOnly: true });
}

class BrowserWorkspaceStore implements WorkspaceStore {
  private readonly memory = new MemoryWorkspaceBackend();
  private readonly indexedDB: IDBFactory | null | undefined;
  private readonly dbName: string;
  private readonly now: () => number;
  private readonly createId: () => string;
  private backend: WorkspaceBackend | null = null;
  private backendPromise: Promise<WorkspaceBackend> | null = null;
  private currentMode: WorkspaceStoreMode;

  constructor(options: WorkspaceStoreOptions) {
    this.indexedDB = options.memoryOnly
      ? null
      : options.indexedDB === undefined
        ? globalIndexedDB()
        : options.indexedDB;
    this.dbName = options.dbName ?? DATABASE_NAME;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? makeProjectId;
    this.currentMode = this.indexedDB ? "indexeddb" : "memory";
  }

  get mode(): WorkspaceStoreMode {
    return this.currentMode;
  }

  async getDraft(): Promise<Workspace | null> {
    return this.safely((backend) => backend.getDraft(), null).then(cloneWorkspace);
  }

  async saveDraft(workspace: Workspace): Promise<boolean> {
    const copy = cloneWorkspace(workspace);
    if (!copy) return false;

    return this.safely(async (backend) => {
      await backend.putDraft(copy);
      return true;
    }, false);
  }

  async clearDraft(): Promise<boolean> {
    return this.safely(async (backend) => {
      await backend.deleteDraft();
      return true;
    }, false);
  }

  async listProjects(): Promise<StoredWorkspaceProject[]> {
    const projects = await this.safely((backend) => backend.getProjects(), []);
    return projects
      .map(cloneStoredProject)
      .filter((project): project is StoredWorkspaceProject => project !== null)
      .sort(compareProjects);
  }

  async getProject(id: string): Promise<StoredWorkspaceProject | null> {
    if (!isNonEmptyString(id)) return null;
    const project = await this.safely((backend) => backend.getProject(id), null);
    return cloneStoredProject(project);
  }

  async createProject(name: string, workspace: Workspace): Promise<StoredWorkspaceProject | null> {
    const normalizedName = normalizeProjectName(name);
    const workspaceCopy = cloneWorkspace(workspace);
    if (!workspaceCopy) return null;

    return this.safely(async (backend) => {
      const id = await this.reserveProjectId(backend);
      if (!id) return null;

      const timestamp = this.now();
      const project = makeStoredProject(id, normalizedName, timestamp, timestamp, workspaceCopy);
      if (!project) return null;

      await backend.putProject(project);
      return cloneStoredProject(project);
    }, null);
  }

  async updateProject(id: string, workspace: Workspace): Promise<StoredWorkspaceProject | null> {
    if (!isNonEmptyString(id)) return null;
    const workspaceCopy = cloneWorkspace(workspace);
    if (!workspaceCopy) return null;

    return this.safely(async (backend) => {
      const existing = await backend.getProject(id);
      if (!existing) return null;

      const project = makeStoredProject(
        existing.id,
        existing.name,
        existing.createdAt,
        this.now(),
        workspaceCopy
      );
      if (!project) return null;

      await backend.putProject(project);
      return cloneStoredProject(project);
    }, null);
  }

  async renameProject(id: string, name: string): Promise<StoredWorkspaceProject | null> {
    if (!isNonEmptyString(id)) return null;

    return this.safely(async (backend) => {
      const existing = await backend.getProject(id);
      if (!existing) return null;

      const project = cloneStoredProject({
        ...existing,
        name: normalizeProjectName(name),
        updatedAt: this.now()
      });
      if (!project) return null;

      await backend.putProject(project);
      return cloneStoredProject(project);
    }, null);
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!isNonEmptyString(id)) return false;

    return this.safely(async (backend) => {
      const existing = await backend.getProject(id);
      if (!existing) return false;
      await backend.deleteProject(id);
      return true;
    }, false);
  }

  async saveWorkspace(workspace: Workspace): Promise<boolean> {
    const draftSaved = await this.saveDraft(workspace);
    if (!draftSaved || !workspace.activeProjectId) return draftSaved;
    return (await this.updateProject(workspace.activeProjectId, workspace)) !== null;
  }

  private async reserveProjectId(backend: WorkspaceBackend): Promise<string | null> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const id = this.createId();
      if (!isNonEmptyString(id)) continue;
      if (!(await backend.getProject(id))) return id;
    }
    return null;
  }

  private async resolveBackend(): Promise<WorkspaceBackend> {
    if (this.backend) return this.backend;
    if (this.backendPromise) return this.backendPromise;

    this.backendPromise = (async () => {
      if (!this.indexedDB) return this.useMemoryBackend();

      try {
        const indexedBackend = new IndexedDbWorkspaceBackend(this.indexedDB, this.dbName);
        await indexedBackend.ready();
        this.backend = indexedBackend;
        this.currentMode = "indexeddb";
        return indexedBackend;
      } catch {
        return this.useMemoryBackend();
      }
    })();

    return this.backendPromise;
  }

  private useMemoryBackend(): WorkspaceBackend {
    this.backend = this.memory;
    this.currentMode = "memory";
    return this.memory;
  }

  private async safely<T>(operation: (backend: WorkspaceBackend) => Promise<T>, fallback: T): Promise<T> {
    const backend = await this.resolveBackend();

    try {
      return await operation(backend);
    } catch {
      if (backend === this.memory) return fallback;

      try {
        return await operation(this.useMemoryBackend());
      } catch {
        return fallback;
      }
    }
  }
}

class MemoryWorkspaceBackend implements WorkspaceBackend {
  private draft: Workspace | null = null;
  private readonly projects = new Map<string, StoredWorkspaceProject>();

  async getDraft(): Promise<Workspace | null> {
    return cloneWorkspace(this.draft);
  }

  async putDraft(workspace: Workspace): Promise<void> {
    this.draft = cloneWorkspace(workspace);
  }

  async deleteDraft(): Promise<void> {
    this.draft = null;
  }

  async getProjects(): Promise<StoredWorkspaceProject[]> {
    return [...this.projects.values()].map(cloneStoredProject).filter(isStoredProject);
  }

  async getProject(id: string): Promise<StoredWorkspaceProject | null> {
    return cloneStoredProject(this.projects.get(id));
  }

  async putProject(project: StoredWorkspaceProject): Promise<void> {
    const copy = cloneStoredProject(project);
    if (!copy) throw new TypeError("Cannot persist an invalid workspace project.");
    this.projects.set(copy.id, copy);
  }

  async deleteProject(id: string): Promise<void> {
    this.projects.delete(id);
  }
}

class IndexedDbWorkspaceBackend implements WorkspaceBackend {
  private readonly database: Promise<IDBDatabase>;

  constructor(indexedDB: IDBFactory, name: string) {
    this.database = openDatabase(indexedDB, name);
  }

  async ready(): Promise<void> {
    await this.database;
  }

  async getDraft(): Promise<Workspace | null> {
    const database = await this.database;
    const transaction = database.transaction(DRAFT_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const request = transaction.objectStore(DRAFT_STORE).get(DRAFT_KEY);
    const record = await requestResult<DraftRecord | undefined>(request);
    await complete;
    return record?.workspace ?? null;
  }

  async putDraft(workspace: Workspace): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(DRAFT_STORE).put({ key: DRAFT_KEY, workspace } satisfies DraftRecord);
    await complete;
  }

  async deleteDraft(): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(DRAFT_STORE, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(DRAFT_STORE).delete(DRAFT_KEY);
    await complete;
  }

  async getProjects(): Promise<StoredWorkspaceProject[]> {
    const database = await this.database;
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const request = transaction.objectStore(PROJECT_STORE).getAll();
    const projects = await requestResult<StoredWorkspaceProject[]>(request);
    await complete;
    return projects;
  }

  async getProject(id: string): Promise<StoredWorkspaceProject | null> {
    const database = await this.database;
    const transaction = database.transaction(PROJECT_STORE, "readonly");
    const complete = transactionComplete(transaction);
    const request = transaction.objectStore(PROJECT_STORE).get(id);
    const project = await requestResult<StoredWorkspaceProject | undefined>(request);
    await complete;
    return project ?? null;
  }

  async putProject(project: StoredWorkspaceProject): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(PROJECT_STORE).put(project);
    await complete;
  }

  async deleteProject(id: string): Promise<void> {
    const database = await this.database;
    const transaction = database.transaction(PROJECT_STORE, "readwrite");
    const complete = transactionComplete(transaction);
    transaction.objectStore(PROJECT_STORE).delete(id);
    await complete;
  }
}

function globalIndexedDB(): IDBFactory | undefined {
  return typeof globalThis !== "undefined" ? globalThis.indexedDB : undefined;
}

function openDatabase(indexedDB: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(name, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DRAFT_STORE)) {
        database.createObjectStore(DRAFT_STORE, { keyPath: "key" });
      }
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open workspace storage."));
    request.onblocked = () => reject(new Error("Workspace storage is blocked by another tab."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

function makeStoredProject(
  id: string,
  name: string,
  createdAt: number,
  updatedAt: number,
  workspace: Workspace
): StoredWorkspaceProject | null {
  const copy = cloneWorkspace(workspace);
  if (!copy) return null;
  copy.activeProjectId = id;

  return {
    id,
    name,
    createdAt,
    updatedAt,
    workspace: copy
  };
}

function cloneStoredProject(value: unknown): StoredWorkspaceProject | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.name) ||
    typeof value.createdAt !== "number" ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== "number" ||
    !Number.isFinite(value.updatedAt)
  ) {
    return null;
  }

  const workspace = cloneWorkspace(value.workspace);
  if (!workspace) return null;
  workspace.activeProjectId = value.id;

  return {
    id: value.id,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    workspace
  };
}

function cloneWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value) || typeof value.activeFile !== "string" || typeof value.stdin !== "string") {
    return null;
  }

  const project = cloneProject(value.project);
  if (!project || !isNormalizedProjectPath(value.activeFile) || !hasOwn(project.files, value.activeFile)) {
    return null;
  }

  if (value.activeProjectId !== undefined && !isNonEmptyString(value.activeProjectId)) return null;

  const workspace: Workspace = {
    project,
    activeFile: value.activeFile,
    stdin: value.stdin
  };
  if (value.activeProjectId !== undefined) workspace.activeProjectId = value.activeProjectId;
  return workspace;
}

function cloneProject(value: unknown): ProjectPayload | null {
  return validateProjectPayload(value);
}

function normalizeProjectName(value: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : FALLBACK_PROJECT_NAME;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(value: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isStoredProject(value: StoredWorkspaceProject | null): value is StoredWorkspaceProject {
  return value !== null;
}

function compareProjects(a: StoredWorkspaceProject, b: StoredWorkspaceProject): number {
  return b.updatedAt - a.updatedAt || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
}

function makeProjectId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const random = Math.random().toString(36).slice(2);
  return `project-${Date.now().toString(36)}-${random}`;
}

/** The normal app store. It stays entirely in the browser and performs no network I/O. */
export const workspaceStore = createWorkspaceStore();
