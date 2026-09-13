"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  Loader2,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import QuestionEditor from "@/components/admin/QuestionEditor";

export default function EditQuestionPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const series =
    String(
      params?.series ||
        ""
    );

  const testId =
    String(
      params?.id ||
        ""
    );

  const questionId =
    String(
      params?.questionId ||
        ""
    );

  const [
    question,
    setQuestion,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================================================
     LOAD QUESTION
  ========================================================= */

  useEffect(() => {
    if (
      !series ||
      !testId ||
      !questionId
    ) {
      return;
    }

    let cancelled = false;

    async function loadQuestion() {
      try {
        setLoading(
          true
        );

        setError("");

        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              series
            )}/${encodeURIComponent(
              testId
            )}/questions/${encodeURIComponent(
              questionId
            )}`,
            {
              method: "GET",

              credentials:
                "include",

              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to load question."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        if (
          !data?.question
        ) {
          throw new Error(
            "Question data is missing."
          );
        }

        setQuestion(
          data.question
        );
      } catch (
        loadError
      ) {
        console.error(
          "Admin question load error:",
          loadError
        );

        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load question."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadQuestion();

    return () => {
      cancelled = true;
    };
  }, [
    series,
    testId,
    questionId,
  ]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    loading
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />

          Loading question...
        </div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (
    error ||
    !question
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-lg font-black text-slate-950">
            Unable to load question
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error ||
              "Question not found."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/admin/tests/${encodeURIComponent(
                  series
                )}/${encodeURIComponent(
                  testId
                )}/questions`
              )
            }
            className="mt-6 cursor-pointer rounded-xl bg-[#ef1118] px-5 py-2.5 text-sm font-black text-white"
          >
            Back to Questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <QuestionEditor
      mode="edit"
      initialQuestion={
        question
      }
      series={
        series
      }
      testId={
        testId
      }
    />
  );
}