"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { marked } from "marked";
import { EmptyState, Header, LoadingScreen, Screen } from "@/components/ui";
import { Icon } from "@/components/icons";
import { useBookData, useNotes } from "@/lib/data";
import { setState, useAppState } from "@/lib/store";
import { bn } from "@/lib/bn";

/** Notes come from our own OCR pipeline; raw HTML in them is shown as text, never run. */
function renderMarkdown(md: string): string {
  const escaped = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return marked.parse(escaped, { async: false, gfm: true, breaks: true }) as string;
}

export default function Read() {
  const params = useSearchParams();
  const state = useAppState();
  const { loading, books, book, questions } = useBookData(state.bookId);
  const notes = useNotes(book);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const topicName = params.get("t");
  const chapterName = params.get("c");
  const findTopic = () => {
    if (!topicName) return null;
    for (const c of notes.chapters) {
      if (chapterName && c.chapter !== chapterName) continue;
      const t = c.topics.find((x) => x.topic === topicName);
      if (t) return { chapter: c.chapter, ...t };
    }
    return null;
  };
  const selected = findTopic();

  if (loading || notes.loading) return <LoadingScreen />;

  // One topic: its notes, and a shortcut to an exam on the same topic.
  if (topicName) {
    const hasQuestions = questions.some((q) => q.topic === topicName);
    return (
      <Screen nav>
        <Header title={topicName} subtitle={selected?.chapter ?? book?.title} back="/read" />
        {!selected ? (
          <EmptyState title="নোট পাওয়া যায়নি" text="এই টপিকের জন্য বইয়ে আলাদা কোনো নোট নেই।" />
        ) : (
          selected.blocks.map((b, i) => (
            <article key={i} className="rounded-[18px] border border-line bg-surface p-4">
              {b.heading && <h2 className="mb-2 text-base font-semibold text-accent">{b.heading}</h2>}
              <div className="notes-md" dangerouslySetInnerHTML={{ __html: renderMarkdown(b.md) }} />
              <p className="mt-3 text-xs text-muted">বইয়ের পৃষ্ঠা (PDF) {bn(b.page)}</p>
            </article>
          ))
        )}
        {hasQuestions && (
          <Link
            href="/setup"
            onClick={() => setState((s) => ({ ...s, bookId: book?.id ?? s.bookId, selectedTopics: [topicName] }))}
            className="mt-1 flex h-[52px] items-center justify-center rounded-[14px] bg-accent text-base font-bold text-accent-ink"
          >
            এই টপিকে পরীক্ষা দিন
          </Link>
        )}
      </Screen>
    );
  }

  const q = query.trim();
  const chapters = notes.chapters
    .map((c) => ({ ...c, topics: c.topics.filter((t) => !q || t.topic.includes(q) || c.chapter.includes(q)) }))
    .filter((c) => c.topics.length);

  return (
    <Screen nav>
      <Header title="পড়ুন" subtitle={book?.title} />

      {books.length > 1 && (
        <label className="flex flex-col gap-1 text-[13px] text-muted">
          বই
          <select
            value={book?.id}
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

      {notes.chapters.length === 0 ? (
        <EmptyState
          title="এই বইয়ের নোট এখনো যোগ হয়নি"
          text="বইয়ের বর্ণনা, টেবিল আর লিখিত প্রশ্নোত্তর এখানে টপিক ধরে পড়া যাবে।"
        />
      ) : (
        <>
          <label className="flex h-[46px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5">
            <Icon name="search" className="text-muted" />
            <span className="sr-only">টপিক খুঁজুন</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="টপিক খুঁজুন… যেমন সমাস"
              className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-dim"
            />
          </label>
          {chapters.map((c, ci) => {
            const isOpen = open[c.chapter] ?? (ci === 0 || !!q);
            return (
              <div key={c.chapter} className="overflow-hidden rounded-[18px] border border-line bg-surface">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [c.chapter]: !isOpen }))}
                  className="flex min-h-11 w-full items-center justify-between border-b border-line px-4 py-3 text-left"
                >
                  <span className="flex flex-col">
                    <span className="text-[15px] font-semibold">{c.chapter}</span>
                    <span className="text-xs text-muted">{bn(c.topics.length)}টি টপিক</span>
                  </span>
                  <Icon name="chevron" className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>
                {isOpen &&
                  c.topics.map((t) => (
                    <Link
                      key={t.topic}
                      href={`/read?c=${encodeURIComponent(c.chapter)}&t=${encodeURIComponent(t.topic)}`}
                      className="flex min-h-11 items-center gap-3 border-b border-surface-2 px-4 py-2.5 last:border-b-0"
                    >
                      <span className="flex-1 text-sm">{t.topic}</span>
                      <span className="text-xs text-muted">{bn(t.blocks.length)}টি অংশ</span>
                      <Icon name="right" className="text-muted" />
                    </Link>
                  ))}
              </div>
            );
          })}
          {chapters.length === 0 && <p className="text-sm text-muted">কোনো টপিক মেলেনি।</p>}
        </>
      )}
    </Screen>
  );
}
