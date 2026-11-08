"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Chip, Header, LoadingScreen, Screen, Tag } from "@/components/ui";
import { Icon } from "@/components/icons";
import { groupTopics, useBookData } from "@/lib/data";
import { setState, useAppState } from "@/lib/store";
import { topicStats } from "@/lib/stats";
import { bn, bnPercent } from "@/lib/bn";

type Filter = "all" | "weak";

export default function Topics() {
  const state = useAppState();
  const { loading, books, book, questions } = useBookData(state.bookId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => groupTopics(questions), [questions]);
  const tstats = useMemo(
    () => new Map(topicStats(questions, state).map((t) => [t.topic, t])),
    [questions, state],
  );

  if (loading) return <LoadingScreen />;
  if (!book) {
    return (
      <Screen nav>
        <Header title="টপিক বাছুন" back="/" />
        <p className="text-muted">কোনো বইয়ের ডেটা পাওয়া যায়নি।</p>
      </Screen>
    );
  }

  const allTopics = groups.flatMap((g) => g.topics.map((t) => t.name));
  const selected = state.selectedTopics.filter((t) => allTopics.includes(t));
  const selectedSet = new Set(selected);
  const setSelected = (topics: string[]) => setState((s) => ({ ...s, bookId: book.id, selectedTopics: topics }));
  const toggle = (name: string) =>
    setSelected(selectedSet.has(name) ? selected.filter((t) => t !== name) : [...selected, name]);
  const allOn = selected.length === allTopics.length && allTopics.length > 0;
  const selectedCount = questions.filter((q) => selectedSet.has(q.topic)).length;

  const q = query.trim();
  const visible = groups
    .map((g) => ({
      ...g,
      topics: g.topics.filter((t) => {
        if (q && !t.name.includes(q) && !g.chapter.includes(q)) return false;
        if (filter === "weak") {
          const st = tstats.get(t.name);
          return !!st && st.attempted >= 3 && st.accuracy < 0.5;
        }
        return true;
      }),
    }))
    .filter((g) => g.topics.length);

  return (
    <Screen
      footer={
        <div className="flex items-center gap-3">
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-semibold">{bn(selected.length)}টি টপিক বাছাই করা</span>
            <span className="text-xs text-muted">
              {selected.length ? `${bn(selectedCount)}টি প্রশ্ন থেকে পরীক্ষা হবে` : "অন্তত একটি টপিক বাছুন"}
            </span>
          </div>
          <Link
            href="/setup"
            aria-disabled={!selected.length}
            onClick={(e) => !selected.length && e.preventDefault()}
            className={`flex h-12 items-center rounded-[14px] px-5 text-[15px] font-bold ${
              selected.length ? "bg-accent text-accent-ink" : "bg-surface-2 text-dim"
            }`}
          >
            পরবর্তী
          </Link>
        </div>
      }
    >
      <Header title="টপিক বাছুন" subtitle={book.title} back="/" />

      {books.length > 1 && (
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          বই
          <select
            value={book.id}
            onChange={(e) => setState((s) => ({ ...s, bookId: e.target.value, selectedTopics: [] }))}
            className="h-11 rounded-[14px] border border-line bg-surface px-3 text-sm text-ink"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="flex h-[46px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5">
        <Icon name="search" className="text-muted" />
        <span className="sr-only">টপিক খুঁজুন</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="টপিক খুঁজুন… যেমন সন্ধি"
          className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-dim"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Chip active={allOn} onClick={() => setSelected(allOn ? [] : allTopics)}>
          সব সিলেবাস
        </Chip>
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>
          সব টপিক
        </Chip>
        <Chip active={filter === "weak"} onClick={() => setFilter("weak")}>
          শুধু দুর্বল
        </Chip>
      </div>

      {visible.length === 0 && <p className="text-sm text-muted">কোনো টপিক মেলেনি।</p>}

      {visible.map((g, gi) => {
        const isOpen = open[g.chapter] ?? (gi === 0 || !!q || filter === "weak");
        const chosenHere = g.topics.filter((t) => selectedSet.has(t.name)).length;
        const groupAll = chosenHere === g.topics.length;
        return (
          <div key={g.chapter} className="overflow-hidden rounded-[18px] border border-line bg-surface">
            <div className="flex items-center gap-2 border-b border-line px-4 py-3">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((o) => ({ ...o, [g.chapter]: !isOpen }))}
                className="flex min-h-11 flex-1 items-center justify-between text-left"
              >
                <span className="flex flex-col">
                  <span className="text-[15px] font-semibold">{g.chapter}</span>
                  <span className="text-xs text-muted">
                    {bn(g.topics.length)}টি টপিক · {bn(g.topics.reduce((s, t) => s + t.total, 0))} প্রশ্ন
                  </span>
                </span>
                <Icon name="chevron" className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const names = g.topics.map((t) => t.name);
                  setSelected(
                    groupAll
                      ? selected.filter((t) => !names.includes(t))
                      : [...new Set([...selected, ...names])],
                  );
                }}
                className="min-h-11 px-2 text-xs font-semibold text-accent"
              >
                {groupAll ? "সব বাদ" : chosenHere ? `${bn(chosenHere)}টি বাছাই` : "সব বাছুন"}
              </button>
            </div>
            {isOpen &&
              g.topics.map((t) => {
                const st = tstats.get(t.name);
                const tried = st && st.attempted > 0;
                return (
                  <label
                    key={t.name}
                    className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-surface-2 px-4 py-2.5 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSet.has(t.name)}
                      onChange={() => toggle(t.name)}
                      className="size-5 accent-accent"
                    />
                    <span className="flex flex-1 flex-col gap-1">
                      <span className="text-sm">{t.name}</span>
                      <span className="flex gap-1.5 text-[11px] text-muted">
                        {t.bcsTimes > 0 && <Tag tone="info">বিসিএস {bn(t.bcsTimes)} বার</Tag>}
                        <span>মোট {bn(t.total)} প্রশ্ন</span>
                      </span>
                    </span>
                    <span
                      className={`font-num text-[13px] ${
                        !tried ? "text-muted" : st.accuracy < 0.5 ? "text-warn" : "text-ok"
                      }`}
                    >
                      {tried ? bnPercent(st.accuracy) : "নতুন"}
                    </span>
                  </label>
                );
              })}
          </div>
        );
      })}
    </Screen>
  );
}
