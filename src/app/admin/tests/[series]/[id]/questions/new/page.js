"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  Check,
  FileImage,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import MathPreview, {
  MathCheatSheet,
} from "@/components/admin/MathPreview";

const QUESTION_TYPES = [
  {
    value: "mcq",
    label: "MCQ",
  },
  {
    value: "msq",
    label: "MSQ",
  },
  {
    value: "numeric",
    label: "Numeric",
  },
  {
    value: "true_false",
    label: "True / False",
  },
];

const INITIAL_OPTIONS = [
  {
    label: "A",
    text: "",
    isCorrect: true,
  },
  {
    label: "B",
    text: "",
    isCorrect: false,
  },
  {
    label: "C",
    text: "",
    isCorrect: false,
  },
  {
    label: "D",
    text: "",
    isCorrect: false,
  },
];

export default function NewQuestionPage() {
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
    sections,
    setSections,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    form,
    setForm,
  ] = useState({
    sectionId: "",
    questionText: "",
    questionImageUrl: "",
    explanation: "",
    questionType: "mcq",
    marks: "1",
    negativeMarks: "0",
    questionOrder: "",
    options:
      INITIAL_OPTIONS,
  });

  /* =========================================================
     LOAD TEST + SECTIONS
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function load() {
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
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to load test."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setTest(
          data?.test ||
            null
        );

        setSections(
          Array.isArray(
            data?.sections
          )
            ? data.sections
            : []
        );

        /*
         * Auto-suggest next question number.
         */

        const questions =
          Array.isArray(
            data?.questions
          )
            ? data.questions
            : [];

        const maxOrder =
          questions.reduce(
            (
              maximum,
              question
            ) =>
              Math.max(
                maximum,
                Number(
                  question.questionOrder ||
                    0
                )
              ),
            0
          );

        setForm(
          (
            previous
          ) => ({
            ...previous,

            questionOrder:
              maxOrder +
              1,
          })
        );
      } catch (
        loadError
      ) {
        console.error(
          "Load question form error:",
          loadError
        );

        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load test."
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

    load();

    return () => {
      cancelled = true;
    };
  }, [
    series,
    testId,
  ]);

  /* =========================================================
     UPDATE FIELD
  ========================================================= */

  const updateField =
    (
      field,
      value
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          [field]:
            value,
        })
      );
    };

  /* =========================================================
     TYPE CHANGE
  ========================================================= */

  const changeType =
    (
      value
    ) => {
      setForm(
        (
          previous
        ) => {
          if (
            value ===
            "numeric"
          ) {
            return {
              ...previous,

              questionType:
                value,

              options:
                [],
            };
          }

          if (
            value ===
              "true_false" &&
            previous.options.length !==
              2
          ) {
            return {
              ...previous,

              questionType:
                value,

              options: [
                {
                  label: "A",
                  text:
                    "True",
                  isCorrect:
                    true,
                },
                {
                  label: "B",
                  text:
                    "False",
                  isCorrect:
                    false,
                },
              ],
            };
          }

          if (
            previous.options.length ===
            0
          ) {
            return {
              ...previous,

              questionType:
                value,

              options:
                INITIAL_OPTIONS,
            };
          }

          return {
            ...previous,

            questionType:
              value,
          };
        }
      );
    };

  /* =========================================================
     OPTION
  ========================================================= */

  const updateOption =
    (
      index,
      field,
      value
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          options:
            previous.options.map(
              (
                option,
                optionIndex
              ) =>
                optionIndex ===
                index
                  ? {
                      ...option,

                      [field]:
                        value,
                    }
                  : option
            ),
        })
      );
    };

  const setCorrect =
    (
      index
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          options:
            previous.options.map(
              (
                option,
                optionIndex
              ) => ({
                ...option,

                isCorrect:
                  previous.questionType ===
                  "msq"
                    ? optionIndex ===
                      index
                      ? !option.isCorrect
                      : option.isCorrect
                    : optionIndex ===
                      index,
              })
            ),
        })
      );
    };

  const addOption =
    () => {
      if (
        form.options.length >=
        6
      ) {
        return;
      }

      const index =
        form.options.length;

      setForm(
        (
          previous
        ) => ({
          ...previous,

          options: [
            ...previous.options,

            {
              label:
                String.fromCharCode(
                  65 +
                    index
                ),

              text:
                "",

              isCorrect:
                false,
            },
          ],
        })
      );
    };

  const removeOption =
    (
      index
    ) => {
      if (
        form.options.length <=
        2
      ) {
        return;
      }

      setForm(
        (
          previous
        ) => ({
          ...previous,

          options:
            previous.options
              .filter(
                (
                  _,
                  optionIndex
                ) =>
                  optionIndex !==
                  index
              )
              .map(
                (
                  option,
                  optionIndex
                ) => ({
                  ...option,

                  label:
                    String.fromCharCode(
                      65 +
                        optionIndex
                    ),
                })
              ),
        })
      );
    };

  /* =========================================================
     SAVE
  ========================================================= */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        saving
      ) {
        return;
      }

      setSaving(
        true
      );

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
              method: "POST",

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
                  sectionId:
                    form.sectionId
                      ? Number(
                          form.sectionId
                        )
                      : null,

                  questionText:
                    form.questionText,

                  questionImageUrl:
                    form.questionImageUrl,

                  explanation:
                    form.explanation,

                  questionType:
                    form.questionType,

                  marks:
                    Number(
                      form.marks
                    ),

                  negativeMarks:
                    Number(
                      form.negativeMarks
                    ),

                  questionOrder:
                    Number(
                      form.questionOrder
                    ),

                  options:
                    form.options,
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
              "Unable to create question."
          );
        }

        router.replace(
          `/admin/tests/${encodeURIComponent(
            series
          )}/${encodeURIComponent(
            testId
          )}/questions`
        );
      } catch (
        saveError
      ) {
        console.error(
          "Create question error:",
          saveError
        );

        setError(
          saveError?.message ||
            "Unable to create question."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  if (
    loading
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />

          Loading question editor...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* HEADER */}

      <div>
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
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />

          Back to Questions
        </button>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Question Management
        </p>

        <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
          Add Question
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          {test?.title ||
            "Test"}
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-7"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          {/* ===================================================
              MAIN
          ==================================================== */}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Question
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              Question Content
            </h2>

            <div className="mt-6 space-y-5">
              {/* QUESTION TEXT */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Question Text
                </label>

                <textarea
                  rows={7}
                  value={
                    form.questionText
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "questionText",
                      event.target
                        .value
                    )
                  }
                  placeholder="Leave empty when the complete question is provided as an image."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />

                <p className="mt-1.5 text-[10px] leading-5 text-slate-400">
                  Text is optional when a question image is
                  provided. Wrap math in $...$ (inline) or
                  $$...$$ (own line) — see &quot;Math / LaTeX
                  help&quot;.
                </p>

                <MathPreview
                  value={
                    form.questionText
                  }
                  label="Question preview"
                />
              </div>

              {/* IMAGE URL */}

              <div>
                <label className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                  <FileImage className="h-3.5 w-3.5" />

                  Question Image URL
                </label>

                <input
                  type="url"
                  value={
                    form.questionImageUrl
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "questionImageUrl",
                      event.target
                        .value
                    )
                  }
                  placeholder="https://res.cloudinary.com/..."
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />

                {form.questionImageUrl ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img
                      src={
                        form.questionImageUrl
                      }
                      alt="Question preview"
                      className="max-h-[300px] w-full object-contain"
                    />
                  </div>
                ) : null}
              </div>

              {/* EXPLANATION */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Explanation
                </label>

                <textarea
                  rows={5}
                  value={
                    form.explanation
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "explanation",
                      event.target
                        .value
                    )
                  }
                  placeholder="Optional explanation shown in analysis."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />

                <MathPreview
                  value={
                    form.explanation
                  }
                  label="Explanation preview"
                />
              </div>

              {/* OPTIONS */}

              {form.questionType !==
              "numeric" ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-xs font-black text-slate-700">
                        Options
                      </label>

                      <p className="mt-1 text-[10px] text-slate-400">
                        Correct options are used for evaluation.
                      </p>
                    </div>

                    {form.questionType !==
                      "true_false" &&
                    form.options.length <
                      6 ? (
                      <button
                        type="button"
                        onClick={
                          addOption
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" />

                        Add Option
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 space-y-3">
                    {form.options.map(
                      (
                        option,
                        index
                      ) => (
                        <div
                          key={
                            index
                          }
                          className={`rounded-2xl border p-3 ${
                            option.isCorrect
                              ? "border-emerald-200 bg-emerald-50/40"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setCorrect(
                                  index
                                )
                              }
                              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-xs font-black ${
                                option.isCorrect
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white text-slate-500"
                              }`}
                              title="Toggle correct option"
                            >
                              {option.isCorrect ? (
                                <Check className="h-4 w-4" />
                              ) : (
                                option.label
                              )}
                            </button>

                            <input
                              value={
                                option.text
                              }
                              onChange={(
                                event
                              ) =>
                                updateOption(
                                  index,
                                  "text",
                                  event
                                    .target
                                    .value
                                )
                              }
                              placeholder={`Option ${option.label}`}
                              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-red-300"
                            />

                            {form.options.length >
                              2 &&
                            form.questionType !==
                              "true_false" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  removeOption(
                                    index
                                  )
                                }
                                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          <MathPreview
                            compact
                            value={
                              option.text
                            }
                            label={`Option ${option.label} preview`}
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          {/* ===================================================
              SIDEBAR
          ==================================================== */}

          <div className="space-y-5">
            {/* CONFIG */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Configuration
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Question Settings
              </h2>

              <div className="mt-5 space-y-4">
                {/* TYPE */}

                <div>
                  <label className="text-xs font-black text-slate-700">
                    Question Type
                  </label>

                  <select
                    value={
                      form.questionType
                    }
                    onChange={(
                      event
                    ) =>
                      changeType(
                        event.target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
                  >
                    {QUESTION_TYPES.map(
                      (
                        type
                      ) => (
                        <option
                          key={
                            type.value
                          }
                          value={
                            type.value
                          }
                        >
                          {
                            type.label
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* SECTION */}

                <div>
                  <label className="text-xs font-black text-slate-700">
                    Section
                  </label>

                  <select
                    value={
                      form.sectionId
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "sectionId",
                        event.target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
                  >
                    <option value="">
                      No Section
                    </option>

                    {sections.map(
                      (
                        section
                      ) => (
                        <option
                          key={
                            section.id
                          }
                          value={
                            section.id
                          }
                        >
                          {
                            section.sectionName
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* ORDER */}

                <div>
                  <label className="text-xs font-black text-slate-700">
                    Question Order
                  </label>

                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.questionOrder
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "questionOrder",
                        event.target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                  />
                </div>

                {/* MARKS */}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-black text-slate-700">
                      Marks
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={
                        form.marks
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "marks",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black text-slate-700">
                      Negative
                    </label>

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={
                        form.negativeMarks
                      }
                      onChange={(
                        event
                      ) =>
                        updateField(
                          "negativeMarks",
                          event.target
                            .value
                        )
                      }
                      className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* MATH HELP */}

            <MathCheatSheet />

            {/* SAVE */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <button
                type="submit"
                disabled={
                  saving
                }
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {saving ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}

                {saving
                  ? "Creating..."
                  : "Create Question"}
              </button>

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
                className="mt-2 h-11 w-full cursor-pointer rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}