"use client";

import { useCallback, useState } from "react";

import { ArrowLeft, CheckCircle2, Loader2, Upload, UploadCloud } from "lucide-react";

import { useParams, useRouter } from "next/navigation";

const SAMPLE = [
  {
    questionText: "What is the time complexity of binary search?",
    questionType: "mcq",
    marks: 1,
    negativeMarks: 0.25,
    sectionId: null,
    explanation: "Binary search halves the search space each step.",
    options: [
      { text: "O(n)", isCorrect: false },
      { text: "O(log n)", isCorrect: true },
      { text: "O(n log n)", isCorrect: false },
      { text: "O(1)", isCorrect: false },
    ],
  },
];

export default function BulkImportQuestionsPage() {
  const params = useParams();
  const router = useRouter();

  const series = String(params?.series || "");
  const testId = String(params?.id || "");

  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const handleFile = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result || ""));
    reader.readAsText(file);
  }, []);

  const submit = async () => {
    if (submitting) return;

    setError("");
    setResult(null);

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError("That isn't valid JSON. Paste an array of question objects.");
      return;
    }

    const questions = Array.isArray(parsed) ? parsed : parsed?.questions;

    if (!Array.isArray(questions) || questions.length === 0) {
      setError('Provide a non-empty JSON array (or { "questions": [...] }).');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(
        `/api/admin/tests/${encodeURIComponent(series)}/${encodeURIComponent(testId)}/questions/bulk`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ questions }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Import failed.");
      }

      setResult(data);
    } catch (submitError) {
      console.error("Bulk question import error:", submitError);
      setError(submitError?.message || "Import failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          router.push(`/admin/tests/${encodeURIComponent(series)}/${encodeURIComponent(testId)}/questions`)
        }
        className="inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to questions
      </button>

      <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950">
        Bulk import questions
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Paste a JSON array of question objects, or upload a .json file. Every
        row is validated before anything is saved — if any row fails, nothing
        is imported and you get the full list of issues back. New questions
        are always appended at the end of the test.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
              Questions JSON
            </label>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" />
              Upload .json
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={JSON.stringify(SAMPLE, null, 2)}
            rows={20}
            spellCheck={false}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-white p-4 font-mono text-xs text-slate-800 shadow-sm focus:border-[#ef1118] focus:outline-none"
          />

          {error ? (
            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {error}
            </div>
          ) : null}

          {result ? (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-black">{result.message}</p>
                <p className="mt-1 text-xs text-emerald-600">
                  {result.insertedOptions} option row(s) saved · next question
                  order starts at {result.nextQuestionOrder}
                </p>
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={submit}
            disabled={submitting || !text.trim()}
            className="mt-5 inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-5 text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <UploadCloud className="h-4.5 w-4.5" />
            )}
            Validate & import
          </button>
        </div>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-500 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Expected shape
          </p>
          <p className="mt-2">Each question object supports:</p>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li><code>questionText</code> or <code>questionImageUrl</code></li>
            <li><code>questionType</code>: mcq / msq / numeric / true_false (default mcq)</li>
            <li><code>marks</code>, <code>negativeMarks</code></li>
            <li><code>sectionId</code> (optional, must belong to this test)</li>
            <li><code>explanation</code> (optional)</li>
            <li>
              <code>options</code>: array of <code>{"{ text, isCorrect }"}</code>{" "}
              — not needed for numeric
            </li>
          </ul>
          <p className="mt-3">
            Limit: 300 questions per import. Larger banks — split into a few
            requests.
          </p>

          <p className="mt-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            Math / LaTeX
          </p>
          <p className="mt-2">
            <code>questionText</code>, <code>explanation</code> and each option{" "}
            <code>text</code> support LaTeX: wrap it in{" "}
            <code>{"$...$"}</code> for inline or <code>{"$$...$$"}</code> for a
            centred line. In JSON every backslash must be doubled, e.g.{" "}
            <code>{'"$\\frac{1}{2}$"'}</code>. Diagrams still go in{" "}
            <code>questionImageUrl</code>.
          </p>
        </aside>
      </div>
    </div>
  );
}