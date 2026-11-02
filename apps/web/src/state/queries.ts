import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DayLog, Profile } from "@tailor/core";
import { useServices } from "./AppContext";
import type { SavedFood, Snapshot } from "../platform/store";

export const SNAPSHOT_KEY = ["snapshot"] as const;

/**
 * Server state: everything saved, loaded once and kept fresh by the store's live subscription
 * (another device saving pushes straight into the TanStack Query cache).
 */
export function useSnapshot() {
  const { store } = useServices();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: SNAPSHOT_KEY, queryFn: () => store.load() });
  useEffect(() => store.subscribe((s) => qc.setQueryData(SNAPSHOT_KEY, s)), [store, qc]);
  return q;
}

/** Optimistic write: update the cache immediately, save, and roll back if the save fails. */
function useDocMutation<V>(toDoc: (v: V) => { id: string; data: unknown }, apply: (s: Snapshot, v: V) => void) {
  const { store } = useServices();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: V) => { const d = toDoc(v); await store.save(d.id, d.data); },
    onMutate: async (v: V) => {
      await qc.cancelQueries({ queryKey: SNAPSHOT_KEY });
      const prev = qc.getQueryData<Snapshot>(SNAPSHOT_KEY);
      if (prev) { const next = structuredClone(prev); apply(next, v); qc.setQueryData(SNAPSHOT_KEY, next); }
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) qc.setQueryData(SNAPSHOT_KEY, ctx.prev); },
  });
}

export const useSaveDay = () =>
  useDocMutation<{ date: string; day: DayLog }>((v) => ({ id: "day-" + v.date, data: v.day }), (s, v) => { s.days[v.date] = v.day; });

export const useSaveProfile = () =>
  useDocMutation<Profile>((p) => ({ id: "profile", data: p }), (s, p) => { s.profile = p; });

export const useSaveFood = () =>
  useDocMutation<SavedFood>((f) => ({ id: "food-" + f.id, data: f }), (s, f) => { s.foods[f.id] = f; });
