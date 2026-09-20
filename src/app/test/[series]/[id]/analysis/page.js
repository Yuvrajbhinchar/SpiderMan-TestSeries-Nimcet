"use client";

import {
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";



import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock3,
  Flag,
  Menu,
  X,
} from "lucide-react";

import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import SpiderManLoader from "@/components/common/SpiderManLoader";

import MathText, {
  MathTextInline,
} from "@/components/common/MathText";

/* =========================================================
   PALETTE STATUS
========================================================= */

const STATUS = {
  NOT_VISITED: "not_visited",
  NOT_ANSWERED: "not_answered",
  ANSWERED: "answered",
  REVIEW: "review",
  ANSWERED_REVIEW: "answered_review",
};

/* =========================================================
   FILTERS
========================================================= */

const FILTERS = {
  ALL: "all",
  ANSWERED: "answered",
  CORRECT: "correct",
  INCORRECT: "incorrect",
  UNANSWERED: "unanswered",
  REVIEW: "review",
};

/* =========================================================
   TIME FORMAT
========================================================= */

function formatTime(seconds) {
  const total = Math.max(
    0,
    Number(seconds || 0)
  );

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const secs = total % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

/* =========================================================
   PALETTE ICON
   SAME SHAPE LANGUAGE AS ATTEMPT PAGE
========================================================= */

function PaletteIcon({
  status,
  number,
  current = false,
}) {
  const base =
    "relative flex h-[42px] w-[42px] items-center justify-center text-[13px] font-bold transition-all duration-150";

  /* -------------------------------------------------------
     NOT VISITED
  ------------------------------------------------------- */

  if (
    status === STATUS.NOT_VISITED
  ) {
    return (
      <div
        className={`${base} rounded-[4px] border border-[#94a3b8] bg-gradient-to-b from-white to-[#e1e1e1] text-[#1e293b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] ${
          current
            ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
            : ""
        }`}
      >
        {number}
      </div>
    );
  }

  /* -------------------------------------------------------
     NOT ANSWERED
  ------------------------------------------------------- */

  if (
    status === STATUS.NOT_ANSWERED
  ) {
    return (
      <div
        className={`${base} rounded-[2px] bg-gradient-to-b from-[#e25822] to-[#b42711] text-white [clip-path:polygon(0%_0%,100%_0%,100%_75%,50%_100%,0%_75%)] ${
          current
            ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
            : ""
        }`}
      >
        {number}
      </div>
    );
  }

  /* -------------------------------------------------------
     ANSWERED
     SAME GREEN SHAPE AS ATTEMPT
  ------------------------------------------------------- */

  if (
    status === STATUS.ANSWERED
  ) {
    return (
      <div
        className={`${base} rounded-[2px] bg-gradient-to-b from-[#7fc142] to-[#478e17] text-white [clip-path:polygon(50%_0%,100%_25%,100%_100%,0%_100%,0%_25%)] ${
          current
            ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
            : ""
        }`}
      >
        {number}
      </div>
    );
  }

  /* -------------------------------------------------------
     REVIEW
  ------------------------------------------------------- */

  if (
    status === STATUS.REVIEW
  ) {
    return (
      <div
        className={`${base} rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.2)] ${
          current
            ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
            : ""
        }`}
      >
        {number}
      </div>
    );
  }

  /* -------------------------------------------------------
     ANSWERED + REVIEW
  ------------------------------------------------------- */

  return (
    <div
      className={`${base} rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-white ${
        current
          ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
          : ""
      }`}
    >
      {number}

      <span className="absolute -bottom-[2px] -right-[2px] flex h-[14px] w-[14px] items-center justify-center rounded-full border border-white bg-[#5ca817] text-[8px] font-extrabold leading-none text-white">
        ✓
      </span>
    </div>
  );
}

/* =========================================================
   LEGEND ICON
========================================================= */

function LegendIcon({
  type,
  count,
}) {
  const value =
    Number(count || 0);

  if (
    type === STATUS.ANSWERED
  ) {
    return (
      <div className="flex h-[30px] w-[34px] items-center justify-center rounded-[2px] bg-gradient-to-b from-[#7fc142] to-[#478e17] text-[11px] font-bold text-white [clip-path:polygon(50%_0%,100%_25%,100%_100%,0%_100%,0%_25%)]">
        {value}
      </div>
    );
  }

  if (
    type === STATUS.NOT_ANSWERED
  ) {
    return (
      <div className="flex h-[30px] w-[34px] items-center justify-center rounded-[2px] bg-gradient-to-b from-[#e25822] to-[#b42711] text-[11px] font-bold text-white [clip-path:polygon(0%_0%,100%_0%,100%_75%,50%_100%,0%_75%)]">
        {value}
      </div>
    );
  }

  if (
    type === STATUS.NOT_VISITED
  ) {
    return (
      <div className="flex h-[28px] w-[32px] items-center justify-center rounded-[4px] border border-[#94a3b8] bg-gradient-to-b from-white to-[#e1e1e1] text-[11px] font-bold text-[#1e293b]">
        {value}
      </div>
    );
  }

  if (
    type === STATUS.REVIEW
  ) {
    return (
      <div className="flex h-[32px] w-[32px] items-center justify-center rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-[11px] font-bold text-white">
        {value}
      </div>
    );
  }

  return (
    <div className="relative flex h-[32px] w-[32px] items-center justify-center rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-[11px] font-bold text-white">
      {value}

      <span className="absolute -bottom-[2px] -right-[2px] flex h-[12px] w-[12px] items-center justify-center rounded-full border border-white bg-[#5ca817] text-[7px] font-extrabold text-white">
        ✓
      </span>
    </div>
  );
}

/* =========================================================
   MAIN PAGE
========================================================= */

export default function AnalysisPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const series =
    params?.series;

  const id =
    params?.id;

  const attemptId =
    searchParams.get(
      "attemptId"
    );

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [data, setData] =
    useState(null);

  /*
   * Store actual question ID instead of
   * array index so filtering never creates
   * navigation bugs.
   */
  const [
    currentQuestionId,
    setCurrentQuestionId,
  ] = useState(null);

  const [
    mobilePalette,
    setMobilePalette,
  ] = useState(false);

  const [
    questionFilter,
    setQuestionFilter,
  ] = useState(FILTERS.ALL);

  const questionBodyRef =
    useRef(null);

  /* =======================================================
     LOAD ANALYSIS
  ======================================================= */

  useEffect(() => {
    if (
      !series ||
      !id ||
      !attemptId
    ) {
      setLoadError(
        "Invalid analysis URL."
      );

      setLoading(false);

      return;
    }

    let cancelled = false;

    async function loadAnalysis() {
      try {
        setLoading(true);

        setLoadError("");

        const response =
          await fetch(
            `/api/test/${encodeURIComponent(
              String(series)
            )}/${encodeURIComponent(
              String(id)
            )}/analysis?attemptId=${encodeURIComponent(
              String(attemptId)
            )}`,
            {
              method: "GET",
              credentials: "include",
              cache: "no-store",
            }
          );

        const responseData =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (!response.ok) {
          if (
            response.status === 401 ||
            responseData?.code ===
              "SESSION_REVOKED"
          ) {
            const next =
              `${window.location.pathname}${window.location.search}`;

            router.replace(
              `/auth/login?next=${encodeURIComponent(
                next
              )}`
            );

            return;
          }

          throw new Error(
            responseData?.error ||
              "Unable to load detailed analysis."
          );
        }

        if (cancelled) {
          return;
        }

        const loadedQuestions =
          Array.isArray(
            responseData?.questions
          )
            ? responseData.questions
            : [];

        setData({
          ...responseData,
          questions:
            loadedQuestions,
        });

        if (
          loadedQuestions.length > 0
        ) {
          setCurrentQuestionId(
            Number(
              loadedQuestions[0].id
            )
          );
        }
      } catch (error) {
        console.error(
          "Analysis page error:",
          error
        );

        if (!cancelled) {
          setLoadError(
            error?.message ||
              "Unable to load detailed analysis."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalysis();

    return () => {
      cancelled = true;
    };
  }, [
    series,
    id,
    attemptId,
    router,
  ]);

  /* =======================================================
     DATA
  ======================================================= */

  const questions =
    data?.questions || [];

  const test =
    data?.test || null;

  const attempt =
    data?.attempt || null;

  const totalQuestions =
    questions.length;

  /* =======================================================
     QUESTION FILTER
     CLIENT SIDE ONLY
  ======================================================= */

  const filteredQuestions =
    useMemo(() => {
      switch (
        questionFilter
      ) {
        case FILTERS.ANSWERED:
          return questions.filter(
            (question) =>
              question.selectedOptionId !=
              null
          );

        case FILTERS.CORRECT:
          return questions.filter(
            (question) =>
              question.isCorrect ===
              true
          );

        case FILTERS.INCORRECT:
          return questions.filter(
            (question) =>
              question.isCorrect ===
              false
          );

        case FILTERS.UNANSWERED:
          return questions.filter(
            (question) =>
              question.selectedOptionId ==
              null
          );

        case FILTERS.REVIEW:
          return questions.filter(
            (question) =>
              question.markedForReview ===
              true
          );

        case FILTERS.ALL:
        default:
          return questions;
      }
    }, [
      questions,
      questionFilter,
    ]);

  /* =======================================================
     CURRENT QUESTION
  ======================================================= */

  const currentQuestionIndex =
    filteredQuestions.findIndex(
      (question) =>
        Number(question.id) ===
        Number(
          currentQuestionId
        )
    );

  const safeCurrentIndex =
    currentQuestionIndex >= 0
      ? currentQuestionIndex
      : 0;

  const currentQuestionData =
    filteredQuestions[
      safeCurrentIndex
    ] || null;

  /* =======================================================
     KEEP VALID QUESTION AFTER FILTER
  ======================================================= */

  useEffect(() => {
    if (
      filteredQuestions.length ===
      0
    ) {
      setCurrentQuestionId(
        null
      );
      return;
    }

    const currentStillExists =
      filteredQuestions.some(
        (question) =>
          Number(question.id) ===
          Number(
            currentQuestionId
          )
      );

    if (
      !currentStillExists
    ) {
      setCurrentQuestionId(
        Number(
          filteredQuestions[0].id
        )
      );
    }
  }, [
    filteredQuestions,
    currentQuestionId,
  ]);

  /* =======================================================
     PALETTE STATE
     SAME STATE STYLE AS ATTEMPT
  ======================================================= */

  const getQuestionPaletteState =
    (question) => {
      if (
        question?.markedForReview &&
        question?.selectedOptionId !=
          null
      ) {
        return STATUS.ANSWERED_REVIEW;
      }

      if (
        question?.markedForReview
      ) {
        return STATUS.REVIEW;
      }

      if (
        question?.selectedOptionId !=
        null
      ) {
        return STATUS.ANSWERED;
      }

      if (
        question?.visited
      ) {
        return STATUS.NOT_ANSWERED;
      }

      return STATUS.NOT_VISITED;
    };

  /* =======================================================
     PALETTE COUNTS
======================================================= */

  const paletteCounts =
    useMemo(() => {
      let answered = 0;

      let notAnswered = 0;

      let notVisited = 0;

      let review = 0;

      let answeredReview = 0;

      questions.forEach(
        (question) => {
          const status =
            getQuestionPaletteState(
              question
            );

          if (
            status ===
            STATUS.ANSWERED
          ) {
            answered += 1;
          } else if (
            status ===
            STATUS.NOT_ANSWERED
          ) {
            notAnswered += 1;
          } else if (
            status ===
            STATUS.NOT_VISITED
          ) {
            notVisited += 1;
          } else if (
            status ===
            STATUS.REVIEW
          ) {
            review += 1;
          } else if (
            status ===
            STATUS.ANSWERED_REVIEW
          ) {
            answeredReview += 1;
          }
        }
      );

      return {
        answered,
        notAnswered,
        notVisited,
        review,
        answeredReview,
      };
    }, [questions]);

  /* =======================================================
     NAVIGATION
======================================================= */

  const goToQuestion =
    (questionId) => {
      const exists =
        filteredQuestions.some(
          (question) =>
            Number(question.id) ===
            Number(questionId)
        );

      if (!exists) {
        return;
      }

      setCurrentQuestionId(
        Number(questionId)
      );

      setMobilePalette(
        false
      );
    };

  const nextQuestion =
    () => {
      if (
        !filteredQuestions.length
      ) {
        return;
      }

      const nextIndex =
        safeCurrentIndex + 1;

      if (
        nextIndex >=
        filteredQuestions.length
      ) {
        return;
      }

      setCurrentQuestionId(
        Number(
          filteredQuestions[
            nextIndex
          ].id
        )
      );
    };

  const previousQuestion =
    () => {
      if (
        !filteredQuestions.length
      ) {
        return;
      }

      const previousIndex =
        safeCurrentIndex - 1;

      if (
        previousIndex < 0
      ) {
        return;
      }

      setCurrentQuestionId(
        Number(
          filteredQuestions[
            previousIndex
          ].id
        )
      );
    };

  /* =======================================================
     SCROLL TOP ON QUESTION CHANGE
======================================================= */

  useEffect(() => {
    if (
      questionBodyRef.current
    ) {
      questionBodyRef.current.scrollTop = 0;
    }
  }, [
    currentQuestionId,
    questionFilter,
  ]);

  /* =======================================================
     FILTER LABEL
======================================================= */

  const filterLabel =
    useMemo(() => {
      switch (
        questionFilter
      ) {
        case FILTERS.ANSWERED:
          return "Answered";

        case FILTERS.CORRECT:
          return "Correct";

        case FILTERS.INCORRECT:
          return "Incorrect";

        case FILTERS.UNANSWERED:
          return "Unanswered";

        case FILTERS.REVIEW:
          return "Marked for Review";

        default:
          return "All Questions";
      }
    }, [questionFilter]);

  /* =======================================================
     BACK TO RESULT
======================================================= */

  const backToResult =
    () => {
      router.replace(
        `/test/${encodeURIComponent(
          String(series)
        )}/${encodeURIComponent(
          String(id)
        )}/result?attemptId=${encodeURIComponent(
          String(attemptId)
        )}`
      );
    };

  /* =======================================================
     LOADING
======================================================= */

  if (loading) {
    return (
      <SpiderManLoader
        text="Loading Analysis..."
      />
    );
  }

  /* =======================================================
     ERROR
======================================================= */

  if (
    loadError ||
    !data
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-5">
        <div className="w-full max-w-[520px] rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-black text-slate-900">
            Unable to load analysis
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {loadError ||
              "No completed attempt was found."}
          </p>

          <button
            type="button"
            onClick={backToResult}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-100 transition hover:bg-[#d90f15]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Result
          </button>
        </div>
      </main>
    );
  }

  /*
   * No questions in current filter.
   */
  const noFilteredQuestions =
    filteredQuestions.length === 0;

  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#f7f8fb]">
      {/* =====================================================
          HEADER
      ===================================================== */}

      <header className="z-40 flex h-[68px] shrink-0 items-center border-b border-slate-200 bg-white">
        <div className="flex w-full items-center justify-between px-4 sm:px-5 lg:px-7">
          {/* LEFT */}
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={
                  backToResult
                }
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
                title="Back to Result"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              <div className="min-w-0">
                <div className="truncate text-[15px] font-black text-slate-900 sm:text-[16px]">
                  {test?.title ||
                    "Test Analysis"}
                </div>

                <div className="mt-0.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <span>
                    Attempt #
                    {attempt?.attemptNumber ||
                      1}
                  </span>

                  <span className="text-slate-300">
                    •
                  </span>

                  <span className="text-[#ef1118]">
                    Detailed Analysis
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex items-center gap-2">
            {/* MOBILE QUESTIONS */}
            <button
              type="button"
              onClick={() =>
                setMobilePalette(
                  true
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
              Questions
            </button>

            {/* FILTER */}
            <div className="relative hidden sm:block">
              <select
                value={
                  questionFilter
                }
                onChange={(event) =>
                  setQuestionFilter(
                    event.target.value
                  )
                }
                className="h-[40px] appearance-none rounded-xl border border-slate-200 bg-white pl-3.5 pr-9 text-xs font-bold text-slate-600 outline-none transition hover:border-slate-300 focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
                aria-label="Filter questions"
              >
                <option
                  value={
                    FILTERS.ALL
                  }
                >
                  All Questions
                </option>

                <option
                  value={
                    FILTERS.ANSWERED
                  }
                >
                  Answered
                </option>

                <option
                  value={
                    FILTERS.CORRECT
                  }
                >
                  Correct
                </option>

                <option
                  value={
                    FILTERS.INCORRECT
                  }
                >
                  Incorrect
                </option>

                <option
                  value={
                    FILTERS.UNANSWERED
                  }
                >
                  Unanswered
                </option>

                <option
                  value={
                    FILTERS.REVIEW
                  }
                >
                  Marked for Review
                </option>
              </select>

              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>

            {/* TIMER */}
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 sm:flex">
              <Clock3 className="h-4 w-4 text-slate-400" />

              <span>
                {formatTime(
                  attempt?.timeTakenSeconds
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================
          MOBILE FILTER
      ===================================================== */}

      <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 sm:hidden">
        <div className="text-[11px] font-bold text-slate-400">
          Showing{" "}
          <span className="text-slate-700">
            {filteredQuestions.length}
          </span>{" "}
          questions
        </div>

        <div className="relative">
          <select
            value={
              questionFilter
            }
            onChange={(event) =>
              setQuestionFilter(
                event.target.value
              )
            }
            className="h-[36px] appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-[11px] font-bold text-slate-600 outline-none"
            aria-label="Filter questions"
          >
            <option
              value={
                FILTERS.ALL
              }
            >
              All Questions
            </option>

            <option
              value={
                FILTERS.ANSWERED
              }
            >
              Answered
            </option>

            <option
              value={
                FILTERS.CORRECT
              }
            >
              Correct
            </option>

            <option
              value={
                FILTERS.INCORRECT
              }
            >
              Incorrect
            </option>

            <option
              value={
                FILTERS.UNANSWERED
              }
            >
              Unanswered
            </option>

            <option
              value={
                FILTERS.REVIEW
              }
            >
              Marked for Review
            </option>
          </select>

          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      {/* =====================================================
          MAIN
      ===================================================== */}

      <main className="relative flex min-h-0 flex-1 overflow-hidden">
        {/* ===================================================
            QUESTION AREA
        =================================================== */}

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          {/* =================================================
              TOP QUESTION BAR
          ================================================= */}

          <div className="flex h-[70px] shrink-0 items-center gap-2 border-b border-slate-100 px-4 sm:gap-3 sm:px-5 lg:px-10">
            {currentQuestionData ? (
              <>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-600 sm:px-5 sm:text-sm">
                  Question{" "}
                  {
                    currentQuestionData.number
                  }
                </div>

                <div className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-600 sm:text-sm">
                  +
                  {
                    currentQuestionData.marks
                  }
                </div>

                <div className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-500 sm:text-sm">
                  -
                  {
                    currentQuestionData.negativeMarks
                  }
                </div>

                <div
                  className={`rounded-md px-3 py-1.5 text-[10px] font-extrabold sm:text-xs ${
                    currentQuestionData.isCorrect ===
                    true
                      ? "bg-green-100 text-green-700"
                      : currentQuestionData.isCorrect ===
                        false
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {currentQuestionData.isCorrect ===
                  true
                    ? "Correct"
                    : currentQuestionData.isCorrect ===
                      false
                      ? "Incorrect"
                      : "Unanswered"}
                </div>

                <div className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 sm:px-3">
                  <Clock3 className="h-4 w-4 text-slate-400" />

                  <span>
                    Time:{" "}
                    {formatTime(
                      currentQuestionData.timeSpentSeconds
                    )}
                  </span>
                </div>

                <div className="hidden items-center gap-1.5 text-sm font-semibold text-slate-400 lg:flex">
                  <Flag className="h-4 w-4" />
                  Review
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-slate-500">
                No questions found for{" "}
                {filterLabel}.
              </div>
            )}
          </div>

          {/* =================================================
              QUESTION BODY
          ================================================= */}

          <div
            ref={questionBodyRef}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            {noFilteredQuestions ? (
              <div className="flex min-h-full items-center justify-center px-5">
                <div className="w-full max-w-[440px] rounded-[24px] border border-slate-200 bg-white p-7 text-center shadow-sm">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <Flag className="h-5 w-5" />
                  </div>

                  <h2 className="mt-4 text-lg font-black text-slate-900">
                    No questions found
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    There are no questions matching{" "}
                    <span className="font-bold text-slate-700">
                      {filterLabel}
                    </span>
                    .
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      setQuestionFilter(
                        FILTERS.ALL
                      )
                    }
                    className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800"
                  >
                    Show All Questions
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 lg:px-10 lg:py-7">
                <div className="mx-auto max-w-[1000px]">
                  {/* QUESTION META */}
                  <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                    <div className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                      {currentQuestionData.subjectName ||
                        currentQuestionData.sectionName ||
                        "General"}
                    </div>

                    <div
                      className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${
                        currentQuestionData.isCorrect ===
                        true
                          ? "bg-green-100 text-green-700"
                          : currentQuestionData.isCorrect ===
                            false
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {currentQuestionData.selectedOptionId ==
                      null
                        ? "Not Attempted"
                        : currentQuestionData.isCorrect ===
                          true
                          ? "Your Answer is Correct"
                          : "Your Answer is Incorrect"}
                    </div>
                  </div>

                  {/* QUESTION */}
                  <MathText
                    text={
                      currentQuestionData.questionText
                    }
                    className="mb-9 whitespace-pre-wrap text-[20px] font-normal leading-[1.7] text-slate-800 sm:text-[21px]"
                  />

                  {/* OPTIONS */}
                  <div className="flex flex-col gap-4">
                    {(
                      currentQuestionData.options ||
                      []
                    ).map(
                      (option) => {
                        const isSelected =
                          Number(
                            option.id
                          ) ===
                          Number(
                            currentQuestionData.selectedOptionId
                          );

                        const isCorrect =
                          Number(
                            option.id
                          ) ===
                          Number(
                            currentQuestionData
                              .correctOption
                              ?.id
                          );

                        let optionClass =
                          "border-slate-200 bg-white";

                        let badgeClass =
                          "border-slate-300 bg-white text-slate-500";

                        /*
                         * CORRECT OPTION
                         */
                        if (
                          isCorrect
                        ) {
                          optionClass =
                            "border-green-500 bg-green-50 shadow-[0_4px_12px_rgba(34,197,94,0.10)]";

                          badgeClass =
                            "border-green-600 bg-green-600 text-white";
                        }

                        /*
                         * SELECTED WRONG OPTION
                         */
                        if (
                          isSelected &&
                          !isCorrect
                        ) {
                          optionClass =
                            "border-red-500 bg-red-50 shadow-[0_4px_12px_rgba(239,68,68,0.10)]";

                          badgeClass =
                            "border-red-600 bg-red-600 text-white";
                        }

                        /*
                         * SELECTED CORRECT
                         */
                        if (
                          isSelected &&
                          isCorrect
                        ) {
                          optionClass =
                            "border-green-500 bg-green-50 shadow-[0_4px_12px_rgba(34,197,94,0.10)]";

                          badgeClass =
                            "border-green-600 bg-green-600 text-white";
                        }

                        return (
                          <div
                            key={
                              option.id
                            }
                            className={`flex w-full items-center rounded-xl border-2 px-4 py-4 text-left sm:px-5 sm:py-5 ${optionClass}`}
                          >
                            {/* LABEL */}
                            <span
                              className={`mr-4 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 text-sm font-bold sm:mr-5 ${badgeClass}`}
                            >
                              {option.label ||
                                String.fromCharCode(
                                  65 +
                                    Number(
                                      option.order ||
                                        0
                                    )
                                )}
                            </span>

                            {/* TEXT */}
                            <MathTextInline
                              text={
                                option.text
                              }
                              className={`whitespace-pre-wrap text-[16px] leading-[1.6] sm:text-[17px] ${
                                isCorrect ||
                                isSelected
                                  ? "font-semibold text-slate-800"
                                  : "font-medium text-slate-700"
                              }`}
                            />

                            {/* RIGHT ICONS */}
                            <div className="ml-auto flex shrink-0 items-center pl-3">
                              {isCorrect && (
                                <Check className="h-5 w-5 text-green-600" />
                              )}

                              {isSelected &&
                                !isCorrect && (
                                  <X className="h-5 w-5 text-red-500" />
                                )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* EXPLANATION */}
                  {currentQuestionData.explanation ? (
                    <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
                      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-500">
                        Solution
                      </div>

                      <MathText
                        text={
                          currentQuestionData.explanation
                        }
                        className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.75] text-slate-700 sm:text-[16px]"
                      />
                    </div>
                  ) : null}

                  {/* REVIEWS COMING SOON */}
                  <div className="mt-7 rounded-2xl border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                        <Flag className="h-4 w-4" />
                      </div>

                      <div>
                        <div className="text-sm font-black text-slate-800">
                          Reviews available soon
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Detailed review and discussion
                          for this question will be
                          available soon.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* READ ONLY NOTE */}
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-400">
                    <Flag className="h-4 w-4" />

                    Review mode — submitted answers
                    cannot be changed.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* =================================================
              FOOTER
          ================================================= */}

          <div className="flex h-[74px] shrink-0 items-center justify-between border-t border-slate-100 bg-white px-4 sm:px-6 lg:px-10">
            <button
              type="button"
              onClick={
                backToResult
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Result
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={
                  noFilteredQuestions ||
                  safeCurrentIndex <=
                    0
                }
                onClick={
                  previousQuestion
                }
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>

              <button
                type="button"
                disabled={
                  noFilteredQuestions ||
                  safeCurrentIndex >=
                    filteredQuestions.length -
                      1
                }
                onClick={
                  nextQuestion
                }
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#ef1118] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-red-100 transition hover:bg-[#d90f15] disabled:cursor-not-allowed disabled:opacity-40 sm:px-4 sm:text-sm"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ===================================================
            DESKTOP PALETTE
        =================================================== */}

        <aside className="hidden w-[340px] shrink-0 border-l border-slate-200 bg-[#f8fafc] lg:flex lg:flex-col">
          {/* HEADER */}
          <div className="border-b border-slate-200 bg-white px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-black text-slate-900">
                  Question Palette
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  Review all questions
                </div>
              </div>

              <div className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-[10px] font-black text-slate-500">
                {filteredQuestions.length}/
                {totalQuestions}
              </div>
            </div>
          </div>

          {/* PALETTE CONTENT */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {/* LEGEND */}
            <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                Question Status
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.ANSWERED
                    }
                    count={
                      paletteCounts.answered
                    }
                  />

                  <span className="text-[10px] font-bold text-slate-500">
                    Answered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.NOT_ANSWERED
                    }
                    count={
                      paletteCounts.notAnswered
                    }
                  />

                  <span className="text-[10px] font-bold text-slate-500">
                    Not Answered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.NOT_VISITED
                    }
                    count={
                      paletteCounts.notVisited
                    }
                  />

                  <span className="text-[10px] font-bold text-slate-500">
                    Not Visited
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.REVIEW
                    }
                    count={
                      paletteCounts.review
                    }
                  />

                  <span className="text-[10px] font-bold text-slate-500">
                    Review
                  </span>
                </div>

                <div className="col-span-2 flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.ANSWERED_REVIEW
                    }
                    count={
                      paletteCounts.answeredReview
                    }
                  />

                  <span className="text-[10px] font-bold text-slate-500">
                    Answered & Review
                  </span>
                </div>
              </div>
            </div>

            {/* FILTER INFO */}
            <div className="mb-4 flex items-center justify-between">
              <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                {filterLabel}
              </div>

              <div className="text-[10px] font-bold text-slate-400">
                {
                  filteredQuestions.length
                }{" "}
                questions
              </div>
            </div>

            {/* QUESTIONS */}
            {filteredQuestions.length > 0 ? (
              <div className="grid grid-cols-5 gap-x-3 gap-y-4">
                {filteredQuestions.map(
                  (
                    question
                  ) => {
                    const status =
                      getQuestionPaletteState(
                        question
                      );

                    return (
                      <button
                        key={
                          question.id
                        }
                        type="button"
                        onClick={() =>
                          goToQuestion(
                            question.id
                          )
                        }
                        className="flex items-center justify-center"
                        title={`Question ${question.number}`}
                      >
                        <PaletteIcon
                          status={
                            status
                          }
                          number={
                            question.number
                          }
                          current={
                            Number(
                              currentQuestionId
                            ) ===
                            Number(
                              question.id
                            )
                          }
                        />
                      </button>
                    );
                  }
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                <div className="text-xs font-bold text-slate-600">
                  No matching questions
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setQuestionFilter(
                      FILTERS.ALL
                    )
                  }
                  className="mt-3 text-xs font-black text-[#ef1118]"
                >
                  Show all
                </button>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* =====================================================
          MOBILE PALETTE
      ===================================================== */}

      {mobilePalette && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* BACKDROP */}
          <button
            type="button"
            aria-label="Close palette"
            onClick={() =>
              setMobilePalette(
                false
              )
            }
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
          />

          {/* DRAWER */}
          <div className="absolute right-0 top-0 flex h-full w-[92%] max-w-[380px] flex-col bg-[#f8fafc] shadow-2xl">
            {/* HEADER */}
            <div className="flex h-[68px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
              <div>
                <div className="text-sm font-black text-slate-900">
                  Question Palette
                </div>

                <div className="mt-0.5 text-xs text-slate-400">
                  {
                    filteredQuestions.length
                  }{" "}
                  of{" "}
                  {totalQuestions}{" "}
                  questions
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setMobilePalette(
                    false
                  )
                }
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* MOBILE FILTER */}
            <div className="border-b border-slate-200 bg-white px-5 py-3">
              <div className="relative">
                <select
                  value={
                    questionFilter
                  }
                  onChange={(event) =>
                    setQuestionFilter(
                      event.target.value
                    )
                  }
                  className="h-[40px] w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 pr-9 text-xs font-bold text-slate-600 outline-none"
                >
                  <option
                    value={
                      FILTERS.ALL
                    }
                  >
                    All Questions
                  </option>

                  <option
                    value={
                      FILTERS.ANSWERED
                    }
                  >
                    Answered
                  </option>

                  <option
                    value={
                      FILTERS.CORRECT
                    }
                  >
                    Correct
                  </option>

                  <option
                    value={
                      FILTERS.INCORRECT
                    }
                  >
                    Incorrect
                  </option>

                  <option
                    value={
                      FILTERS.UNANSWERED
                    }
                  >
                    Unanswered
                  </option>

                  <option
                    value={
                      FILTERS.REVIEW
                    }
                  >
                    Marked for Review
                  </option>
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* CONTENT */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {/* LEGEND */}
              <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <LegendIcon
                      type={
                        STATUS.ANSWERED
                      }
                      count={
                        paletteCounts.answered
                      }
                    />

                    <span className="text-[10px] font-bold text-slate-500">
                      Answered
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <LegendIcon
                      type={
                        STATUS.NOT_ANSWERED
                      }
                      count={
                        paletteCounts.notAnswered
                      }
                    />

                    <span className="text-[10px] font-bold text-slate-500">
                      Not Answered
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <LegendIcon
                      type={
                        STATUS.NOT_VISITED
                      }
                      count={
                        paletteCounts.notVisited
                      }
                    />

                    <span className="text-[10px] font-bold text-slate-500">
                      Not Visited
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <LegendIcon
                      type={
                        STATUS.REVIEW
                      }
                      count={
                        paletteCounts.review
                      }
                    />

                    <span className="text-[10px] font-bold text-slate-500">
                      Review
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center gap-2">
                    <LegendIcon
                      type={
                        STATUS.ANSWERED_REVIEW
                      }
                      count={
                        paletteCounts.answeredReview
                      }
                    />

                    <span className="text-[10px] font-bold text-slate-500">
                      Answered & Review
                    </span>
                  </div>
                </div>
              </div>

              {/* FILTER TITLE */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {filterLabel}
                </div>

                <div className="text-[10px] font-bold text-slate-400">
                  {
                    filteredQuestions.length
                  }{" "}
                  questions
                </div>
              </div>

              {/* QUESTIONS */}
              {filteredQuestions.length > 0 ? (
                <div className="grid grid-cols-5 gap-x-4 gap-y-5">
                  {filteredQuestions.map(
                    (
                      question
                    ) => {
                      const status =
                        getQuestionPaletteState(
                          question
                        );

                      return (
                        <button
                          key={
                            question.id
                          }
                          type="button"
                          onClick={() =>
                            goToQuestion(
                              question.id
                            )
                          }
                          className="flex items-center justify-center"
                        >
                          <PaletteIcon
                            status={
                              status
                            }
                            number={
                              question.number
                            }
                            current={
                              Number(
                                currentQuestionId
                              ) ===
                              Number(
                                question.id
                              )
                            }
                          />
                        </button>
                      );
                    }
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
                  <div className="text-xs font-bold text-slate-600">
                    No matching questions
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setQuestionFilter(
                        FILTERS.ALL
                      );
                    }}
                    className="mt-3 text-xs font-black text-[#ef1118]"
                  >
                    Show all
                  </button>
                </div>
              )}
            </div>

            {/* NO FOOTER SUMMARY HERE */}
          </div>
        </div>
      )}
    </main>
  );
}