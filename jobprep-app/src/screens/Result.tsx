"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bar, Card, Header, LoadingScreen, Num, PrimaryLink, Screen } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData } from "@/lib/data";
import { findExam, useAppState } from "@/lib/store";
import { finishedExams, percent } from "@/lib/stats";
import { itemResult } from "@/lib/exam";
import { bn, bnDuration, bnMarks, bnPercent } from "@/lib/bn";

export default function Result() {
  const params = useSearchParams();
  const state = useAppState();
  const all = finishedExams(state);
  const exam = findExam(state, params.get("id")) ?? all[all.length - 1];
  const { loading, byId } = useBookData(exam?.bookId ?? null);

  if (!exam?.score) {
    return (
      <Screen nav>
        <Header title="পরীক্ষার ফলাফল" back="/" />
        <p className="text-sm text-muted">এখনো কোনো পরীক্ষা শেষ হয়নি।</p>
        <PrimaryLink href="/topics">পরীক্ষা দিন</PrimaryLink>
      </Screen>
    );
  }
  if (loading) return <LoadingScreen />;

  const s = exam.score;
  const prev = all.filter((e) => e.bookId === exam.bookId && e.finishedAt! < exam.finishedAt!).pop();
  const diff = prev?.score ? percent(exam) * 100 - percent(prev) * 100 : null;

  const byTopic = new Map<string, { c: number; n: number }>();
  for (const it of exam.items) {
    const q = byId.get(it.qid);
    if (!q) continue;
    const t = byTopic.get(q.topic) ?? { c: 0, n: 0 };
    t.n++;
    if (itemResult(it, q) === "c") t.c++;
    byTopic.set(q.topic, t);
  }
  const topics = [...byTopic.entries()].sort((a, b) => b[1].c / b[1].n - a[1].c / a[1].n);

  return (
    <Screen
      footer={
        <div className="flex gap-2.5">
          <Link
            href={`/print?id=${exam.id}`}
            className="flex h-[52px] items-center gap-2 rounded-[14px] border border-line bg-surface px-4 text-sm font-semibold"
          >
            <Icon name="download" /> PDF ডাউনলোড
          </Link>
          <PrimaryLink href={`/review?id=${exam.id}`} className="flex-1 text-[15px]">
            ব্যাখ্যাসহ দেখুন
          </PrimaryLink>
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">পরীক্ষার ফলাফল</h1>
        <Link
          href="/"
          aria-label="হোমে যান"
          className="flex size-11 items-center justify-center rounded-[14px] border border-line bg-surface"
        >
          <Icon name="x" />
        </Link>
      </div>

      <Card className="flex flex-col items-center gap-1.5 rounded-[20px] p-5 text-center">
        <span className="text-[13px] text-muted">
          {exam.topics.length > 3 ? `${bn(exam.topics.length)}টি টপিক` : exam.topics.join(" · ")} ·{" "}
          {bnDuration(s.elapsedSec)}
        </span>
        <div className="flex items-baseline gap-1.5">
          <Num className="text-[56px] text-accent">{bnMarks(s.marks)}</Num>
          <span className="text-lg text-muted">/ {bn(s.total)}</span>
        </div>
        {diff !== null && (
          <span className={`text-[13px] font-semibold ${diff >= 0 ? "text-ok" : "text-warn"}`}>
            আগের পরীক্ষার চেয়ে {diff >= 0 ? "+" : "−"}
            {bnMarks(Math.abs(diff))}%
          </span>
        )}
        <span className="text-xs text-muted">
          {exam.timed ? "সময়সহ" : "সময় ছাড়া"} · {exam.negative ? "নেগেটিভ মার্কসহ" : "নেগেটিভ মার্ক ছাড়া"}
        </span>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {[
          ["সঠিক", bn(s.correct), "text-ok"],
          ["ভুল", bn(s.wrong), "text-warn"],
          ["বাদ", bn(s.skipped), ""],
          ["নেগেটিভ", s.negative ? "−" + bnMarks(s.negative) : "০", "text-warn"],
        ].map(([label, value, cls]) => (
          <div key={label} className="flex flex-col items-center gap-0.5 rounded-[14px] border border-line bg-surface px-1.5 py-3">
            <Num className={`text-xl ${cls}`}>{value}</Num>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold">টপিক অনুযায়ী</h2>
        {topics.map(([name, t]) => {
          const r = t.c / t.n;
          return (
            <div key={name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{name}</span>
                <span className={`font-num ${r < 0.5 ? "text-warn" : ""}`}>
                  {bnPercent(r)} <span className="text-xs text-muted">({bn(t.c)}/{bn(t.n)})</span>
                </span>
              </div>
              <Bar ratio={r} warn={r < 0.5} />
            </div>
          );
        })}
      </Card>

      {s.prevWrongCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-warn-bg px-4 py-3.5">
          <Num className="text-[22px] text-warn">
            {bn(s.wrongAgain)}/{bn(s.prevWrongCount)}
          </Num>
          <span className="text-[13px] leading-relaxed text-[#fed7aa]">
            আগের ভুল {bn(s.prevWrongCount)}টি প্রশ্নের মধ্যে {bn(s.wrongAgain)}টি এবারও ভুল হয়েছে
          </span>
        </div>
      )}
    </Screen>
  );
}
