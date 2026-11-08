"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { LoadingScreen } from "@/components/ui";
import { useBookData } from "@/lib/data";
import { findExam, useAppState } from "@/lib/store";
import { itemResult } from "@/lib/exam";
import { OPTION_KEYS } from "@/lib/types";
import { bn, bnDate, bnDuration, bnMarks } from "@/lib/bn";

/** Printable result sheet. The browser's print dialog saves it as a PDF (Bangla text stays selectable). */
export default function Print() {
  const params = useSearchParams();
  const state = useAppState();
  const exam = findExam(state, params.get("id"));
  const { loading, book, byId } = useBookData(exam?.bookId ?? null);

  useEffect(() => {
    if (!loading && exam?.score) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [loading, exam?.score]);

  if (!exam?.score) return <LoadingScreen text="পরীক্ষাটি পাওয়া যায়নি।" />;
  if (loading) return <LoadingScreen />;
  const s = exam.score;

  return (
    <div className="min-h-dvh bg-white text-[#111]">
      <div className="no-print sticky top-0 flex gap-2 border-b border-[#ddd] bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="h-11 rounded-xl bg-[#1d4ed8] px-4 font-semibold text-white"
        >
          PDF হিসেবে সেভ করুন
        </button>
        <Link href={`/result?id=${exam.id}`} className="flex h-11 items-center rounded-xl border border-[#ccc] px-4">
          ফিরে যান
        </Link>
        <span className="self-center text-xs text-[#555]">প্রিন্ট ডায়ালগে “Save as PDF” বাছুন</span>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <header className="mb-5 border-b-2 border-[#111] pb-3">
          <h1 className="text-2xl font-bold">JobPrep AI — পরীক্ষার ফলাফল ও ব্যাখ্যা</h1>
          <p className="text-sm text-[#444]">
            {book?.title} · {exam.topics.join(", ")} · {bnDate(exam.finishedAt!)}
          </p>
          <p className="mt-2 text-base">
            প্রাপ্ত নম্বর: <b>{bnMarks(s.marks)}</b> / {bn(s.total)} · সঠিক {bn(s.correct)} · ভুল {bn(s.wrong)} · বাদ{" "}
            {bn(s.skipped)} · নেগেটিভ −{bnMarks(s.negative)} · সময় {bnDuration(s.elapsedSec)}
          </p>
        </header>

        <ol className="flex flex-col gap-4">
          {exam.items.map((it, i) => {
            const q = byId.get(it.qid);
            if (!q) return null;
            const r = itemResult(it, q);
            const wrongTotal = state.stats[q.id]?.wrong ?? 0;
            return (
              <li key={it.qid} className="print-break rounded-lg border border-[#ccc] p-3">
                <div className="mb-1 flex flex-wrap justify-between gap-2 text-xs text-[#555]">
                  <span>
                    প্রশ্ন {bn(i + 1)} · {q.topic} · {r === "c" ? "✓ সঠিক" : r === "w" ? "✗ ভুল" : "— বাদ"}
                  </span>
                  <span>
                    {it.wasWrongLast && "★ আগের পরীক্ষায় ভুল · "}
                    {wrongTotal > 0 && `মোট ${bn(wrongTotal)} বার ভুল`}
                  </span>
                </div>
                <p className="font-semibold">{q.question}</p>
                <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm">
                  {OPTION_KEYS.map((k) => (
                    <li
                      key={k}
                      className={
                        k === q.answer ? "font-bold text-[#065f46]" : k === it.chosen ? "text-[#b91c1c] line-through" : ""
                      }
                    >
                      {k}. {q.options[k]}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-sm">
                  <b>উত্তর:</b> {q.answer} · <b>আপনার উত্তর:</b> {it.chosen ?? "দেননি"}
                </p>
                {q.explanation && (
                  <p className="mt-1 text-sm text-[#333]">
                    <b>ব্যাখ্যা:</b> {q.explanation}
                  </p>
                )}
                {q.sources.length > 0 && (
                  <p className="mt-1 text-xs text-[#555]">[{q.sources.map((x) => x.exam_name).join(", ")}]</p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
