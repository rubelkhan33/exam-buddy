"use client";

import { Icon } from "./icons";
import { Tag } from "./ui";
import { OPTION_KEYS, type OptionKey, type Question, type QuestionStat } from "@/lib/types";
import { bn } from "@/lib/bn";

export function ReviewCard({
  index,
  q,
  chosen,
  wasWrongBefore,
  stat,
  showChosen = true,
}: {
  index?: number;
  q: Question;
  chosen: OptionKey | null;
  wasWrongBefore?: boolean;
  stat?: QuestionStat;
  showChosen?: boolean;
}) {
  const wrongTotal = stat?.wrong ?? 0;
  const history = stat?.history ?? [];
  return (
    <article className="print-break flex flex-col gap-3 rounded-[18px] border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-muted">
          {index !== undefined && `প্রশ্ন ${bn(index + 1)} · `}
          {q.topic}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {wasWrongBefore && <Tag tone="warn">আগের পরীক্ষায় ভুল</Tag>}
          {wrongTotal > 0 && <Tag tone="warn">মোট {bn(wrongTotal)} বার ভুল</Tag>}
        </span>
      </div>
      <h3 className="text-[17px] leading-normal font-semibold">{q.question}</h3>
      <div className="flex flex-col gap-2">
        {OPTION_KEYS.map((k) => {
          const isAnswer = k === q.answer;
          const isChosen = showChosen && k === chosen;
          if (isAnswer) {
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-xl border border-ok-line bg-ok-bg px-3 py-2.5">
                <Icon name="check" className="text-ok" />
                <span className="flex-1 text-[15px]">
                  {k}. {q.options[k]}
                </span>
                <span className="text-xs text-ok">{isChosen ? "আপনার উত্তর · সঠিক" : "সঠিক উত্তর"}</span>
              </div>
            );
          }
          if (isChosen) {
            return (
              <div key={k} className="flex items-center gap-2.5 rounded-xl border border-warn-line bg-[#22180f] px-3 py-2.5">
                <Icon name="x" className="text-warn" />
                <span className="flex-1 text-[15px]">
                  {k}. {q.options[k]}
                </span>
                <span className="text-xs text-warn">আপনার উত্তর</span>
              </div>
            );
          }
          return (
            <div key={k} className="flex items-center gap-2.5 px-3 py-1.5 text-[15px] text-muted">
              <span className="w-[18px]" />
              {k}. {q.options[k]}
            </div>
          );
        })}
        {showChosen && !chosen && <span className="text-xs text-muted">এই প্রশ্নের উত্তর দেননি</span>}
      </div>
      <div className="flex flex-col gap-1.5 rounded-xl bg-nav px-3.5 py-3">
        <span className="text-[13px] font-semibold text-accent">বই অনুযায়ী ব্যাখ্যা</span>
        <span className="text-sm leading-relaxed text-ink-2">{q.explanation || "এই প্রশ্নের ব্যাখ্যা বইয়ে নেই।"}</span>
        <span className="text-xs text-muted">
          {q.page ? `পৃষ্ঠা ${bn(q.page)}` : ""}
          {q.page && q.sources.length ? " · " : ""}
          {q.sources.map((s) => s.exam_name).join(", ")}
        </span>
      </div>
      {history.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">উত্তরের ইতিহাস</span>
          {history.map((h, i) => (
            <span
              key={i}
              title={h === "c" ? "সঠিক" : h === "w" ? "ভুল" : "বাদ"}
              className={`size-2.5 rounded-[3px] ${h === "c" ? "bg-ok" : h === "w" ? "bg-warn-bar" : "bg-line"}`}
            />
          ))}
          <span className="text-xs text-muted">
            {bn(history.length)} বারের মধ্যে {bn(history.filter((h) => h === "w").length)} বার ভুল
          </span>
        </div>
      )}
    </article>
  );
}
