// Run: npm test   (Node 24 runs TypeScript directly)
import fs from "node:fs";
import { createExam, finishExam, planExam, scoreExam } from "../src/lib/exam.ts";

let failed = 0;
const assert = (c: unknown, m: string) => {
  if (!c) { console.error("FAIL ", m); failed++; } else console.log("ok   ", m);
};

// Synthetic 300-question topic
const qs: any[] = Array.from({ length: 300 }, (_, i) => ({
  id: "q" + i, book_id: "b", subject: "s", topic: "T", question: "?",
  options: { ক: "1", খ: "2", গ: "3", ঘ: "4" }, answer: "ক", sources: [],
  bcs_count: i % 7, priority: (i % 5) + 1, negative_mark: i % 2 ? 0.5 : 0.25,
}));
const byId = new Map(qs.map((q) => [q.id, q]));
let state: any = { v: 1, bookId: "b", selectedTopics: ["T"], stats: {}, exams: [], activeExamId: null };

// Exam 1: everything new, priority order respected
const e1 = createExam({ bookId: "b", topics: ["T"], questions: qs, stats: state.stats, timed: true, negative: false });
assert(e1.items.length === 100, "exam has 100 questions");
assert(e1.durationSec === 3600, "100 questions = 60 minutes");
assert(e1.negative === true, "timer forces negative marking");
const prios = e1.items.map((i) => byId.get(i.qid).priority);
assert(prios.filter((p) => p === 1).length === 60 && prios.filter((p) => p === 2).length === 40,
  "new questions come priority 1 first, then 2");
e1.items = e1.items.map((it, i) => ({ ...it, chosen: i < 60 ? "খ" : null }));
state.exams.push(e1);
state.activeExamId = e1.id;
state = finishExam(state, e1.id, byId);
const s1 = state.exams[0].score;
const expectedNeg = e1.items.slice(0, 60).reduce((s, it) => s + byId.get(it.qid).negative_mark, 0);
assert(s1.wrong === 60 && s1.skipped === 40 && Math.abs(s1.negative - expectedNeg) < 1e-9,
  "each wrong answer costs that question's 0.50 / 0.25");
assert(state.activeExamId === null, "active exam cleared after submit");

// 20 of the skipped ones answered correctly later -> repeat pool
for (const it of e1.items.slice(60, 80)) state.stats[it.qid] = { ...state.stats[it.qid], last: "c", correct: 1 };

// Exam 2: 70 new / 25 wrong / 5 repeat
const plan = planExam(qs, state.stats);
assert(plan.counts.new === 70 && plan.counts.wrong === 25 && plan.counts.repeat === 5,
  `mix is 70/25/5 (got ${JSON.stringify(plan.counts)})`);
const e2 = createExam({ bookId: "b", topics: ["T"], questions: qs, stats: state.stats, timed: false, negative: false });
assert(e2.negative === false && e2.durationSec === null, "untimed exam can run without negative marking");
assert(e2.items.filter((i) => i.kind === "wrong").every((i) => i.wrongBefore >= 1 && i.wasWrongLast),
  "previously wrong questions carry their wrong count");
const e2s = scoreExam({ ...e2, items: e2.items.map((i) => ({ ...i, chosen: "খ" as const })) }, byId, Date.now());
assert(e2s.negative === 0 && e2s.marks === 0, "no deduction when negative marking is off");

// A real topic from the published book data
const demo = JSON.parse(fs.readFileSync(new URL("../public/data/agrodut_bangla_10_2026.json", import.meta.url), "utf8"));
const e3 = createExam({ bookId: "agrodut_bangla_10_2026", topics: ["সন্ধি"], questions: demo, stats: {}, timed: true, negative: true });
assert(e3.items.length === Math.min(100, demo.filter((q: any) => q.topic === "সন্ধি").length), "only the selected topic is used");
assert(e3.durationSec === e3.items.length * 36, "time scales at 36 s per question");

if (failed) { console.error(`${failed} test(s) failed`); process.exit(1); }
console.log("All exam-logic tests passed.");
