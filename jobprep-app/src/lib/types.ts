export type OptionKey = "ক" | "খ" | "গ" | "ঘ";
export const OPTION_KEYS: OptionKey[] = ["ক", "খ", "গ", "ঘ"];

export type ExamType = "BCS" | "PSC" | "BANK" | "OTHER";

export interface QuestionSource {
  exam_type: ExamType;
  exam_name: string;
  year?: number | null;
}

/** Matches JobPrep-AI-Data/schema/question.schema.json */
export interface Question {
  id: string;
  book_id: string;
  page?: number | null;
  subject: string;
  chapter?: string;
  topic: string;
  subtopic?: string | null;
  question: string;
  options: Record<OptionKey, string>;
  answer: OptionKey;
  explanation?: string | null;
  sources: QuestionSource[];
  bcs_count: number;
  /** 1 = BCS repeated, 2 = BCS once, 3 = PSC, 4 = Bank, 5 = other */
  priority: 1 | 2 | 3 | 4 | 5;
  negative_mark: number;
}

export interface BookInfo {
  id: string;
  title: string;
  subject: string;
  file: string;
  demo?: boolean;
  /** Reading notes file (study text, tables, written Q&A), if the book has one */
  notes?: string;
}

export interface NoteBlock {
  page: number;
  heading: string;
  md: string;
}

export interface NoteTopic {
  topic: string;
  blocks: NoteBlock[];
}

export interface NoteChapter {
  chapter: string;
  topics: NoteTopic[];
}

export type AttemptResult = "c" | "w" | "s"; // correct, wrong, skipped

export interface QuestionStat {
  seen: number;
  correct: number;
  wrong: number;
  last: AttemptResult;
  history: AttemptResult[];
  lastAt: number;
}

export type ItemKind = "new" | "wrong" | "repeat";

export interface ExamItem {
  qid: string;
  kind: ItemKind;
  chosen: OptionKey | null;
  /** Wrong count for this question before this exam started */
  wrongBefore: number;
  /** Whether the last attempt before this exam was wrong */
  wasWrongLast: boolean;
}

export interface ExamRecord {
  id: string;
  bookId: string;
  topics: string[];
  createdAt: number;
  finishedAt: number | null;
  timed: boolean;
  negative: boolean;
  durationSec: number | null;
  items: ExamItem[];
  current: number;
  score?: ExamScore;
}

export interface ExamScore {
  total: number;
  correct: number;
  wrong: number;
  skipped: number;
  negative: number;
  marks: number;
  wrongAgain: number;
  prevWrongCount: number;
  elapsedSec: number;
}

export interface AppState {
  v: 1;
  bookId: string | null;
  selectedTopics: string[];
  stats: Record<string, QuestionStat>;
  exams: ExamRecord[];
  activeExamId: string | null;
}
