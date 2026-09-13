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
  useRouter,
} from "next/navigation";

/* =========================================================
   QUESTION TYPES
========================================================= */

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

/* =========================================================
   DEFAULT OPTIONS
========================================================= */

const DEFAULT_OPTIONS = [
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

/* =========================================================
   HELPERS
========================================================= */

function normalizeOptions(
  options,
  questionType
) {
  if (
    questionType ===
    "numeric"
  ) {
    return [];
  }

  if (
    !Array.isArray(
      options
    ) ||
    options.length === 0
  ) {
    return DEFAULT_OPTIONS.map(
      (
        option
      ) => ({
        ...option,
      })
    );
  }

  return options.map(
    (
      option,
      index
    ) => ({
      id:
        option?.id ??
        null,

      label:
        String(
          option?.label ||
            option?.optionLabel ||
            option?.option_label ||
            String.fromCharCode(
              65 + index
            )
        )
          .trim()
          .toUpperCase(),

      text:
        String(
          option?.text ||
            option?.optionText ||
            option?.option_text ||
            ""
        ),

      isCorrect:
        Boolean(
          option?.isCorrect ??
            option?.is_correct ??
            false
        ),
    })
  );
}

/* =========================================================
   COMPONENT
========================================================= */

export default function QuestionEditor({
  mode = "edit",
  initialQuestion = null,
  series,
  testId,
}) {
  const router =
    useRouter();

  const editing =
    mode === "edit";

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    sections,
    setSections,
  ] = useState([]);

  const [
    sectionsLoading,
    setSectionsLoading,
  ] = useState(true);

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
    questionOrder: "1",
    options:
      DEFAULT_OPTIONS.map(
        (
          option
        ) => ({
          ...option,
        })
      ),
  });

  /* =========================================================
     INITIAL QUESTION
  ========================================================= */

  useEffect(() => {
    if (
      !initialQuestion
    ) {
      return;
    }

    const questionType =
      String(
        initialQuestion.questionType ||
          "mcq"
      )
        .trim()
        .toLowerCase();

    setForm({
      sectionId:
        initialQuestion.sectionId !=
          null
          ? String(
              initialQuestion.sectionId
            )
          : "",

      questionText:
        initialQuestion.questionText ||
        initialQuestion.question_text ||
        "",

      questionImageUrl:
        initialQuestion.questionImageUrl ||
        initialQuestion.question_image_url ||
        "",

      explanation:
        initialQuestion.explanation ||
        "",

      questionType,

      marks:
        String(
          initialQuestion.marks ??
            1
        ),

      negativeMarks:
        String(
          initialQuestion.negativeMarks ??
            initialQuestion.negative_marks ??
            0
        ),

      questionOrder:
        String(
          initialQuestion.questionOrder ??
            initialQuestion.question_order ??
            1
        ),

      options:
        normalizeOptions(
          initialQuestion.options,
          questionType
        ),
    });
  }, [
    initialQuestion,
  ]);

  /* =========================================================
     LOAD SECTIONS
========================================================= */

  useEffect(() => {
    if (
      !series ||
      !testId
    ) {
      return;
    }

    let cancelled = false;

    async function loadSections() {
      try {
        setSectionsLoading(
          true
        );

        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              String(series)
            )}/${encodeURIComponent(
              String(testId)
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
              "Unable to load sections."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

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
        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load sections."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setSectionsLoading(
            false
          );
        }
      }
    }

    loadSections();

    return () => {
      cancelled = true;
    };
  }, [
    series,
    testId,
  ]);

  /* =========================================================
     FIELD
  ========================================================= */

  function updateField(
    field,
    value
  ) {
    setForm(
      (
        previous
      ) => ({
        ...previous,

        [field]:
          value,
      })
    );
  }

  /* =========================================================
     TYPE CHANGE
  ========================================================= */

  function handleTypeChange(
    value
  ) {
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

            options: [],
          };
        }

        if (
          value ===
          "true_false"
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
                  previous.options?.[0]
                    ?.isCorrect ??
                  true,
              },
              {
                label: "B",
                text:
                  "False",
                isCorrect:
                  !(
                    previous
                      .options?.[0]
                      ?.isCorrect ??
                    true
                  ),
              },
            ],
          };
        }

        const options =
          Array.isArray(
            previous.options
          ) &&
          previous.options
            .length >= 2
            ? previous.options
            : DEFAULT_OPTIONS;

        return {
          ...previous,

          questionType:
            value,

          options:
            options.map(
              (
                option
              ) => ({
                ...option,
              })
            ),
        };
      }
    );
  }

  /* =========================================================
     OPTION UPDATE
  ========================================================= */

  function updateOption(
    index,
    field,
    value
  ) {
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
  }

  /* =========================================================
     CORRECT OPTION
  ========================================================= */

  function toggleCorrect(
    index
  ) {
    setForm(
      (
        previous
      ) => {
        const nextOptions =
          previous.options.map(
            (
              option,
              optionIndex
            ) => {
              if (
                previous.questionType ===
                "msq"
              ) {
                return optionIndex ===
                  index
                  ? {
                      ...option,

                      isCorrect:
                        !option.isCorrect,
                    }
                  : option;
              }

              return {
                ...option,

                isCorrect:
                  optionIndex ===
                  index,
              };
            }
          );

        return {
          ...previous,

          options:
            nextOptions,
        };
      }
    );
  }

  /* =========================================================
     ADD OPTION
  ========================================================= */

  function addOption() {
    if (
      form.options.length >=
      6
    ) {
      return;
    }

    const nextIndex =
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
                  nextIndex
              ),

            text: "",

            isCorrect:
              false,
          },
        ],
      })
    );
  }

  /* =========================================================
     REMOVE OPTION
  ========================================================= */

  function removeOption(
    index
  ) {
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
  }

  /* =========================================================
     SAVE
  ========================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      saving ||
      !initialQuestion?.id
    ) {
      return;
    }

    setSaving(
      true
    );

    setError("");
    setSuccess("");

    try {
      const payload = {
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
      };

      const response =
        await fetch(
          `/api/admin/tests/${encodeURIComponent(
            String(series)
          )}/${encodeURIComponent(
            String(testId)
          )}/questions/${encodeURIComponent(
            String(
              initialQuestion.id
            )
          )}`,
          {
            method: "PATCH",

            credentials:
              "include",

            headers: {
              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",

            body:
              JSON.stringify(
                payload
              ),
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
            "Unable to update question."
        );
      }

      setSuccess(
        data?.message ||
          "Question updated successfully."
      );

      /*
       * Keep editor on the same question.
       * This avoids accidental navigation after save.
       */

      if (
        data?.question
      ) {
        const updated =
          data.question;

        setForm(
          (
            previous
          ) => ({
            ...previous,

            sectionId:
              updated.sectionId !=
                null
                ? String(
                    updated.sectionId
                  )
                : "",

            questionText:
              updated.questionText ||
              "",

            questionImageUrl:
              updated.questionImageUrl ||
              "",

            explanation:
              updated.explanation ||
              "",

            questionType:
              updated.questionType ||
              previous.questionType,

            marks:
              String(
                updated.marks ??
                  previous.marks
              ),

            negativeMarks:
              String(
                updated.negativeMarks ??
                  previous.negativeMarks
              ),

            questionOrder:
              String(
                updated.questionOrder ??
                  previous.questionOrder
              ),

            options:
              normalizeOptions(
                updated.options,
                updated.questionType ||
                  previous.questionType
              ),
          })
        );
      }
    } catch (
      saveError
    ) {
      console.error(
        "Question update error:",
        saveError
      );

      setError(
        saveError?.message ||
          "Unable to update question."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =========================================================
     PREVIEW URL
  ========================================================= */

  const imageUrl =
    String(
      form.questionImageUrl ||
        ""
    ).trim();

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div>
        <button
          type="button"
          onClick={() =>
            router.push(
              `/admin/tests/${encodeURIComponent(
                String(series)
              )}/${encodeURIComponent(
                String(testId)
              )}/questions`
            )
          }
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />

          Back to Questions
        </button>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Question Management
        </p>

        <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
          Edit Question
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Question #
          {" "}
          {initialQuestion?.questionOrder ||
            initialQuestion?.question_order ||
            "—"}
        </p>
      </div>

      {/* =====================================================
          ALERTS
      ====================================================== */}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {/* =====================================================
          FORM
      ====================================================== */}

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
              Content
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              Question
            </h2>

            <div className="mt-6 space-y-5">
              {/* TEXT */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Question Text
                </label>

                <textarea
                  rows={
                    8
                  }
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
                  placeholder="Leave empty if the complete question is represented by the image."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />

                <p className="mt-1.5 text-[10px] leading-5 text-slate-400">
                  You may use text, an image, or both.
                </p>
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

                {imageUrl ? (
                  <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img
                      src={
                        imageUrl
                      }
                      alt="Question image preview"
                      className="max-h-[420px] w-full object-contain"
                      draggable={
                        false
                      }
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
                  rows={
                    6
                  }
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
                  placeholder="Optional explanation for analysis."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />
              </div>

              {/* OPTIONS */}

              {form.questionType !==
              "numeric" ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <label className="text-xs font-black text-slate-700">
                        Options
                      </label>

                      <p className="mt-1 text-[10px] leading-5 text-slate-400">
                        Click the option badge to mark the correct answer.
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
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-600 transition hover:bg-slate-100"
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
                            option.id ||
                            index
                          }
                          className={`rounded-2xl border p-3 transition ${
                            option.isCorrect
                              ? "border-emerald-200 bg-emerald-50/40"
                              : "border-slate-200 bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                toggleCorrect(
                                  index
                                )
                              }
                              className={`flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border text-xs font-black transition ${
                                option.isCorrect
                                  ? "border-emerald-500 bg-emerald-500 text-white"
                                  : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
                              }`}
                              title="Mark as correct"
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
                                  event.target
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
                                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl text-red-400 transition hover:bg-red-50 hover:text-red-600"
                                aria-label={`Remove option ${option.label}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs font-medium leading-5 text-blue-700">
                  Numeric questions do not use MCQ options.
                </div>
              )}
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
                      handleTypeChange(
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
                    disabled={
                      sectionsLoading
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
                    className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <option value="">
                      {sectionsLoading
                        ? "Loading sections..."
                        : "No Section"}
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
                    required
                    min="1"
                    step="1"
                    type="number"
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
                      required
                      min="0"
                      step="0.5"
                      type="number"
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
                      required
                      min="0"
                      step="0.5"
                      type="number"
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

            {/* SAVE */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <button
                type="submit"
                disabled={
                  saving ||
                  sectionsLoading
                }
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {saving ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}

                {saving
                  ? "Saving..."
                  : "Save Changes"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/admin/tests/${encodeURIComponent(
                      String(series)
                    )}/${encodeURIComponent(
                      String(testId)
                    )}/questions`
                  )
                }
                className="mt-2 h-11 w-full cursor-pointer rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
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