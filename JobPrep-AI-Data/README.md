# JobPrep AI — Data Folder

Source books → clean, structured MCQ data for the JobPrep AI app (topic-wise exams, priority ranking, AI explanations).

## Folder structure

| Folder | What goes here |
|---|---|
| `01_raw_pdfs/` | Original PDFs, untouched |
| `02_extracted_text/` | OCR output, one `.txt` per page (`<book_id>/page_0001.txt`) |
| `03_structured_json/` | Final questions, `<book_id>.jsonl`, one question per line (see schema) |
| `04_review/` | Low-confidence questions that need human checking |
| `schema/` | `question.schema.json` — the data format the app reads |

## Books

| book_id | File | Pages | Type | Status |
|---|---|---|---|---|
| `agrodut_bangla_10_2026` | `01_raw_pdfs/agrodut_bangla_10_2026.pdf` | 854 | Phone photos of pages, no text layer | Done: 10,638 questions, 325 topics, in the app (OCR: gemini-3.5-flash-lite; 4 chunks gemini-3.6-flash) |
| `demo_bangla` | — | — | Hand-written sample questions (exam tags are placeholders) | Kept for testing; not listed in the app |

## Pipeline (Gemini, Node.js only)

One-time setup:

```
cd JobPrep-AI-Data/scripts
npm install
copy ..\.env.example ..\.env      # then paste your GEMINI_API_KEY into .env
```

Per book (`<book_id>` = PDF file name in `01_raw_pdfs/` without `.pdf`):

```
node split-pdf.mjs agrodut_bangla_10_2026 --pages 5          # 854 pages -> 171 small PDFs
node ocr-gemini.mjs agrodut_bangla_10_2026 --limit 2         # try 2 chunks first, check the output
node ocr-gemini.mjs agrodut_bangla_10_2026                   # then the rest (re-run to resume/retry)
# Free tier: --model gemini-3.5-flash-lite --fallback gemini-3.5-flash-lite (gemini-3.8-flash allows only 20 requests/day)
node build-dataset.mjs agrodut_bangla_10_2026 --title "অগ্রদূত বাংলা (১০ম সংস্করণ)" --subject বাংলা --sections "1:বাংলা সাহিত্য,321:বাংলা ব্যাকরণ,811:বিসিএস প্রিলিমিনারি প্রশ্ন"
```

What each step does:

1. **split-pdf** — the PDF has no text layer and is 222 MB, so it is cut into 5-page PDFs that Gemini accepts.
2. **ocr-gemini** — sends each chunk to Gemini, which reads the scanned Bangla and returns every MCQ as JSON (question, ক/খ/গ/ঘ, answer, explanation, exam tags, chapter/topic, page, confidence). Output: `02_extracted_text/<book_id>/chunk_XXXX.json`. Finished chunks are skipped on re-run; errors go to `_errors.log`.
3. **build-dataset** — merges chunks, removes duplicates (merging their exam tags), classifies tags (বিসিএস → BCS, ব্যাংক → BANK, পিএসসি/কর্ম কমিশন → PSC, else OTHER) and computes:
   - `priority`: 1 = BCS 2+ times, 2 = BCS once, 3 = PSC, 4 = Bank, 5 = other
   - `negative_mark`: 0.50 if any BCS or Bank tag, else 0.25
   - Questions with a missing answer/option, or confidence < 0.7, are listed in `04_review/` for checking.
   - Publishes to `03_structured_json/<book_id>.jsonl` **and** `jobprep-app/public/data/` (the app picks it up automatically).

Notes:
- `--sections` maps PDF page ranges to the book's parts (look at the table of contents). In a part whose name contains "বিসিএস", each past paper (e.g. "৪০তম বিসিএস") becomes its own topic, and its questions also credit the same question in the topic chapters.
- Several keys can be listed in `.env` as `GEMINI_API_KEY`, `GEMINI_API_KEY_2`, …; when one hits its daily quota the next is used.
- Known limits of the lite OCR: some exam-tag digits and spellings are misread, and only questions the book explains have an explanation. Re-running with `--model gemini-3.8-flash --redo` (paid tier) improves this.
- After an OCR run, `node fix-chunks.mjs <book_id>` turns sideways page photos upright and re-queues chunks that returned fewer than 10 questions (the lite model sometimes returns an empty result for a full page). Then run `ocr-gemini.mjs` again and rebuild. Pages that are only tables or prose (e.g. বাক্য সংকোচন lists) correctly give 0 MCQs.
