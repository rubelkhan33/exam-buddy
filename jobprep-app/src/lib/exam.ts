import type {
  AppState,
  AttemptResult,
  ExamItem,
  ExamRecord,
  ExamScore,
  ItemKind,
  Question,
  QuestionStat,
} from "./types";

export const EXAM_SIZE = 100;
export const MIX = { new: 70, wrong: 25, repeat: 5 } as const;
/** 100 questions = 60 minutes */
export const SECONDS_PER_QUESTION = 36;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Priority order: BCS repeated (more times first) → BCS once → PSC → Bank → other.
 * Questions with equal rank are shuffled so each exam feels fresh.
 */
export function byPriority(questions: Question[]): Question[] {
  return shuffle(questions).sort(
    (a, b) => a.priority - b.priority || b.bcs_count - a.bcs_count,
  );
}

export interface ExamPlan {
  total: number;
  counts: Record<ItemKind, number>;
  available: { new: number; wrong: number; repeat: number };
}

interface Pools {
  fresh: Question[];
  wrong: Question[];
  repeat: Question[];
}

function makePools(questions: Question[], stats: Record<string, QuestionStat>): Pools {
  const fresh: Question[] = [];
  const wrong: Question[] = [];
  const repeat: Question[] = [];
  for (const q of questions) {
    const st = stats[q.id];
    if (!st || st.seen === 0) fresh.push(q);
    else if (st.last !== "c") wrong.push(q);
    else repeat.push(q);
  }
  // Most-often-wrong first, then the ones not seen for the longest time.
  wrong.sort(
    (a, b) =>
      stats[b.id].wrong - stats[a.id].wrong || stats[a.id].lastAt - stats[b.id].lastAt,
  );
  return { fresh: byPriority(fresh), wrong, repeat: byPriority(repeat) };
}

/** Takes 70 new + 25 wrong + 5 repeat; any shortfall is filled from the other pools. */
function pick(pools: Pools, size: number) {
  const want: [keyof Pools, ItemKind, number][] = [
    ["fresh", "new", MIX.new],
    ["wrong", "wrong", MIX.wrong],
    ["repeat", "repeat", MIX.repeat],
  ];
  const scale = size / EXAM_SIZE;
  const taken: { q: Question; kind: ItemKind }[] = [];
  const used = { fresh: 0, wrong: 0, repeat: 0 };

  for (const [pool, kind, n] of want) {
    const k = Math.min(Math.round(n * scale), pools[pool].length);
    pools[pool].slice(0, k).forEach((q) => taken.push({ q, kind }));
    used[pool] = k;
  }
  for (const [pool, kind] of want) {
    while (taken.length < size && used[pool] < pools[pool].length) {
      taken.push({ q: pools[pool][used[pool]++], kind });
    }
  }
  return taken;
}

export function planExam(questions: Question[], stats: Record<string, QuestionStat>): ExamPlan {
  const pools = makePools(questions, stats);
  const total = Math.min(EXAM_SIZE, questions.length);
  const taken = pick(pools, total);
  const counts = { new: 0, wrong: 0, repeat: 0 } as Record<ItemKind, number>;
  taken.forEach((t) => counts[t.kind]++);
  return {
    total,
    counts,
    available: { new: pools.fresh.length, wrong: pools.wrong.length, repeat: pools.repeat.length },
  };
}

export function createExam(opts: {
  bookId: string;
  topics: string[];
  questions: Question[];
  stats: Record<string, QuestionStat>;
  timed: boolean;
  negative: boolean;
}): ExamRecord {
  const pool = opts.questions.filter((q) => opts.topics.includes(q.topic));
  const total = Math.min(EXAM_SIZE, pool.length);
  const taken = shuffle(pick(makePools(pool, opts.stats), total));
  const items: ExamItem[] = taken.map(({ q, kind }) => {
    const st = opts.stats[q.id];
    return {
      qid: q.id,
      kind,
      chosen: null,
      wrongBefore: st?.wrong ?? 0,
      wasWrongLast: st?.last === "w",
    };
  });
  return {
    id: `ex_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    bookId: opts.bookId,
    topics: opts.topics,
    createdAt: Date.now(),
    finishedAt: null,
    timed: opts.timed,
    // Timed exams always carry negative marking.
    negative: opts.timed || opts.negative,
    durationSec: opts.timed ? items.length * SECONDS_PER_QUESTION : null,
    items,
    current: 0,
  };
}

export function itemResult(item: ExamItem, q: Question | undefined): AttemptResult {
  if (!item.chosen || !q) return "s";
  return item.chosen === q.answer ? "c" : "w";
}

export function scoreExam(exam: ExamRecord, byId: Map<string, Question>, finishedAt: number): ExamScore {
  let correct = 0,
    wrong = 0,
    skipped = 0,
    negative = 0,
    wrongAgain = 0,
    prevWrongCount = 0;
  for (const item of exam.items) {
    const q = byId.get(item.qid);
    const r = itemResult(item, q);
    if (item.kind === "wrong") prevWrongCount++;
    if (r === "c") correct++;
    else if (r === "w") {
      wrong++;
      if (exam.negative && q) negative += q.negative_mark;
      if (item.kind === "wrong") wrongAgain++;
    } else skipped++;
  }
  const elapsedSec = Math.round((finishedAt - exam.createdAt) / 1000);
  return {
    total: exam.items.length,
    correct,
    wrong,
    skipped,
    negative,
    marks: correct - negative,
    wrongAgain,
    prevWrongCount,
    elapsedSec: exam.durationSec ? Math.min(elapsedSec, exam.durationSec) : elapsedSec,
  };
}

/** Finishes the exam and folds its answers into the per-question history. */
export function finishExam(state: AppState, examId: string, byId: Map<string, Question>): AppState {
  const exam = state.exams.find((e) => e.id === examId);
  if (!exam || exam.finishedAt) return state;
  const now = Date.now();
  const done: ExamRecord = { ...exam, finishedAt: now, score: scoreExam(exam, byId, now) };
  const stats = { ...state.stats };
  for (const item of exam.items) {
    const r = itemResult(item, byId.get(item.qid));
    const prev = stats[item.qid] ?? { seen: 0, correct: 0, wrong: 0, last: "s", history: [], lastAt: 0 };
    stats[item.qid] = {
      seen: prev.seen + 1,
      correct: prev.correct + (r === "c" ? 1 : 0),
      wrong: prev.wrong + (r === "w" ? 1 : 0),
      last: r,
      history: [...prev.history, r].slice(-20),
      lastAt: now,
    };
  }
  return {
    ...state,
    stats,
    exams: state.exams.map((e) => (e.id === examId ? done : e)),
    activeExamId: state.activeExamId === examId ? null : state.activeExamId,
  };
}
