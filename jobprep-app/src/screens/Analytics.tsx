"use client";

import Link from "next/link";
import { Bar, Card, EmptyState, Header, LoadingScreen, Num, Screen } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData } from "@/lib/data";
import { setState, useAppState } from "@/lib/store";
import { finishedExams, percent, priorityMastery, suggestion, topicStats } from "@/lib/stats";
import { bn, bnDate, bnMarks, bnPercent, PRIORITY_LABEL } from "@/lib/bn";

export default function Analytics() {
  const state = useAppState();
  const { loading, book, questions } = useBookData(state.bookId);
  if (loading) return <LoadingScreen />;

  const exams = finishedExams(state, book?.id);
  const last = exams.slice(-8);
  const topics = topicStats(questions, state)
    .filter((t) => t.attempted > 0)
    .sort((a, b) => a.accuracy - b.accuracy);
  const tiers = priorityMastery(questions, state).filter((t) => t.total > 0);
  const tip = suggestion(questions, state);
  const max = 1;

  return (
    <Screen nav>
      <Header title="আপনার অগ্রগতি" subtitle={book?.title} />

      {exams.length === 0 ? (
        <EmptyState title="এখনো কোনো পরীক্ষা নেই" text="পরীক্ষা দিলে এখানে নম্বরের গ্রাফ, টপিক আর অগ্রাধিকার অনুযায়ী আয়ত্ত দেখাবে।" />
      ) : (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">শেষ {bn(last.length)}টি পরীক্ষা</h2>
            <span className="text-xs text-muted">নম্বর %</span>
          </div>
          <div
            role="img"
            aria-label={`শেষ ${bn(last.length)}টি পরীক্ষার স্কোর: ${last.map((e) => bnPercent(percent(e))).join(", ")}`}
            className="flex h-[120px] items-end gap-2"
          >
            {last.map((e, i) => {
              const p = percent(e);
              return (
                <div key={e.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="font-num text-[11px] text-muted">{bn(Math.round(p * 100))}</span>
                  <div
                    className={`w-full rounded-t-md rounded-b-sm ${i === last.length - 1 ? "bg-accent" : "bg-[#2a3a52]"}`}
                    style={{ height: `${Math.max(4, (p / max) * 96)}px` }}
                  />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tip && (
        <div className="flex flex-col gap-2.5 rounded-[18px] bg-info-bg p-4">
          <div className="flex items-center gap-2">
            <Icon name="spark" className="text-info" />
            <span className="text-sm font-semibold text-[#cfe0ff]">স্মার্ট পরামর্শ</span>
          </div>
          <p className="text-sm leading-relaxed">
            “{tip.topic}” টপিকে আপনার সঠিকের হার {bnPercent(tip.accuracy)}।
            {tip.topTotal > 0 &&
              ` এই টপিকে বিসিএস-এ আসা ${bn(tip.topTotal)}টি প্রশ্নের ${bn(tip.stillWrong)}টি এখনো ভুল হচ্ছে।`}{" "}
            আজ শুধু এই টপিক নিয়ে একটি পরীক্ষা দিন।
          </p>
          <Link
            href="/setup"
            onClick={() => setState((s) => ({ ...s, bookId: book?.id ?? s.bookId, selectedTopics: [tip.topic] }))}
            className="flex h-11 items-center self-start rounded-xl bg-accent px-4 text-sm font-bold text-accent-ink"
          >
            {tip.topic} পরীক্ষা দিন
          </Link>
        </div>
      )}

      {tiers.length > 0 && (
        <Card className="flex flex-col gap-2.5">
          <h2 className="text-[15px] font-semibold">অগ্রাধিকার অনুযায়ী আয়ত্ত</h2>
          {tiers.map((t) => (
            <div key={t.priority} className="flex items-center gap-2.5">
              <span className="flex size-[22px] shrink-0 items-center justify-center rounded-[7px] bg-surface-2 text-xs font-bold text-ink-2">
                {bn(t.priority)}
              </span>
              <span className="w-[118px] shrink-0 text-[13px]">{PRIORITY_LABEL[t.priority]}</span>
              <div className="flex-1">
                <Bar ratio={t.ratio} warn={t.ratio < 0.5} />
              </div>
              <span className="w-[52px] text-right font-num text-xs text-ink-2">
                {bn(t.mastered)}/{bn(t.total)}
              </span>
            </div>
          ))}
          <span className="text-xs text-muted">শেষবার সঠিক উত্তর দেওয়া প্রশ্নকে “আয়ত্তে” ধরা হয়েছে</span>
        </Card>
      )}

      {topics.length > 0 && (
        <Card className="flex flex-col gap-3">
          <h2 className="text-[15px] font-semibold">টপিক অনুযায়ী (দুর্বল আগে)</h2>
          {topics.map((t) => (
            <div key={t.topic} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{t.topic}</span>
                <span className={`font-num ${t.accuracy < 0.5 ? "text-warn" : "text-ok"}`}>{bnPercent(t.accuracy)}</span>
              </div>
              <Bar ratio={t.accuracy} warn={t.accuracy < 0.5} />
            </div>
          ))}
        </Card>
      )}

      {exams.length > 0 && (
        <Card className="flex flex-col gap-1 p-0">
          <h2 className="px-4 pt-4 pb-1 text-[15px] font-semibold">পরীক্ষার ইতিহাস</h2>
          {[...exams].reverse().slice(0, 15).map((e) => (
            <Link
              key={e.id}
              href={`/result?id=${e.id}`}
              className="flex min-h-11 items-center gap-3 border-t border-line px-4 py-2.5"
            >
              <span className="flex flex-1 flex-col">
                <span className="truncate text-sm">{e.topics.join(", ")}</span>
                <span className="text-xs text-muted">{bnDate(e.finishedAt!)}</span>
              </span>
              <Num className="text-sm">
                {bnMarks(e.score!.marks)}/{bn(e.score!.total)}
              </Num>
              <Icon name="right" className="text-muted" />
            </Link>
          ))}
        </Card>
      )}
    </Screen>
  );
}
