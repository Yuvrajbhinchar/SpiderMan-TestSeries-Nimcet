"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Edit3,
  FileImage,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Layers3,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import {
  motion,
} from "motion/react";

function QuestionTypeBadge({
  type,
}) {
  const labels = {
    mcq: "MCQ",
    msq: "MSQ",
    numeric: "Numeric",
    true_false:
      "True / False",
  };

  return (
    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
      {labels[type] ||
        type}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
          {label}
        </p>
      </div>

      <p className="mt-4 text-2xl font-black text-slate-950">
        {value}
      </p>
    </div>
  );
}

export default function AdminQuestionsPage() {
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

  const [
    test,
    setTest,
  ] = useState(null);

  const [
    questions,
    setQuestions,
  ] = useState([]);

  const [
    sections,
    setSections,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  const [
    movingKey,
    setMovingKey,
  ] = useState(null);

  /* =========================================================
     LOAD
  ========================================================= */

  const loadQuestions =
    useCallback(
      async ({
        background = false,
      } = {}) => {
        if (
          !series ||
          !testId
        ) {
          return;
        }

        if (
          background
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const response =
            await fetch(
              `/api/admin/tests/${encodeURIComponent(
                series
              )}/${encodeURIComponent(
                testId
              )}/questions`,
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
            response.status ===
              401 ||
            response.status ===
              403
          ) {
            throw new Error(
              data?.error ||
                "Admin access denied."
            );
          }

          if (
            !response.ok
          ) {
            throw new Error(
              data?.error ||
                "Unable to load questions."
            );
          }

          setTest(
            data?.test ||
              null
          );

          setQuestions(
            Array.isArray(
              data?.questions
            )
              ? data.questions
              : []
          );

          setSections(
            Array.isArray(
              data?.sections
            )
              ? data.sections
              : []
          );
        } catch (
          loadError
        ) {
          console.error(
            "Admin questions load error:",
            loadError
          );

          setError(
            loadError?.message ||
              "Unable to load questions."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        series,
        testId,
      ]
    );

  useEffect(() => {
    loadQuestions();
  }, [
    loadQuestions,
  ]);

  /* =========================================================
     SECTION MAP
  ========================================================= */

  const sectionMap =
    useMemo(() => {
      const map =
        new Map();

      sections.forEach(
        (
          section
        ) => {
          map.set(
            Number(
              section.id
            ),
            section
          );
        }
      );

      return map;
    }, [
      sections,
    ]);

  /* =========================================================
     REORDER
  ========================================================= */

  const moveQuestion =
    async (
      question,
      direction
    ) => {
      if (
        !question?.id ||
        !question?.testId ||
        movingKey
      ) {
        return;
      }

      const questionIndex =
        questions.findIndex(
          (
            item
          ) =>
            Number(
              item.id
            ) ===
            Number(
              question.id
            )
        );

      if (
        questionIndex <
        0
      ) {
        return;
      }

      /*
       * Find the neighboring question within the SAME section.
       */

      const currentSection =
        question.sectionId ??
        null;

      const candidates =
        questions.filter(
          (
            item
          ) =>
            Number(
              item.sectionId ??
                0
            ) ===
            Number(
              currentSection ??
                0
            )
        );

      const localIndex =
        candidates.findIndex(
          (
            item
          ) =>
            Number(
              item.id
            ) ===
            Number(
              question.id
            )
        );

      if (
        localIndex <
          0 ||
        (
          direction ===
            "up" &&
          localIndex ===
            0
        ) ||
        (
          direction ===
            "down" &&
          localIndex ===
            candidates.length -
              1
        )
      ) {
        return;
      }

      setMovingKey(
        `${question.id}:${direction}`
      );

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              series
            )}/${encodeURIComponent(
              testId
            )}/questions/reorder`,
            {
              method:
                "POST",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              cache:
                "no-store",

              body:
                JSON.stringify({
                  questionId:
                    Number(
                      question.id
                    ),

                  direction,
                }),
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
              "Unable to reorder question."
          );
        }

        /*
         * Re-fetch because the order of the neighboring
         * question also changed.
         */

        await loadQuestions({
          background:
            true,
        });
      } catch (
        reorderError
      ) {
        console.error(
          "Question reorder error:",
          reorderError
        );

        setError(
          reorderError?.message ||
            "Unable to reorder question."
        );
      } finally {
        setMovingKey(
          null
        );
      }
    };

  /* =========================================================
     DELETE
  ========================================================= */

  const deleteQuestion =
    async (
      question
    ) => {
      if (
        !question?.id ||
        deletingId
      ) {
        return;
      }

      const confirmed =
        window.confirm(
          `Delete question #${
            question.questionOrder ||
            "?"
          } permanently?\n\nQuestions with historical attempt answers cannot be deleted.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      setDeletingId(
        question.id
      );

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              series
            )}/${encodeURIComponent(
              testId
            )}/questions/${encodeURIComponent(
              String(
                question.id
              )
            )}`,
            {
              method:
                "DELETE",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              cache:
                "no-store",

              body:
                JSON.stringify({
                  confirm:
                    true,
                }),
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
              "Unable to delete question."
          );
        }

        /*
         * Re-fetch instead of manually shifting all local
         * orders. The server is the source of truth.
         */

        await loadQuestions({
          background:
            true,
        });
      } catch (
        deleteError
      ) {
        console.error(
          "Question delete error:",
          deleteError
        );

        setError(
          deleteError?.message ||
            "Unable to delete question."
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };

  /* =========================================================
     SECTION BOUNDARIES
  ========================================================= */

  function getSectionBoundaryState(
    question
  ) {
    const sameSection =
      questions.filter(
        (
          item
        ) =>
          Number(
            item.sectionId ??
              0
          ) ===
          Number(
            question.sectionId ??
              0
          )
      );

    const index =
      sameSection.findIndex(
        (
          item
        ) =>
          Number(
            item.id
          ) ===
          Number(
            question.id
          )
      );

    return {
      isFirst:
        index <= 0,

      isLast:
        index <
          0 ||
        index ===
          sameSection.length -
            1,
    };
  }

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div>
      {/* HEADER */}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                `/admin/tests/${encodeURIComponent(
                  series
                )}/${encodeURIComponent(
                  testId
                )}`
              )
            }
            className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />

            Back to Test
          </button>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
            Content
          </p>

          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
            Questions
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {test?.title ||
              "Manage test questions"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Questions
            </p>

            <p className="mt-1 text-xl font-black text-slate-950">
              {questions.length}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              router.push(
                `/admin/tests/${encodeURIComponent(
                  series
                )}/${encodeURIComponent(
                  testId
                )}/questions/new`
              )
            }
            className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-4 text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15]"
          >
            <Plus className="h-4.5 w-4.5" />

            Add Question
          </button>
        </div>
      </div>

      {/* SUMMARY */}

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Stored Questions"
          value={
            test?.storedQuestionCount ??
            questions.length
          }
          icon={FileText}
        />

        <SummaryCard
          label="Sections"
          value={
            sections.length
          }
          icon={Layers3}
        />

        <SummaryCard
          label="Total Marks"
          value={
            test?.storedMarks ??
            0
          }
          icon={FileText}
        />
      </div>

      {/* ERROR */}

      {error ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              loadQuestions({
                background:
                  true,
              })
            }
            className="w-fit cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* QUESTIONS */}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-64 items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />

              Loading questions...
            </div>
          </div>
        ) : null}

        {!loading &&
        questions.length ===
          0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <FileText className="h-6 w-6" />
            </div>

            <h2 className="mt-4 text-base font-black text-slate-950">
              No questions yet
            </h2>

            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
              Add your first question to this test.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/admin/tests/${encodeURIComponent(
                    series
                  )}/${encodeURIComponent(
                    testId
                  )}/questions/new`
                )
              }
              className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-4 py-2.5 text-xs font-black text-white"
            >
              <Plus className="h-3.5 w-3.5" />

              Add Question
            </button>
          </div>
        ) : null}

        {!loading &&
        questions.length >
          0 ? (
          <div className="divide-y divide-slate-100">
            {questions.map(
              (
                question,
                index
              ) => {
                const {
                  isFirst,
                  isLast,
                } =
                  getSectionBoundaryState(
                    question
                  );

                const section =
                  question.sectionId
                    ? sectionMap.get(
                        Number(
                          question.sectionId
                        )
                      )
                    : null;

                const hasImage =
                  Boolean(
                    question.questionImageUrl
                  );

                const upBusy =
                  movingKey ===
                  `${question.id}:up`;

                const downBusy =
                  movingKey ===
                  `${question.id}:down`;

                return (
                  <motion.article
                    key={
                      question.id
                    }
                    initial={{
                      opacity: 0,
                      y: 6,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration:
                        0.2,
                      delay:
                        Math.min(
                          index *
                            0.02,
                          0.2
                        ),
                    }}
                    className="p-5 sm:p-6"
                  >
                    <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                      {/* =====================================
                          ORDER COLUMN
                      ====================================== */}

                      <div className="flex shrink-0 items-center gap-2 xl:w-[105px] xl:flex-col">
                        <span className="rounded-lg bg-slate-950 px-3 py-1.5 text-[11px] font-black text-white">
                          Q
                          {
                            question.questionOrder
                          }
                        </span>

                        <div className="flex items-center gap-1 xl:mt-2">
                          <button
                            type="button"
                            disabled={
                              isFirst ||
                              movingKey !==
                                null
                            }
                            onClick={() =>
                              moveQuestion(
                                question,
                                "up"
                              )
                            }
                            title="Move question up"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
                          >
                            {upBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowUp className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={
                              isLast ||
                              movingKey !==
                                null
                            }
                            onClick={() =>
                              moveQuestion(
                                question,
                                "down"
                              )
                            }
                            title="Move question down"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
                          >
                            {downBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* =====================================
                          CONTENT
                      ====================================== */}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <QuestionTypeBadge
                            type={
                              question.questionType
                            }
                          />

                          {section ? (
                            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                              {
                                section.sectionName
                              }
                            </span>
                          ) : null}

                          {hasImage ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-[10px] font-black text-[#ef1118]">
                              <FileImage className="h-3 w-3" />

                              Image
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                              <FileText className="h-3 w-3" />

                              Text
                            </span>
                          )}
                        </div>

                        <div className="mt-4">
                          {hasImage ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                              <img
                                src={
                                  question.questionImageUrl
                                }
                                alt={`Question ${question.questionOrder}`}
                                loading="lazy"
                                draggable={
                                  false
                                }
                                className="max-h-[320px] w-full object-contain"
                              />
                            </div>
                          ) : null}

                          {question.questionText ? (
                            <p
                              className={`whitespace-pre-wrap text-sm leading-6 text-slate-700 ${
                                hasImage
                                  ? "mt-4"
                                  : ""
                              }`}
                            >
                              {
                                question.questionText
                              }
                            </p>
                          ) : null}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] font-bold text-slate-400">
                          <span>
                            +{" "}
                            {
                              question.marks
                            }{" "}
                            marks
                          </span>

                          <span>
                            −{" "}
                            {
                              question.negativeMarks
                            }
                          </span>

                          <span>
                            {
                              question.options
                                ?.length ||
                              0
                            }{" "}
                            options
                          </span>
                        </div>
                      </div>

                      {/* =====================================
                          ACTIONS
                      ====================================== */}

                      <div className="flex shrink-0 items-center gap-2 xl:flex-col">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              `/admin/tests/${encodeURIComponent(
                                series
                              )}/${encodeURIComponent(
                                testId
                              )}/questions/${encodeURIComponent(
                                String(
                                  question.id
                                )
                              )}`
                            )
                          }
                          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />

                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            deletingId ===
                            question.id
                          }
                          onClick={() =>
                            deleteQuestion(
                              question
                            )
                          }
                          className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId ===
                          question.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.article>
                );
              }
            )}
          </div>
        ) : null}

        {/* REFRESH */}

        {!loading &&
        questions.length >
          0 ? (
          <div className="border-t border-slate-100 px-5 py-4 text-center">
            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                loadQuestions({
                  background:
                    true,
                })
              }
              className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-400 transition hover:text-slate-700 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${
                  refreshing
                    ? "animate-spin"
                    : ""
                }`}
              />

              Refresh Questions
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}