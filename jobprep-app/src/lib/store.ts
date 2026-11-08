"use client";

import { useSyncExternalStore } from "react";
import type { AppState, ExamRecord } from "./types";

const KEY = "jobprep:v1";
const MAX_EXAMS = 200;

const EMPTY: AppState = {
  v: 1,
  bookId: null,
  selectedTopics: [],
  stats: {},
  exams: [],
  activeExamId: null,
};

let cache: AppState | null = null;
const listeners = new Set<() => void>();

function load(): AppState {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...(JSON.parse(raw) as AppState) } : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function persist(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: keep working in memory for this session.
  }
}

export function getState(): AppState {
  return load();
}

export function setState(update: (s: AppState) => AppState) {
  const next = update(load());
  if (next.exams.length > MAX_EXAMS) {
    next.exams = next.exams.slice(next.exams.length - MAX_EXAMS);
  }
  cache = next;
  persist(next);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

export function saveExam(exam: ExamRecord) {
  setState((s) => {
    const i = s.exams.findIndex((e) => e.id === exam.id);
    const exams = [...s.exams];
    if (i >= 0) exams[i] = exam;
    else exams.push(exam);
    return { ...s, exams };
  });
}

export function findExam(state: AppState, id: string | null | undefined): ExamRecord | undefined {
  if (!id) return undefined;
  return state.exams.find((e) => e.id === id);
}

export function resetAll() {
  setState(() => EMPTY);
}
