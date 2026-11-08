"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Header, LoadingScreen, PrimaryLink, Screen, Tag } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData } from "@/lib/data";
import { findExam, getState, saveExam, setState, useAppState } from "@/lib/store";
import { finishExam } from "@/lib/exam";
import { OPTION_KEYS, type OptionKey } from "@/lib/types";
import { bn, bnClock } from "@/lib/bn";

export default function Exam() {
  const router = useRouter();
  const state = useAppState();
  const exam = findExam(state, state.activeExamId);
  const { loading, byId } = useBookData(exam?.bookId ?? state.bookId);
  const [now, setNow] = useState(() => Date.now());
  const [showGrid, setShowGrid] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const submit = useCallback(() => {
    const id = getState().activeExamId;
    if (!id) return;
    setState((s) => finishExam(s, id, byId));
    router.replace(`/result?id=${id}`);
  }, [byId, router]);

  const remaining = exam?.durationSec ? exam.durationSec - (now - exam.createdAt) / 1000 : null;

  useEffect(() => {
    if (!exam?.timed) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [exam?.timed]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !loading) submit();
  }, [remaining, loading, submit]);

  if (!exam || exam.finishedAt) {
    return (
      <Screen>
        <Header title="কোনো চলমান পরীক্ষা নেই" back="/" />
        <PrimaryLink href="/topics">নতুন পরীক্ষা শুরু করুন</PrimaryLink>
      </Screen>
    );
  }
  if (loading) return <LoadingScreen />;

  const idx = Math.min(exam.current, exam.items.length - 1);
  const item = exam.items[idx];
  const q = byId.get(item.qid);
  const answered = exam.items.filter((i) => i.chosen).length;
  const bcsTimes = q?.bcs_count ?? 0;

  const choose = (key: OptionKey) => {
    if (item.chosen) return; // locked once chosen
    saveExam({ ...exam, items: exam.items.map((it, i) => (i === idx ? { ...it, chosen: key } : it)) });
  };
  const go = (i: number) => {
    saveExam({ ...exam, current: Math.max(0, Math.min(exam.items.length - 1, i)) });
    setShowGrid(false);
  };

  return (
    <Screen
      footer={
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            aria-expanded={showGrid}
            className="flex h-[50px] items-center gap-2 rounded-[14px] border border-line bg-surface px-4 text-sm"
          >
            <Icon name="grid" /> সব প্রশ্ন
          </button>
          <button
            type="button"
            onClick={() => go(idx - 1)}
            disabled={idx === 0}
            aria-label="আগের প্রশ্ন"
            className="flex size-[50px] items-center justify-center rounded-[14px] border border-line bg-surface disabled:opacity-40"
          >
            <Icon name="left" />
          </button>
          {idx < exam.items.length - 1 ? (
            <button
              type="button"
              onClick={() => go(idx + 1)}
              className="h-[50px] flex-1 rounded-[14px] bg-accent text-base font-bold text-accent-ink"
            >
              পরের প্রশ্ন
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              className="h-[50px] flex-1 rounded-[14px] bg-warn-bar text-base font-bold text-accent-ink"
            >
              জমা দিন
            </button>
          )}
        </div>
      }
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">
          প্রশ্ন <span className="font-num font-bold text-ink">{bn(idx + 1)}</span> / {bn(exam.items.length)}
        </span>
        {remaining !== null ? (
          <div
            className={`flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 ${
              remaining < 300 ? "text-warn" : ""
            }`}
            role="timer"
            aria-label="বাকি সময়"
          >
            <Icon name="timer" size={16} className="text-accent" />
            <span className="font-num text-base font-bold">{bnClock(remaining)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted">সময়সীমা নেই</span>
        )}
        <button type="button" onClick={() => setConfirm(true)} className="min-h-11 text-sm font-semibold text-warn">
          জমা দিন
        </button>
      </div>
      <div className="h-1 rounded-full bg-line">
        <div className="h-1 rounded-full bg-accent" style={{ width: `${(answered / exam.items.length) * 100}%` }} />
      </div>

      {confirm && (
        <div className="flex flex-col gap-3 rounded-[18px] border border-warn-line bg-warn-bg p-4">
          <span className="text-[15px] font-semibold">পরীক্ষা জমা দেবেন?</span>
          <span className="text-sm text-[#fed7aa]">
            {bn(answered)}টি উত্তর দিয়েছেন, {bn(exam.items.length - answered)}টি বাকি। জমা দিলে আর বদলানো যাবে না।
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={submit} className="h-11 flex-1 rounded-xl bg-warn-bar font-bold text-accent-ink">
              হ্যাঁ, জমা দিন
            </button>
            <button type="button" onClick={() => setConfirm(false)} className="h-11 flex-1 rounded-xl border border-line">
              ফিরে যান
            </button>
          </div>
        </div>
      )}

      {showGrid && (
        <div className="grid grid-cols-8 gap-1.5 rounded-[18px] border border-line bg-surface p-3">
          {exam.items.map((it, i) => (
            <button
              key={it.qid}
              type="button"
              onClick={() => go(i)}
              aria-label={`প্রশ্ন ${bn(i + 1)}${it.chosen ? ", উত্তর দেওয়া" : ""}`}
              aria-current={i === idx}
              className={`flex h-9 items-center justify-center rounded-lg font-num text-xs ${
                i === idx
                  ? "border-2 border-accent"
                  : it.chosen
                    ? "bg-info-bg text-info"
                    : "bg-surface-2 text-muted"
              }`}
            >
              {bn(i + 1)}
            </button>
          ))}
        </div>
      )}

      {q ? (
        <div className="flex flex-col gap-4 pt-2">
          <div className="flex flex-wrap gap-1.5">
            {bcsTimes > 0 && <Tag tone="info">বিসিএস-এ {bn(bcsTimes)} বার</Tag>}
            {item.wrongBefore > 0 && <Tag tone="warn">আগে {bn(item.wrongBefore)} বার ভুল</Tag>}
            {item.kind === "repeat" && <Tag>রিপিট</Tag>}
            <Tag>{q.topic}</Tag>
          </div>
          <h2 className="text-xl leading-normal font-semibold">{q.question}</h2>
          {q.sources.length > 0 && (
            <span className="text-xs text-muted">[{q.sources.map((s) => s.exam_name).join(", ")}]</span>
          )}
          <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="উত্তর বাছুন">
            {OPTION_KEYS.map((k) => {
              const sel = item.chosen === k;
              const dim = !!item.chosen && !sel;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  aria-disabled={!!item.chosen}
                  onClick={() => choose(k)}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-left text-base ${
                    sel
                      ? "border-2 border-accent bg-info-bg"
                      : `border border-line bg-surface ${dim ? "text-dim" : ""}`
                  } ${item.chosen ? "cursor-default" : "cursor-pointer"}`}
                >
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-[10px] font-bold ${
                      sel ? "bg-accent text-accent-ink" : `bg-surface-2 ${dim ? "text-dim" : "text-ink-2"}`
                    }`}
                  >
                    {k}
                  </span>
                  <span className="flex-1">{q.options[k]}</span>
                  {sel && <Icon name="lock" />}
                </button>
              );
            })}
          </div>
          {item.chosen ? (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Icon name="lock" size={16} /> উত্তর লক হয়েছে — সঠিক উত্তর ও ব্যাখ্যা পরীক্ষা শেষে দেখবেন
            </div>
          ) : (
            <span className="text-[13px] text-muted">
              একবার বাছলে আর বদলানো যাবে না
              {exam.negative && ` · ভুলে −${bn(q.negative_mark.toFixed(2))}`}
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">এই প্রশ্নটি ডেটাতে পাওয়া যায়নি।</p>
      )}
    </Screen>
  );
}
