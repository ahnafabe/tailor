/** Minimal typing of the Claude artifact runtime (window.claude) that the adapters use. */
export interface ClaudeDocSnapshot { id: string; data(): Record<string, unknown> | undefined }
export interface ClaudeQuerySnapshot { docs: ClaudeDocSnapshot[] }
export interface ClaudeCollection {
  doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> };
  onSnapshot(next: (s: ClaudeQuerySnapshot) => void, err?: (e: unknown) => void): () => void;
}
export interface ClaudeDb { collection(path: string): ClaudeCollection }
export interface ClaudeUser { id(): Promise<string | null> }
export interface ClaudeSample {
  (input: string, opts?: Record<string, unknown>): Promise<{ text: string }>;
  json<T = unknown>(input: string, opts?: Record<string, unknown>): Promise<T>;
  limits(): Promise<{ images?: unknown }>;
}
export interface ClaudeRuntime { use(name: string): Promise<unknown> }

declare global {
  interface Window { claude?: ClaudeRuntime }
}
