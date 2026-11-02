import type { AppState, DayLog, FoodItem, Profile, Workout } from "@tailor/core";
import type { ClaudeCollection, ClaudeDb, ClaudeUser } from "./runtime";
import { DEFAULT_PROFILE } from "../data/defaults";

/** Everything the app has saved. Document ids match the original single-page app, so existing data loads as-is. */
export interface Snapshot extends AppState {
  foods: Record<string, SavedFood>;
  moments: Record<string, unknown>;
  other: Record<string, unknown>; // photos, measurements, wrist checks: kept and passed through untouched
}
export interface SavedFood extends Omit<FoodItem, "q"> { id: string; barcode?: string | null; used?: number }

export const emptySnapshot = (): Snapshot => ({ profile: { ...DEFAULT_PROFILE }, days: {}, wos: {}, foods: {}, moments: {}, other: {} });

/** Applies one stored document to a snapshot (mirrors the original app's ingest()). */
export function applyDoc(s: Snapshot, id: string, raw: unknown): void {
  if (!raw) return;
  const v = JSON.parse(JSON.stringify(raw)); // synced docs can be read-only; keep an editable copy
  if (id === "profile") s.profile = { ...s.profile, ...(v as Partial<Profile>) };
  else if (id.startsWith("day-")) s.days[id.slice(4)] = v as DayLog;
  else if (id.startsWith("wo-")) s.wos[id.slice(3)] = v as Workout;
  else if (id.startsWith("food-")) s.foods[id.slice(5)] = v as SavedFood;
  else if (id.startsWith("moment-")) s.moments[id] = v;
  else s.other[id] = v;
}

/** The app talks to this interface only. Today: ClaudeArtifactStore. Later: an ApiStore backed by Express + MongoDB. */
export interface Store {
  load(): Promise<Snapshot>;
  subscribe(onChange: (s: Snapshot) => void): () => void;
  save(id: string, data: unknown): Promise<void>;
  remove(id: string): Promise<void>;
  readonly mode: "synced" | "local";
}

const LS_KEY = "afit"; // same key as the original app

function readLocal(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch { return {}; }
}
function writeLocal(id: string, v: unknown | null) {
  try {
    const all = readLocal();
    if (v === null) delete all[id]; else all[id] = v;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch { /* storage can be unavailable; synced store is the source of truth */ }
}
const fromDocs = (docs: Array<[string, unknown]>) => { const s = emptySnapshot(); docs.forEach(([id, v]) => applyDoc(s, id, v)); return s; };

/** Claude artifact database, private per user under data/users/<id>. Falls back to this browser only. */
export class ClaudeArtifactStore implements Store {
  private coll: ClaudeCollection | null = null;
  private latest: Snapshot | null = null;
  mode: "synced" | "local" = "local";

  async init(): Promise<void> {
    const rt = window.claude;
    if (!rt?.use) return;
    try {
      const [db, user] = (await Promise.all([rt.use("db"), rt.use("user")])) as [ClaudeDb | null, ClaudeUser | null];
      const uid = db && user ? await user.id() : null;
      if (db && uid) { this.coll = db.collection("data/users/" + uid); this.mode = "synced"; }
    } catch { /* stay local */ }
  }

  async load(): Promise<Snapshot> {
    if (!this.coll) return (this.latest = fromDocs(Object.entries(readLocal())));
    const coll = this.coll;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(fromDocs(Object.entries(readLocal()))), 10000);
      const off = coll.onSnapshot((snap) => {
        clearTimeout(timer); off();
        resolve((this.latest = fromDocs(snap.docs.map((d) => [d.id, d.data()]))));
      }, () => { clearTimeout(timer); resolve(fromDocs(Object.entries(readLocal()))); });
    });
  }

  subscribe(onChange: (s: Snapshot) => void): () => void {
    if (!this.coll) return () => {};
    return this.coll.onSnapshot((snap) => onChange((this.latest = fromDocs(snap.docs.map((d) => [d.id, d.data()])))));
  }

  async save(id: string, data: unknown): Promise<void> {
    writeLocal(id, data);
    if (this.coll) await this.coll.doc(id).set(JSON.parse(JSON.stringify(data)));
  }

  async remove(id: string): Promise<void> {
    writeLocal(id, null);
    if (this.coll) await this.coll.doc(id).delete();
  }
}

/** In-memory store for tests and previews. */
export class MemoryStore implements Store {
  mode = "local" as const;
  private docs = new Map<string, unknown>();
  private subs = new Set<(s: Snapshot) => void>();
  constructor(seed: Record<string, unknown> = {}) { Object.entries(seed).forEach(([k, v]) => this.docs.set(k, v)); }
  private snap() { return fromDocs([...this.docs.entries()]); }
  async load() { return this.snap(); }
  subscribe(cb: (s: Snapshot) => void) { this.subs.add(cb); return () => { this.subs.delete(cb); }; }
  async save(id: string, data: unknown) { this.docs.set(id, JSON.parse(JSON.stringify(data))); this.subs.forEach((cb) => cb(this.snap())); }
  async remove(id: string) { this.docs.delete(id); this.subs.forEach((cb) => cb(this.snap())); }
  get(id: string) { return this.docs.get(id); }
}
