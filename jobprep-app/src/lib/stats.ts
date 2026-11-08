import type { AppState, ExamRecord, Question } from "./types";

export interface TopicStat {
  topic: string;
  attempted: number;
  correct: number;
  accuracy: number;
  total: number;
}

export function finishedExams(state: AppState, bookId?: string | null): ExamRecord[] {
  return state.exams
    .filter((e) => e.finishedAt && e.score && (!bookId || e.bookId === bookId))
    .sort((a, b) => a.finishedAt! - b.finishedAt!);
}

export function topicStats(questions: Question[], state: AppState): TopicStat[] {
  const map = new Map<string, TopicStat>();
  for (const q of questions) {
    const t = map.get(q.topic) ?? { topic: q.topic, attempted: 0, correct: 0, accuracy: 0, total: 0 };
    t.total++;
    const st = state.stats[q.id];
    if (st) {
      t.attempted += st.seen;
      t.correct += st.correct;
    }
    map.set(q.topic, t);
  }
  return [...map.values()].map((t) => ({ ...t, accuracy: t.attempted ? t.correct / t.attempted : 0 }));
}

export function priorityMastery(questions: Question[], state: AppState) {
  return [1, 2, 3, 4, 5].map((p) => {
    const qs = questions.filter((q) => q.priority === p);
    const mastered = qs.filter((q) => state.stats[q.id]?.last === "c").length;
    return { priority: p, total: qs.length, mastered, ratio: qs.length ? mastered / qs.length : 0 };
  });
}

/** Consecutive days (ending today or yesterday) with at least one finished exam. */
export function streakDays(exams: ExamRecord[]): number {
  const days = new Set(exams.map((e) => new Date(e.finishedAt!).toDateString()));
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function percent(e: ExamRecord): number {
  return e.score && e.score.total ? Math.max(0, e.score.marks) / e.score.total : 0;
}

export function wrongBank(questions: Question[], state: AppState): number {
  return questions.filter((q) => state.stats[q.id]?.last === "w").length;
}

/** Rule-based study suggestion: weakest topic, weighted toward high-priority questions. */
export function suggestion(questions: Question[], state: AppState) {
  const weak = topicStats(questions, state)
    .filter((t) => t.attempted >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)[0];
  if (!weak) return null;
  const topQs = questions.filter((q) => q.topic === weak.topic && q.priority <= 2);
  const stillWrong = topQs.filter((q) => state.stats[q.id]?.last === "w").length;
  return { topic: weak.topic, accuracy: weak.accuracy, topTotal: topQs.length, stillWrong };
}
