"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, Header, LoadingScreen, Num, PrimaryLink, Screen } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData } from "@/lib/data";
import { setState, useAppState } from "@/lib/store";
import { createExam, planExam, SECONDS_PER_QUESTION } from "@/lib/exam";
import { bn, bnDuration } from "@/lib/bn";

function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex min-h-11 items-center gap-3 px-4 py-3.5 ${disabled ? "opacity-80" : "cursor-pointer"}`}>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-semibold">{label}</span>
        <span className="text-xs text-muted">{hint}</span>
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-[22px] accent-accent"
      />
    </label>
  );
}

export default function Setup() {
  const router = useRouter();
  const state = useAppState();
  const { loading, book, questions } = useBookData(state.bookId);
  const [timed, setTimed] = useState(true);
  const [negative, setNegative] = useState(true);

  if (loading) return <LoadingScreen />;

  const topics = state.selectedTopics;
  const pool = questions.filter((q) => topics.includes(q.topic));
  if (!book || pool.length === 0) {
    return (
      <Screen>
        <Header title="পরীক্ষা সেটআপ" back="/topics" />
        <p className="text-sm text-muted">আগে অন্তত একটি টপিক বাছুন।</p>
        <PrimaryLink href="/topics">টপিক বাছুন</PrimaryLink>
      </Screen>
    );
  }

  const plan = planExam(pool, state.stats);
  const pct = (n: number) => `${(n / plan.total) * 100}%`;
  const negativeOn = timed || negative;
  const hasBankOrBcs = pool.some((q) => q.negative_mark === 0.5);
  const hasOther = pool.some((q) => q.negative_mark === 0.25);

  const start = () => {
    const exam = createExam({ bookId: book.id, topics, questions, stats: state.stats, timed, negative });
    setState((s) => ({ ...s, exams: [...s.exams, exam], activeExamId: exam.id }));
    router.push("/exam");
  };

  return (
    <Screen
      footer={
        <button
          type="button"
          onClick={start}
          className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-accent text-base font-bold text-accent-ink"
        >
          পরীক্ষা শুরু করুন
        </button>
      }
    >
      <Header
        title="পরীক্ষা সেটআপ"
        subtitle={topics.length > 3 ? `${bn(topics.length)}টি টপিক` : topics.join(" · ")}
        back="/topics"
      />

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-semibold">প্রশ্নের মিশ্রণ</span>
          <Num className="text-[22px]">{bn(plan.total)}</Num>
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          <div className="bg-accent" style={{ width: pct(plan.counts.new) }} />
          <div className="bg-warn-bar" style={{ width: pct(plan.counts.wrong) }} />
          <div className="bg-ink-2" style={{ width: pct(plan.counts.repeat) }} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col">
            <Num className="text-lg text-accent">{bn(plan.counts.new)}</Num>
            <span className="text-xs text-muted">নতুন প্রশ্ন</span>
          </div>
          <div className="flex flex-col">
            <Num className="text-lg text-warn">{bn(plan.counts.wrong)}</Num>
            <span className="text-xs text-muted">আগের ভুল</span>
          </div>
          <div className="flex flex-col">
            <Num className="text-lg text-ink-2">{bn(plan.counts.repeat)}</Num>
            <span className="text-xs text-muted">রিপিট</span>
          </div>
        </div>
        <span className="text-xs leading-relaxed text-muted">
          নতুন প্রশ্ন আসবে অগ্রাধিকার অনুযায়ী: বিসিএস-এ বারবার আসা → বিসিএস → পিএসসি → ব্যাংক → অন্যান্য।
          {plan.total < 100 && ` এই টপিকগুলোতে মোট ${bn(plan.total)}টি প্রশ্ন আছে।`}
          {plan.available.wrong < 25 &&
            plan.total >= 100 &&
            " আগের ভুল প্রশ্ন কম থাকায় বাকি জায়গা নতুন প্রশ্ন দিয়ে পূরণ হবে।"}
        </span>
      </Card>

      <div className="flex flex-col divide-y divide-line rounded-[18px] border border-line bg-surface">
        <Toggle
          label="সময় নির্ধারণ"
          hint={`${bn(plan.total)} প্রশ্নে ${bnDuration(plan.total * SECONDS_PER_QUESTION)} (প্রতি ১০০ প্রশ্নে ৬০ মিনিট)`}
          checked={timed}
          onChange={setTimed}
        />
        <Toggle
          label="নেগেটিভ মার্কিং"
          hint={timed ? "টাইমার চালু থাকায় নিজে থেকেই চালু" : "চাইলে বন্ধ রাখতে পারেন"}
          checked={negativeOn}
          disabled={timed}
          onChange={setNegative}
        />
      </div>

      {negativeOn && (
        <div className="grid grid-cols-2 gap-2.5">
          <Card className={`flex flex-col gap-1 rounded-2xl p-3.5 ${hasBankOrBcs ? "" : "opacity-60"}`}>
            <span className="text-xs text-muted">বিসিএস ও ব্যাংক প্রশ্ন</span>
            <Num className="text-xl text-warn">−০.৫০</Num>
            <span className="text-xs text-muted">প্রতি ভুলে</span>
          </Card>
          <Card className={`flex flex-col gap-1 rounded-2xl p-3.5 ${hasOther ? "" : "opacity-60"}`}>
            <span className="text-xs text-muted">অন্যান্য পরীক্ষার প্রশ্ন</span>
            <Num className="text-xl text-warn">−০.২৫</Num>
            <span className="text-xs text-muted">প্রতি ভুলে</span>
          </Card>
        </div>
      )}

      <div className="flex items-start gap-2.5 rounded-[14px] bg-info-bg px-3.5 py-3">
        <Icon name="info" className="mt-0.5 shrink-0 text-info" />
        <span className="text-[13px] leading-relaxed text-[#cfe0ff]">
          একবার অপশন বাছলে আর বদলানো যাবে না। ভেবে উত্তর দিন।
        </span>
      </div>
    </Screen>
  );
}
