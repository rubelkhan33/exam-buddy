"use client";

import Link from "next/link";
import { Bar, Card, EmptyState, LoadingScreen, Num, Ring, Screen, Tag } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData } from "@/lib/data";
import { useAppState } from "@/lib/store";
import { finishedExams, percent, priorityMastery, streakDays, topicStats, wrongBank } from "@/lib/stats";
import { bn, bnPercent } from "@/lib/bn";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "শুভ সকাল";
  if (h < 17) return "শুভ দুপুর";
  return "শুভ সন্ধ্যা";
}

export default function Home() {
  const state = useAppState();
  const { loading, book, questions } = useBookData(state.bookId);
  if (loading) return <LoadingScreen />;

  const exams = finishedExams(state, book?.id);
  const recent = exams.slice(-10);
  const avg = recent.length ? recent.reduce((s, e) => s + percent(e), 0) / recent.length : 0;
  const weak = topicStats(questions, state)
    .filter((t) => t.attempted >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);
  const p1 = priorityMastery(questions, state)[0];
  const active = state.exams.find((e) => e.id === state.activeExamId && !e.finishedAt);

  return (
    <Screen nav>
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-[13px] text-muted">{greeting()}</span>
          <h1 className="text-[22px] font-bold">JobPrep AI</h1>
        </div>
        {book?.demo && <Tag tone="warn">ডেমো ডেটা</Tag>}
      </div>

      <Card className="flex items-center gap-[18px] rounded-[20px]">
        <Ring ratio={avg}>
          <Num className="text-2xl">{recent.length ? bnPercent(avg) : "—"}</Num>
          <span className="text-[11px] text-muted">গড় স্কোর</span>
        </Ring>
        <div className="flex flex-1 flex-col gap-2">
          <span className="text-[15px] font-semibold">{book?.title ?? "কোনো বই নেই"}</span>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col">
              <Num className="text-lg">{bn(exams.length)}</Num>
              <span className="text-xs text-muted">পরীক্ষা দিয়েছেন</span>
            </div>
            <div className="flex flex-col">
              <Num className="text-lg">{bn(streakDays(exams))} দিন</Num>
              <span className="text-xs text-muted">টানা স্ট্রিক</span>
            </div>
          </div>
        </div>
      </Card>

      {active ? (
        <Link
          href="/exam"
          className="flex min-h-11 items-center justify-between rounded-2xl bg-warn-bar px-[18px] py-4 text-accent-ink"
        >
          <div className="flex flex-col">
            <span className="text-[17px] font-bold">চলমান পরীক্ষা চালিয়ে যান</span>
            <span className="text-[13px] font-medium">
              {bn(active.items.filter((i) => i.chosen).length)}/{bn(active.items.length)} উত্তর দেওয়া হয়েছে
            </span>
          </div>
          <Icon name="arrow" size={22} />
        </Link>
      ) : (
        <Link
          href="/topics"
          className="flex min-h-11 items-center justify-between rounded-2xl bg-accent px-[18px] py-4 text-accent-ink"
        >
          <div className="flex flex-col">
            <span className="text-[17px] font-bold">নতুন পরীক্ষা শুরু করুন</span>
            <span className="text-[13px] font-medium">টপিক বাছুন · ১০০ প্রশ্ন · ৬০ মিনিট</span>
          </div>
          <Icon name="arrow" size={22} />
        </Link>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">দুর্বল টপিক</h2>
          <Link href="/analytics" className="text-[13px] text-accent">
            সব দেখুন
          </Link>
        </div>
        {weak.length ? (
          <div className="flex flex-col rounded-2xl border border-line bg-surface px-3.5 py-1.5">
            {weak.map((t, i) => (
              <div
                key={t.topic}
                className={`flex items-center gap-3 py-2.5 ${i < weak.length - 1 ? "border-b border-line" : ""}`}
              >
                <span className="flex-1 text-sm">{t.topic}</span>
                <div className="w-[90px]">
                  <Bar ratio={t.accuracy} warn={t.accuracy < 0.5} height={6} />
                </div>
                <Num className={`w-10 text-right text-[13px] font-medium ${t.accuracy < 0.5 ? "text-warn" : "text-ok"}`}>
                  {bnPercent(t.accuracy)}
                </Num>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="এখনো ডেটা নেই" text="কয়েকটা পরীক্ষা দিলে এখানে আপনার দুর্বল টপিকগুলো দেখাবে।" />
        )}
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/review" className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3.5">
          <Num className="text-[22px] text-warn">{bn(wrongBank(questions, state))}</Num>
          <span className="text-[13px] text-muted">ভুল প্রশ্ন জমা আছে — রিভিউ করুন</span>
        </Link>
        <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-3.5">
          <Num className="text-[22px]">
            {bn(p1.mastered)}/{bn(p1.total)}
          </Num>
          <span className="text-[13px] text-muted">বিসিএস-এ বারবার আসা প্রশ্ন আয়ত্তে</span>
        </div>
      </div>
    </Screen>
  );
}
