"use client";

import { useEffect, useState } from "react";
import type { BookInfo, Question } from "./types";

const questionCache = new Map<string, Promise<Question[]>>();
let booksPromise: Promise<BookInfo[]> | null = null;

export function fetchBooks(): Promise<BookInfo[]> {
  booksPromise ??= fetch("/data/books.json")
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []);
  return booksPromise;
}

export function fetchQuestions(book: BookInfo): Promise<Question[]> {
  let p = questionCache.get(book.id);
  if (!p) {
    p = fetch(`/data/${book.file}`)
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    questionCache.set(book.id, p);
  }
  return p;
}

export interface BookData {
  loading: boolean;
  books: BookInfo[];
  book: BookInfo | null;
  questions: Question[];
  byId: Map<string, Question>;
}

/** Loads the book list and the questions of the chosen (or first) book. */
export function useBookData(bookId: string | null): BookData {
  const [data, setData] = useState<BookData>({
    loading: true,
    books: [],
    book: null,
    questions: [],
    byId: new Map(),
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      const books = await fetchBooks();
      const book = books.find((b) => b.id === bookId) ?? books[0] ?? null;
      const questions = book ? await fetchQuestions(book) : [];
      if (!alive) return;
      setData({
        loading: false,
        books,
        book,
        questions,
        byId: new Map(questions.map((q) => [q.id, q])),
      });
    })();
    return () => {
      alive = false;
    };
  }, [bookId]);

  return data;
}

export interface TopicGroup {
  chapter: string;
  topics: { name: string; total: number; bcsTimes: number }[];
}

export function groupTopics(questions: Question[]): TopicGroup[] {
  const chapters = new Map<string, Map<string, { total: number; bcsTimes: number }>>();
  for (const q of questions) {
    const ch = q.chapter || q.subject;
    if (!chapters.has(ch)) chapters.set(ch, new Map());
    const t = chapters.get(ch)!;
    const cur = t.get(q.topic) ?? { total: 0, bcsTimes: 0 };
    cur.total += 1;
    cur.bcsTimes += q.bcs_count;
    t.set(q.topic, cur);
  }
  return [...chapters.entries()].map(([chapter, t]) => ({
    chapter,
    topics: [...t.entries()].map(([name, v]) => ({ name, ...v })),
  }));
}
