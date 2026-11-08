"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Chip, EmptyState, Header, LoadingScreen, PrimaryLink, Screen } from "@/components/ui";
import { ReviewCard } from "@/components/ReviewCard";
import { useBookData } from "@/lib/data";
import { findExam, useAppState } from "@/lib/store";
import { itemResult } from "@/lib/exam";
import { bn } from "@/lib/bn";

type Filter = "all" | "wrong" | "again" | "skipped";
const PAGE = 20;

export default function Review() {
  const params = useSearchParams();
  const state = useAppState();
  const exam = findExam(state, params.get("id"));
  const { loading, questions, byId } = useBookData(exam?.bookId ?? state.bookId);
  const [filter, setFilter] = useState<Filter>("wrong");
  const [limit, setLimit] = useState(PAGE);

  if (loading) return <LoadingScreen />;

  // Without an exam id: the "wrong bank" — every question whose last attempt was wrong.
  if (!exam) {
    const bank = questions
      .filter((q) => state.stats[q.id]?.last === "w")
      .sort((a, b) => state.stats[b.id].wrong - state.stats[a.id].wrong);
    return (
      <Screen nav>
        <Header title="ভুল প্রশ্নের রিভিউ" subtitle={`${bn(bank.length)}টি প্রশ্ন — বেশি ভুল আগে`} />
        {bank.length === 0 ? (
          <EmptyState
            title="কোনো ভুল প্রশ্ন জমা নেই"
            text="পরীক্ষায় যেসব প্রশ্ন ভুল হবে, সেগুলো এখানে জমা হবে। পরের পরীক্ষায় এর থেকে ২৫টি আবার আসবে।"
            action={<PrimaryLink href="/topics" className="mt-2 w-full">পরীক্ষা দিন</PrimaryLink>}
          />
        ) : (
          <>
            {bank.slice(0, limit).map((q) => (
              <ReviewCard key={q.id} q={q} chosen={null} showChosen={false} stat={state.stats[q.id]} />
            ))}
            {bank.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="min-h-11 text-sm text-accent">
                আরও দেখুন
              </button>
            )}
          </>
        )}
      </Screen>
    );
  }

  const rows = exam.items.map((it, i) => ({ it, i, q: byId.get(it.qid), r: itemResult(it, byId.get(it.qid)) }));
  const counts = {
    all: rows.length,
    wrong: rows.filter((x) => x.r === "w").length,
    again: rows.filter((x) => x.it.wasWrongLast).length,
    skipped: rows.filter((x) => x.r === "s").length,
  };
  const shown = rows.filter((x) =>
    filter === "all" ? true : filter === "wrong" ? x.r === "w" : filter === "again" ? x.it.wasWrongLast : x.r === "s",
  );
  const pick = (f: Filter) => {
    setFilter(f);
    setLimit(PAGE);
  };

  return (
    <Screen>
      <Header title="ব্যাখ্যা ও রিভিউ" back={`/result?id=${exam.id}`} />
      <div className="flex flex-wrap gap-2">
        <Chip active={filter === "all"} onClick={() => pick("all")}>সব {bn(counts.all)}</Chip>
        <Chip active={filter === "wrong"} onClick={() => pick("wrong")}>ভুল {bn(counts.wrong)}</Chip>
        <Chip active={filter === "again"} onClick={() => pick("again")}>আগেও ভুল ছিল {bn(counts.again)}</Chip>
        <Chip active={filter === "skipped"} onClick={() => pick("skipped")}>বাদ {bn(counts.skipped)}</Chip>
      </div>
      {shown.length === 0 && <p className="text-sm text-muted">এই তালিকায় কোনো প্রশ্ন নেই।</p>}
      {shown.slice(0, limit).map(({ it, i, q }) =>
        q ? (
          <ReviewCard key={it.qid} index={i} q={q} chosen={it.chosen} wasWrongBefore={it.wasWrongLast} stat={state.stats[q.id]} />
        ) : null,
      )}
      {shown.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="min-h-11 text-sm text-accent">
          আরও দেখুন
        </button>
      )}
    </Screen>
  );
}
