"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  FileText,
  MinusCircle,
  RotateCcw,
  Target,
  XCircle,
} from "lucide-react";
import { useParams, useRouter, useSearchParams } from "next/navigation";

import SpiderManLoader from "@/components/common/SpiderManLoader";

function formatTime(seconds) {
  const total = Math.max(0, Number(seconds || 0));

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(secs).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}`;
}

function formatScore(value) {
  const number = Number(value || 0);

  return Number.isInteger(number) ? String(number) : number.toFixed(2);
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const series = params?.series;
  const id = params?.id;

  const attemptId = searchParams.get("attemptId");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!series || !id || !attemptId) {
      setError("Invalid result URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadResult() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `/api/test/${encodeURIComponent(series)}/${encodeURIComponent(
            id
          )}/result?attemptId=${encodeURIComponent(attemptId)}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Unable to load result.");
        }

        if (!cancelled) {
          setResult(data.result || null);
        }
      } catch (err) {
        console.error("Result page error:", err);

        if (!cancelled) {
          setError(err?.message || "Unable to load result.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadResult();

    return () => {
      cancelled = true;
    };
  }, [series, id, attemptId]);

  const percentage = useMemo(() => {
    if (!result) return 0;

    const total = Number(result.totalMarks || 0);
    const score = Number(result.score || 0);

    if (total <= 0) return 0;

    return Number(((score / total) * 100).toFixed(1));
  }, [result]);

  const performanceMessage = useMemo(() => {
    if (!result) return "";

    if (percentage >= 80) {
      return "Excellent performance. Keep pushing!";
    }

    if (percentage >= 60) {
      return "Good attempt. A little more practice can make it even stronger.";
    }

    if (percentage >= 40) {
      return "A decent attempt. Focus on accuracy and weak areas.";
    }

    return "Keep practicing. Every attempt helps you improve.";
  }, [result, percentage]);

  const openDetailedAnalysis = () => {
    if (!series || !id || !attemptId) return;

    router.push(
      `/test/${encodeURIComponent(series)}/${encodeURIComponent(
        id
      )}/analysis?attemptId=${encodeURIComponent(attemptId)}`
    );
  };

  const takeTestAgain = () => {
    router.push(
      `/test/${encodeURIComponent(series)}/${encodeURIComponent(
        id
      )}/instructions`
    );
  };

  if (loading) {
    return <SpiderManLoader text="Loading Result..." />;
  }

  if (error || !result) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-5">
        <div className="w-full max-w-[500px] rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-900">
            Unable to load result
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error || "Something went wrong while loading this result."}
          </p>

          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#d90f15]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const totalQuestions = Number(result.totalQuestions || 0);
  const attempted = Number(result.attempted || 0);
  const correct = Number(result.correct || 0);
  const wrong = Number(result.wrong || 0);
  const unanswered = Number(result.unanswered || 0);

  return (
    <main className="min-h-screen bg-[#f7f8fb]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-6xl items-center justify-between px-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="flex items-center gap-3 transition hover:opacity-80"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef1118] text-lg font-black italic text-white shadow-lg shadow-red-100">
              S
            </div>

            <div className="hidden text-left sm:block">
              <div className="text-[15px] font-extrabold tracking-tight text-slate-900">
                SpiderMan
              </div>

              <div className="text-[9px] font-bold tracking-[0.18em] text-slate-400">
                TEST SERIES
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => router.replace("/")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {/* PAGE TITLE */}
        <section className="mb-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#d70d14]">
              Test Completed
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
              Attempt #{result.attemptNumber}
            </span>
          </div>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            {result.test?.title || "Test Result"}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            {performanceMessage}
          </p>
        </section>

        {/* MAIN RESULT */}
        <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          {/* SCORE CARD */}
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-50" />

            <div className="relative">
              <div className="text-sm font-bold text-slate-500">
                Your Score
              </div>

              <div className="mt-2 flex items-end gap-3">
                <div className="text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
                  {formatScore(result.score)}
                </div>

                <div className="pb-2 text-lg font-bold text-slate-400">
                  / {formatScore(result.totalMarks)}
                </div>
              </div>

              {/* SCORE PROGRESS */}
              <div className="mt-6">
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-[#ef1118] transition-all duration-700"
                    style={{
                      width: `${Math.min(100, Math.max(0, percentage))}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    Percentage
                  </span>

                  <span className="text-sm font-black text-slate-900">
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* MAIN STATS */}
              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-green-100 bg-green-50/70 p-4">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />

                  <div className="mt-3 text-2xl font-black text-slate-900">
                    {correct}
                  </div>

                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Correct
                  </div>
                </div>

                <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
                  <XCircle className="h-5 w-5 text-red-500" />

                  <div className="mt-3 text-2xl font-black text-slate-900">
                    {wrong}
                  </div>

                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Wrong
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <MinusCircle className="h-5 w-5 text-slate-400" />

                  <div className="mt-3 text-2xl font-black text-slate-900">
                    {unanswered}
                  </div>

                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Skipped
                  </div>
                </div>

                <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4">
                  <Clock3 className="h-5 w-5 text-blue-600" />

                  <div className="mt-3 text-lg font-black text-slate-900">
                    {formatTime(result.timeTakenSeconds)}
                  </div>

                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
                    Time
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* PERFORMANCE SUMMARY */}
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-[#ef1118]">
                <BarChart3 className="h-5 w-5" />
              </div>

              <div>
                <div className="text-sm font-black text-slate-900">
                  Performance Summary
                </div>

                <div className="text-xs text-slate-400">
                  Your overall attempt
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-0">
              <div className="flex items-center justify-between border-b border-slate-100 py-4">
                <span className="text-sm text-slate-500">
                  Total Questions
                </span>

                <span className="text-sm font-black text-slate-900">
                  {totalQuestions}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 py-4">
                <span className="text-sm text-slate-500">Attempted</span>

                <span className="text-sm font-black text-slate-900">
                  {attempted}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-100 py-4">
                <span className="text-sm text-slate-500">Accuracy</span>

                <span className="text-sm font-black text-slate-900">
                  {result.accuracy ?? 0}%
                </span>
              </div>

              <div className="flex items-center justify-between py-4">
                <span className="text-sm text-slate-500">Attempt</span>

                <span className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700">
                  #{result.attemptNumber}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION PERFORMANCE */}
        {result.sections?.length > 0 && (
          <section className="mt-5 rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:p-8">
            <div className="mb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                  <Target className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Section Performance
                  </h2>

                  <p className="mt-0.5 text-xs text-slate-400">
                    Quick overview of each section
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {result.sections.map((section) => {
                const sectionQuestions = Number(section.questionCount || 0);
                const sectionCorrect = Number(section.correct || 0);

                const sectionPercent =
                  sectionQuestions > 0
                    ? ((sectionCorrect / sectionQuestions) * 100).toFixed(1)
                    : "0.0";

                return (
                  <div
                    key={section.id}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-slate-900">
                          {section.sectionName}
                        </div>

                        <div className="mt-1 text-xs text-slate-400">
                          {sectionQuestions} questions
                        </div>
                      </div>

                      <div className="shrink-0 rounded-lg bg-white px-2.5 py-1.5 text-xs font-black text-slate-700 shadow-sm">
                        {sectionPercent}%
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-white p-3 text-center">
                        <div className="text-lg font-black text-green-600">
                          {section.correct}
                        </div>

                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Correct
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3 text-center">
                        <div className="text-lg font-black text-red-500">
                          {section.wrong}
                        </div>

                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Wrong
                        </div>
                      </div>

                      <div className="rounded-xl bg-white p-3 text-center">
                        <div className="text-lg font-black text-slate-500">
                          {section.unanswered}
                        </div>

                        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">
                          Blank
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                      <span className="text-xs font-bold text-slate-400">
                        Score
                      </span>

                      <span className="text-sm font-black text-slate-900">
                        {formatScore(section.score)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* DETAILED ANALYSIS CTA */}
        <section className="mt-5 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
          <div className="relative p-6 sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-red-50" />

            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-[#ef1118]">
                  <FileText className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-900">
                    Detailed Analysis
                  </h2>

                  <p className="mt-1 max-w-xl text-sm leading-6 text-slate-500">
                    Review every question, your answer, correct answer,
                    explanation and time spent in a dedicated review mode.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openDetailedAnalysis}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-100 transition hover:bg-[#d90f15] active:scale-[0.98]"
              >
                Open Detailed Analysis
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
          </div>
        </section>

        {/* BOTTOM ACTIONS */}
        <section className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>

          <button
            type="button"
            onClick={takeTestAgain}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-[#d90f15] active:scale-[0.98]"
          >
            <RotateCcw className="h-4 w-4" />
            Take Test Again
          </button>
        </section>

        <div className="h-8" />
      </div>
    </main>
  );
}