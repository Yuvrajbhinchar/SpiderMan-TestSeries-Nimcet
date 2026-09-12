"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flag,
  X,
} from "lucide-react";

import { toast } from "sonner";

import SpiderManLoader from "@/components/common/SpiderManLoader";

const STATUS = {
  NOT_VISITED: "not_visited",
  NOT_ANSWERED: "not_answered",
  ANSWERED: "answered",
  REVIEW: "review",
  ANSWERED_REVIEW: "answered_review",
};

function createQuestionState(
  questions,
  savedAnswers
) {
  const savedMap = new Map(
    (
      Array.isArray(savedAnswers)
        ? savedAnswers
        : []
    ).map((item) => [
      Number(item.questionId),
      item,
    ])
  );

  return questions.reduce(
    (acc, question, index) => {
      const saved =
        savedMap.get(
          Number(question.id)
        );

      const selectedIndex =
        saved?.selectedOptionId !=
        null
          ? question.options.findIndex(
              (option) =>
                Number(option.id) ===
                Number(
                  saved.selectedOptionId
                )
            )
          : null;

      acc[Number(question.id)] = {
        visited: saved
          ? Boolean(saved.visited)
          : index === 0,

        selectedOption:
          selectedIndex >= 0
            ? selectedIndex
            : null,

        markedForReview: saved
          ? Boolean(
              saved.markedForReview
            )
          : false,

        timeSpentSeconds:
          Number(
            saved?.timeSpentSeconds ||
              0
          ),
      };

      return acc;
    },
    {}
  );
}

function formatTime(
  totalSeconds
) {
  const total = Math.max(
    0,
    Math.floor(
      Number(totalSeconds) || 0
    )
  );

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const seconds = total % 60;

  return [hours, minutes, seconds]
    .map((value) =>
      String(value).padStart(2, "0")
    )
    .join(":");
}

function getStatus(item) {
  if (!item?.visited) {
    return STATUS.NOT_VISITED;
  }

  if (
    item.markedForReview &&
    item.selectedOption !== null
  ) {
    return STATUS.ANSWERED_REVIEW;
  }

  if (item.markedForReview) {
    return STATUS.REVIEW;
  }

  if (
    item.selectedOption !== null
  ) {
    return STATUS.ANSWERED;
  }

  return STATUS.NOT_ANSWERED;
}

function PaletteIcon({
  status,
  number,
  current,
}) {
  const base =
    "relative flex h-[42px] w-[42px] items-center justify-center text-[13px] font-bold transition-all duration-150";

  const currentClass = current
    ? "z-10 scale-[1.05] shadow-[0_0_0_2px_white,0_0_0_4px_#2563eb]"
    : "";

  if (
    status === STATUS.NOT_VISITED
  ) {
    return (
      <div
        className={`${base} rounded-[4px] border border-[#94a3b8] bg-gradient-to-b from-white to-[#e1e1e1] text-[#1e293b] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_2px_rgba(0,0,0,0.1)] ${currentClass}`}
      >
        {number}
      </div>
    );
  }

  if (
    status === STATUS.NOT_ANSWERED
  ) {
    return (
      <div
        className={`${base} rounded-[2px] bg-gradient-to-b from-[#e25822] to-[#b42711] text-white [clip-path:polygon(0%_0%,100%_0%,100%_75%,50%_100%,0%_75%)] ${currentClass}`}
      >
        {number}
      </div>
    );
  }

  if (
    status === STATUS.ANSWERED
  ) {
    return (
      <div
        className={`${base} rounded-[2px] bg-gradient-to-b from-[#7fc142] to-[#478e17] text-white [clip-path:polygon(50%_0%,100%_25%,100%_100%,0%_100%,0%_25%)] ${currentClass}`}
      >
        {number}
      </div>
    );
  }

  if (
    status === STATUS.REVIEW
  ) {
    return (
      <div
        className={`${base} rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_1px_2px_rgba(0,0,0,0.2)] ${currentClass}`}
      >
        {number}
      </div>
    );
  }

  return (
    <div
      className={`${base} rounded-full bg-gradient-to-b from-[#8a5bbb] to-[#5a3782] text-white ${currentClass}`}
    >
      {number}

      <span className="absolute -bottom-[2px] -right-[2px] flex h-[14px] w-[14px] items-center justify-center rounded-full border border-white bg-[#5ca817] text-[8px] font-extrabold leading-none text-white">
        ✓
      </span>
    </div>
  );
}

function LegendIcon({
  type,
  count,
}) {
  const value = Number(count || 0);

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

function getTimestamp(value) {
  if (!value) {
    return NaN;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const text =
    String(value).trim();

  if (!text) {
    return NaN;
  }

  if (
    text.length === 19 &&
    text[4] === "-" &&
    text[7] === "-" &&
    text[10] === " " &&
    text[13] === ":" &&
    text[16] === ":"
  ) {
    return new Date(
      `${text.replace(
        " ",
        "T"
      )}Z`
    ).getTime();
  }

  return new Date(text).getTime();
}

export default function AttemptPage() {
  const {
    series,
    id,
  } = useParams();

  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const attemptId =
    Number(
      searchParams.get(
        "attemptId"
      ) || 0
    );

  const [loading, setLoading] =
    useState(true);

  const [loadError, setLoadError] =
    useState("");

  const [test, setTest] =
    useState(null);

  const [attempt, setAttempt] =
    useState(null);

  const [sections, setSections] =
    useState([]);

  const [questions, setQuestions] =
    useState([]);

  const [
    questionsState,
    setQuestionsState,
  ] = useState({});

  const [
    currentQuestionId,
    setCurrentQuestionId,
  ] = useState(null);

  const [
    activeSectionIndex,
    setActiveSectionIndex,
  ] = useState(0);

  const [
    remainingSeconds,
    setRemainingSeconds,
  ] = useState(0);

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(0);

  const [
    showSubmitModal,
    setShowSubmitModal,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    mobilePalette,
    setMobilePalette,
  ] = useState(false);

  const [
    desktopPalette,
    setDesktopPalette,
  ] = useState(true);

  const [
    fullscreenWarnings,
    setFullscreenWarnings,
  ] = useState(0);

  const [
    showFullscreenWarning,
    setShowFullscreenWarning,
  ] = useState(false);

  const [
    checkpointBusy,
    setCheckpointBusy,
  ] = useState(false);

  const stateRef =
    useRef({});

  const attemptRef =
    useRef(null);

  const snapshotRef =
    useRef({});

  const submittedRef =
    useRef(false);

  const saveTimerRef =
    useRef(null);

  const fullscreenWarningsRef =
    useRef(0);

  const violationLockRef =
    useRef(false);

  const tabWasHiddenRef =
    useRef(false);

  const forceSubmitTimerRef =
    useRef(null);

  const submitTestRef =
    useRef(null);

  const enterFullscreenRef =
    useRef(null);

  useEffect(() => {
    stateRef.current =
      questionsState;
  }, [questionsState]);

  useEffect(() => {
    attemptRef.current =
      attempt;
  }, [attempt]);

  const timedSections =
    useMemo(
      () =>
        sections.filter(
          (section) =>
            Number(
              section.durationMinutes ||
                0
            ) > 0
        ),
      [sections]
    );

  const sectional =
    Boolean(
      test?.sectional
    ) &&
    timedSections.length >
      0;

  const fixedTimer =
    !sectional &&
    Number(
      test?.durationMinutes ||
        0
    ) > 0;

  const isDpp =
    String(
      test?.categorySlug ||
        test?.category ||
        ""
    )
      .trim()
      .toLowerCase() ===
      "dpp" ||
    Boolean(test?.isDpp);

  const currentQuestion =
    questions.find(
      (question) =>
        Number(
          question.id
        ) ===
        Number(
          currentQuestionId
        )
    ) || null;

  const activeSection =
    timedSections[
      activeSectionIndex
    ] ||
    timedSections[0] ||
    null;

  const sectionQuestions =
    useMemo(() => {
      if (
        !sectional ||
        !activeSection
      ) {
        return questions;
      }

      const direct =
        questions.filter(
          (question) =>
            Number(
              question.sectionId
            ) ===
            Number(
              activeSection.id
            )
        );

      if (
        direct.length > 0
      ) {
        return direct;
      }

      return questions;
    }, [
      questions,
      sectional,
      activeSection,
    ]);

  const currentSectionQuestionIndex =
    Math.max(
      0,
      sectionQuestions.findIndex(
        (question) =>
          Number(
            question.id
          ) ===
          Number(
            currentQuestionId
          )
      )
    );

  /*
  |--------------------------------------------------------------------------
  | PHASE 1
  |
  | Current question is the LAST question of the current section?
  |--------------------------------------------------------------------------
  */

  const isLastQuestionOfCurrentSection =
    Boolean(
      currentQuestion
    ) &&
    sectionQuestions.length >
      0 &&
    Number(
      sectionQuestions[
        sectionQuestions.length - 1
      ]?.id
    ) ===
      Number(
        currentQuestionId
      );

  /*
  |--------------------------------------------------------------------------
  | PHASE 1
  |
  | Current question is the LAST question of the ENTIRE TEST?
  |--------------------------------------------------------------------------
  |
  | Only this question is allowed to show SUBMIT TEST
  | in the bottom navigation.
  |--------------------------------------------------------------------------
  */

  const isLastQuestionOfEntireTest =
    Boolean(
      currentQuestion
    ) &&
    questions.length > 0 &&
    Number(
      questions[
        questions.length - 1
      ]?.id
    ) ===
      Number(
        currentQuestionId
      );

  /*
  |--------------------------------------------------------------------------
  | PHASE 1
  |
  | The footer Next button is disabled when:
  |
  | 1. Current question is last of current section
  | 2. Current section still has time remaining
  | 3. There is another section after it
  |
  | This prevents opening the next section early.
  |--------------------------------------------------------------------------
  */

  const currentSectionHasNextSection =
    sectional &&
    activeSectionIndex <
      timedSections.length - 1;

  const sectionBoundaryLocked =
    isLastQuestionOfCurrentSection &&
    currentSectionHasNextSection;

  const allowedQuestionIds =
    useMemo(
      () =>
        new Set(
          sectionQuestions.map(
            (question) =>
              Number(
                question.id
              )
          )
        ),
      [sectionQuestions]
    );

  const answeredCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            questionsState[
              question.id
            ]?.selectedOption !==
            null
        ).length,
      [
        questions,
        questionsState,
      ]
    );

  const markedCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            questionsState[
              question.id
            ]?.markedForReview
        ).length,
      [
        questions,
        questionsState,
      ]
    );

  const answeredReviewCount =
    useMemo(
      () =>
        questions.filter(
          (question) => {
            const state =
              questionsState[
                question.id
              ];

            return (
              state?.markedForReview &&
              state?.selectedOption !==
                null
            );
          }
        ).length,
      [
        questions,
        questionsState,
      ]
    );

  const reviewOnlyCount =
    Math.max(
      0,
      markedCount -
        answeredReviewCount
    );

  const visitedCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            questionsState[
              question.id
            ]?.visited
        ).length,
      [
        questions,
        questionsState,
      ]
    );

  const notVisitedCount =
    Math.max(
      0,
      questions.length -
        visitedCount
    );

  const notAnsweredCount =
    Math.max(
      0,
      questions.length -
        answeredCount -
        notVisitedCount
    );

  /*
  |--------------------------------------------------------------------------
  | GO TO QUESTION
  |--------------------------------------------------------------------------
  */

  const goToQuestion =
    useCallback(
      (questionId) => {
        const question =
          questions.find(
            (item) =>
              Number(
                item.id
              ) ===
              Number(
                questionId
              )
          );

        if (!question) {
          return;
        }

        /*
         * Never allow a question outside the currently unlocked
         * section in a sectional test.
         */
        if (
          sectional &&
          !allowedQuestionIds.has(
            Number(
              question.id
            )
          )
        ) {
          return;
        }

        setCurrentQuestionId(
          Number(question.id)
        );

        setQuestionsState(
          (prev) => ({
            ...prev,
            [question.id]: {
              ...(prev[
                question.id
              ] || {
                selectedOption:
                  null,
                markedForReview:
                  false,
                timeSpentSeconds:
                  0,
                visited:
                  false,
              }),
              visited:
                true,
            },
          })
        );

        setMobilePalette(
          false
        );
      },
      [
        questions,
        sectional,
        allowedQuestionIds,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | CHECKPOINT
  |--------------------------------------------------------------------------
  */

  const getChangedAnswers =
    useCallback(() => {
      const current =
        stateRef.current;

      const snapshot =
        snapshotRef.current;

      const changed = [];

      for (
        const question of questions
      ) {
        const item =
          current[
            question.id
          ];

        if (!item) {
          continue;
        }

        const selectedOptionId =
          item.selectedOption ==
          null
            ? null
            : Number(
                question
                  .options?.[
                  item.selectedOption
                ]?.id
              );

        const payload = {
          questionId:
            Number(
              question.id
            ),

          selectedOptionId,

          visited:
            Boolean(
              item.visited
            ),

          markedForReview:
            Boolean(
              item.markedForReview
            ),

          timeSpentSeconds:
            Math.max(
              0,
              Math.floor(
                Number(
                  item.timeSpentSeconds ||
                    0
                )
              )
            ),
        };

        const previous =
          snapshot[
            question.id
          ];

        if (
          !previous ||
          previous.selectedOptionId !==
            payload.selectedOptionId ||
          previous.visited !==
            payload.visited ||
          previous.markedForReview !==
            payload.markedForReview ||
          previous.timeSpentSeconds !==
            payload.timeSpentSeconds
        ) {
          changed.push(
            payload
          );
        }
      }

      return changed;
    }, [questions]);

  const saveCheckpoint =
    useCallback(
      async ({
        force = false,
        keepalive = false,
      } = {}) => {
        if (
          !attemptRef.current?.id ||
          submittedRef.current ||
          questions.length ===
            0
        ) {
          return true;
        }

        const changed =
          getChangedAnswers();

        if (
          changed.length ===
            0 &&
          !force
        ) {
          return true;
        }

        if (
          checkpointBusy &&
          !keepalive
        ) {
          return false;
        }

        if (!keepalive) {
          setCheckpointBusy(
            true
          );
        }

        try {
          const response =
            await fetch(
              `/api/test/${encodeURIComponent(
                String(series)
              )}/${encodeURIComponent(
                String(id)
              )}/checkpoint`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials:
                  "include",

                body: JSON.stringify({
                  attemptId:
                    Number(
                      attemptRef
                        .current
                        .id
                    ),

                  answers:
                    changed,
                }),

                ...(keepalive
                  ? {
                      keepalive:
                        true,
                    }
                  : {}),
              }
            );

          const data =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (!response.ok) {
            if (
              response.status ===
                401 ||
              data?.code ===
                "SESSION_REVOKED"
            ) {
              router.replace(
                `/auth/login?next=${encodeURIComponent(
                  window.location.pathname +
                    window.location.search
                )}`
              );
            }

            return false;
          }

          for (
            const item of changed
          ) {
            snapshotRef.current[
              item.questionId
            ] = item;
          }

          return true;
        } catch (error) {
          console.error(
            "Checkpoint error:",
            error
          );

          return false;
        } finally {
          if (!keepalive) {
            setCheckpointBusy(
              false
            );
          }
        }
      },
      [
        getChangedAnswers,
        checkpointBusy,
        series,
        id,
        router,
        questions.length,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | SUBMIT
  |--------------------------------------------------------------------------
  */

  const submitTest =
    useCallback(
      async (auto = false) => {
        if (
          submittedRef.current ||
          submitting ||
          !attemptRef.current?.id
        ) {
          return;
        }

        setSubmitting(true);

        try {
          const checkpointSaved =
            await saveCheckpoint({
              force: true,
            });

          if (!checkpointSaved) {
            throw new Error(
              "Unable to save your latest answers. Please try again."
            );
          }

          const response =
            await fetch(
              `/api/test/${encodeURIComponent(
                String(series)
              )}/${encodeURIComponent(
                String(id)
              )}/submit`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                credentials:
                  "include",

                body: JSON.stringify({
                  attemptId:
                    Number(
                      attemptRef
                        .current
                        .id
                    ),
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
            response.status ===
              401 ||
            data?.code ===
              "SESSION_REVOKED"
          ) {
            router.replace(
              `/auth/login?next=${encodeURIComponent(
                window.location.pathname +
                  window.location.search
              )}`
            );

            return;
          }

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Unable to submit test."
            );
          }

          if (
            !data?.result?.attemptId
          ) {
            throw new Error(
              "Invalid submission response."
            );
          }

          submittedRef.current =
            true;

          try {
            sessionStorage.setItem(
              `spiderman_result_${data.result.attemptId}`,
              JSON.stringify(
                data.result
              )
            );

            localStorage.removeItem(
              `spiderman_attempt_${data.result.attemptId}`
            );
          } catch {}

          if (
            document.fullscreenElement
          ) {
            try {
              await document.exitFullscreen();
            } catch {}
          }

          toast.success(
            auto
              ? "Test submitted automatically."
              : "Test submitted successfully."
          );

          router.replace(
            `/test/${encodeURIComponent(
              String(series)
            )}/${encodeURIComponent(
              String(id)
            )}/result?attemptId=${encodeURIComponent(
              data.result.attemptId
            )}`
          );
        } catch (error) {
          console.error(
            "Submit error:",
            error
          );

          toast.error(
            error?.message ||
              "Unable to submit test."
          );
        } finally {
          setSubmitting(
            false
          );
        }
      },
      [
        id,
        series,
        router,
        saveCheckpoint,
        submitting,
      ]
    );

  useEffect(() => {
    submitTestRef.current =
      submitTest;
  }, [submitTest]);

  /*
  |--------------------------------------------------------------------------
  | LOAD ATTEMPT
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !id ||
      !series ||
      !attemptId
    ) {
      return;
    }

    let cancelled = false;

    const load =
      async () => {
        try {
          setLoading(true);
          setLoadError("");

          const response =
            await fetch(
              `/api/test/${encodeURIComponent(
                String(series)
              )}/${encodeURIComponent(
                String(id)
              )}/attempt?attemptId=${encodeURIComponent(
                String(attemptId)
              )}`,
              {
                method: "GET",
                credentials:
                  "include",
                cache: "no-store",
              }
            );

          const data =
            await response
              .json()
              .catch(
                () => ({})
              );

          if (!response.ok) {
            if (
              response.status ===
                401 ||
              data?.code ===
                "SESSION_REVOKED"
            ) {
              router.replace(
                `/auth/login?next=${encodeURIComponent(
                  window.location.pathname +
                    window.location.search
                )}`
              );

              return;
            }

            throw new Error(
              data?.error ||
                "Unable to load test."
            );
          }

          if (cancelled) {
            return;
          }

          const loadedTest =
            data?.test ||
            null;

          const loadedAttempt =
            data?.attempt ||
            null;

          const loadedSections =
            Array.isArray(
              data?.sections
            )
              ? data.sections
              : [];

          const loadedQuestions =
            Array.isArray(
              data?.questions
            )
              ? data.questions
              : [];

          if (!loadedTest) {
            throw new Error(
              "Test data is missing."
            );
          }

          if (
            !loadedAttempt?.id
          ) {
            throw new Error(
              "Attempt data is missing."
            );
          }

          if (
            !loadedQuestions.length
          ) {
            throw new Error(
              "No questions were found for this test."
            );
          }

          const normalizedSections =
            loadedSections.map(
              (section) => ({
                ...section,

                id: Number(
                  section.id ??
                    section.sectionId
                ),

                sectionName:
                  section.sectionName ??
                  section.section_name ??
                  "Section",

                durationMinutes:
                  Number(
                    section.durationMinutes ??
                      section.duration_minutes ??
                      0
                  ),

                questionCount:
                  Number(
                    section.questionCount ??
                      section.question_count ??
                      0
                  ),

                isSequential:
                  Boolean(
                    section.isSequential ??
                      section.is_sequential ??
                      false
                  ),

                timerGroup:
                  section.timerGroup ??
                  section.timer_group ??
                  null,
              })
            );

          const normalizedQuestions =
            loadedQuestions.map(
              (question) => ({
                ...question,

                id: Number(
                  question.id ??
                    question.questionId
                ),

                sectionId:
                  question.sectionId !=
                  null
                    ? Number(
                        question.sectionId
                      )
                    : question.section_id !=
                      null
                    ? Number(
                        question.section_id
                      )
                    : null,

                questionText:
                  question.questionText ??
                  question.question_text ??
                  "",

                /*
                 * Question image support.
                 */
                questionImageUrl:
                  question.questionImageUrl ??
                  question.question_image_url ??
                  null,

                marks:
                  Number(
                    question.marks ??
                      0
                  ),

                negativeMarks:
                  Number(
                    question.negativeMarks ??
                      question.negative_marks ??
                      0
                  ),

                options: (
                  Array.isArray(
                    question.options
                  )
                    ? question.options
                    : []
                ).map(
                  (option) => ({
                    ...option,

                    id: Number(
                      option.id
                    ),

                    label:
                      option.label ??
                      option.optionLabel ??
                      option.option_label ??
                      "",

                    text:
                      option.text ??
                      option.optionText ??
                      option.option_text ??
                      "",
                  })
                ),
              })
            );

          const restored =
            createQuestionState(
              normalizedQuestions,
              data?.savedAnswers ??
                data?.saved_answers ??
                []
            );

          /*
           * Restore local backup.
           */

          try {
            const backup =
              localStorage.getItem(
                `spiderman_attempt_${loadedAttempt.id}`
              );

            if (backup) {
              const parsed =
                JSON.parse(
                  backup
                );

              if (
                parsed?.questionsState &&
                typeof parsed.questionsState ===
                  "object"
              ) {
                Object.entries(
                  parsed.questionsState
                ).forEach(
                  ([
                    questionId,
                    item,
                  ]) => {
                    restored[
                      questionId
                    ] = {
                      ...(restored[
                        questionId
                      ] || {}),
                      ...item,
                    };
                  }
                );
              }
            }
          } catch {}

          if (cancelled) {
            return;
          }

          stateRef.current =
            restored;

          attemptRef.current =
            loadedAttempt;

          snapshotRef.current =
            {};

          setTest(
            loadedTest
          );

          setAttempt(
            loadedAttempt
          );

          setSections(
            normalizedSections
          );

          setQuestions(
            normalizedQuestions
          );

          setQuestionsState(
            restored
          );

          const firstQuestion =
            normalizedQuestions.find(
              (question) =>
                restored[
                  question.id
                ]?.visited
            ) ||
            normalizedQuestions[0];

          setCurrentQuestionId(
            firstQuestion
              ? Number(
                  firstQuestion.id
                )
              : null
          );
        } catch (error) {
          console.error(
            "Attempt load error:",
            error
          );

          if (!cancelled) {
            setLoadError(
              error?.message ||
                "Unable to load test."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    load();

    return () => {
      cancelled = true;
    };
  }, [
    id,
    series,
    attemptId,
    router,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LOCAL BACKUP
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !attempt?.id ||
      !questions.length
    ) {
      return;
    }

    clearTimeout(
      saveTimerRef.current
    );

    saveTimerRef.current =
      window.setTimeout(() => {
        try {
          localStorage.setItem(
            `spiderman_attempt_${attempt.id}`,
            JSON.stringify({
              questionsState:
                stateRef.current,

              savedAt:
                new Date().toISOString(),
            })
          );
        } catch {}
      }, 250);

    return () =>
      clearTimeout(
        saveTimerRef.current
      );
  }, [
    questionsState,
    attempt?.id,
    questions.length,
  ]);

  /*
  |--------------------------------------------------------------------------
  | SERVER CHECKPOINT EVERY 60 SECONDS
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !attempt?.id ||
      loading ||
      submittedRef.current
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        saveCheckpoint();
      }, 60000);

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    attempt?.id,
    loading,
    saveCheckpoint,
  ]);

  /*
  |--------------------------------------------------------------------------
  | MASTER TIMER
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !attempt?.id ||
      loading
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        const startedAt =
          getTimestamp(
            attemptRef.current
              ?.startedAt
          );

        if (
          !Number.isFinite(
            startedAt
          )
        ) {
          return;
        }

        const elapsed =
          Math.max(
            0,
            Math.floor(
              (Date.now() -
                startedAt) /
                1000
            )
          );

        setElapsedSeconds(
          elapsed
        );

        /*
         * DPP is stopwatch style.
         */

        if (isDpp) {
          return;
        }

        /*
         * Sectional timer.
         *
         * Only THIS timer is allowed to
         * unlock the next section.
         */

        if (
          sectional &&
          timedSections.length
        ) {
          let cursor =
            elapsed;

          let activeIndex =
            timedSections.length -
            1;

          let remaining = 0;

          for (
            let index = 0;
            index <
            timedSections.length;
            index += 1
          ) {
            const duration =
              Number(
                timedSections[
                  index
                ]
                  .durationMinutes ||
                  0
              ) * 60;

            if (
              cursor <
              duration
            ) {
              activeIndex =
                index;

              remaining =
                duration -
                cursor;

              break;
            }

            cursor -=
              duration;
          }

          setRemainingSeconds(
            Math.max(
              0,
              remaining
            )
          );

          /*
           * Section transition happens only
           * here, after timer calculation.
           */

          if (
            activeIndex !==
              activeSectionIndex
          ) {
            setActiveSectionIndex(
              activeIndex
            );

            const nextQuestions =
              questions.filter(
                (question) =>
                  Number(
                    question.sectionId
                  ) ===
                  Number(
                    timedSections[
                      activeIndex
                    ]?.id
                  )
              );

            if (
              nextQuestions[0]
            ) {
              setCurrentQuestionId(
                Number(
                  nextQuestions[0].id
                )
              );
            }
          }

          /*
           * Final section timeout.
           */

          if (
            remaining === 0 &&
            elapsed > 0 &&
            activeIndex ===
              timedSections.length -
                1
          ) {
            submitTestRef.current?.(
              true
            );
          }

          return;
        }

        /*
         * Fixed full-test timer.
         */

        if (fixedTimer) {
          const total =
            Number(
              test?.durationMinutes ||
                0
            ) * 60;

          const remaining =
            Math.max(
              0,
              total - elapsed
            );

          setRemainingSeconds(
            remaining
          );

          if (
            total > 0 &&
            remaining === 0
          ) {
            submitTestRef.current?.(
              true
            );
          }
        }
      }, 1000);

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    attempt?.id,
    loading,
    isDpp,
    sectional,
    timedSections,
    activeSectionIndex,
    questions,
    fixedTimer,
    test?.durationMinutes,
  ]);

  /*
  |--------------------------------------------------------------------------
  | QUESTION TIME
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !attempt?.id ||
      loading ||
      submittedRef.current
    ) {
      return;
    }

    const timer =
      window.setInterval(() => {
        setQuestionsState(
          (prev) => {
            if (
              !currentQuestionId ||
              !prev[
                currentQuestionId
              ]
            ) {
              return prev;
            }

            const next = {
              ...prev,

              [currentQuestionId]:
                {
                  ...prev[
                    currentQuestionId
                  ],

                  timeSpentSeconds:
                    Number(
                      prev[
                        currentQuestionId
                      ]
                        .timeSpentSeconds ||
                        0
                    ) + 1,
                },
            };

            stateRef.current =
              next;

            return next;
          }
        );
      }, 1000);

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    attempt?.id,
    loading,
    currentQuestionId,
  ]);

  /*
  |--------------------------------------------------------------------------
  | FULLSCREEN
  |--------------------------------------------------------------------------
  */

  const enterFullscreen =
    useCallback(
      async () => {
        try {
          if (
            !document.fullscreenElement &&
            document.documentElement
              .requestFullscreen
          ) {
            await document.documentElement.requestFullscreen();
          }

          setShowFullscreenWarning(
            false
          );
        } catch (error) {
          console.warn(
            "Fullscreen request failed:",
            error
          );
        }
      },
      []
    );

  useEffect(() => {
    enterFullscreenRef.current =
      enterFullscreen;
  }, [enterFullscreen]);

  /*
  |--------------------------------------------------------------------------
  | INITIAL FULLSCREEN
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      loading ||
      !attempt?.id ||
      submittedRef.current
    ) {
      return;
    }

    enterFullscreen();

    const handleFirstInteraction =
      () => {
        if (
          !document.fullscreenElement
        ) {
          enterFullscreenRef.current?.();
        }
      };

    window.addEventListener(
      "pointerdown",
      handleFirstInteraction,
      {
        once: true,
        passive: true,
      }
    );

    return () => {
      window.removeEventListener(
        "pointerdown",
        handleFirstInteraction
      );
    };
  }, [
    loading,
    attempt?.id,
    enterFullscreen,
  ]);

  /*
  |--------------------------------------------------------------------------
  | REGISTER VIOLATION
  |--------------------------------------------------------------------------
  */

  const registerViolation =
    useCallback(
      (reason) => {
        if (
          submittedRef.current ||
          !attemptRef.current?.id
        ) {
          return;
        }

        if (
          violationLockRef.current
        ) {
          return;
        }

        violationLockRef.current =
          true;

        window.setTimeout(() => {
          violationLockRef.current =
            false;
        }, 1200);

        fullscreenWarningsRef.current +=
          1;

        const next =
          Math.min(
            3,
            fullscreenWarningsRef.current
          );

        setFullscreenWarnings(
          next
        );

        setShowFullscreenWarning(
          true
        );

        if (reason === "tab") {
          toast.warning(
            "Tab switching detected."
          );
        }

        if (
          reason ===
          "fullscreen"
        ) {
          toast.warning(
            "Fullscreen exit detected."
          );
        }

        if (next >= 3) {
          if (
            forceSubmitTimerRef.current
          ) {
            clearTimeout(
              forceSubmitTimerRef.current
            );
          }

          forceSubmitTimerRef.current =
            window.setTimeout(() => {
              setShowFullscreenWarning(
                false
              );

              submitTestRef.current?.(
                true
              );
            }, 800);
        }
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | FULLSCREEN CHANGE
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      loading ||
      !attempt?.id
    ) {
      return;
    }

    const onFullscreenChange =
      () => {
        if (
          !document.fullscreenElement &&
          !submittedRef.current
        ) {
          registerViolation(
            "fullscreen"
          );
        }
      };

    document.addEventListener(
      "fullscreenchange",
      onFullscreenChange
    );

    return () =>
      document.removeEventListener(
        "fullscreenchange",
        onFullscreenChange
      );
  }, [
    loading,
    attempt?.id,
    registerViolation,
  ]);

  /*
  |--------------------------------------------------------------------------
  | TAB SWITCH
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      loading ||
      !attempt?.id
    ) {
      return;
    }

    const onVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "hidden"
        ) {
          tabWasHiddenRef.current =
            true;

          saveCheckpoint({
            keepalive: true,
          });

          return;
        }

        if (
          document.visibilityState ===
            "visible" &&
          tabWasHiddenRef.current
        ) {
          tabWasHiddenRef.current =
            false;

          registerViolation(
            "tab"
          );
        }
      };

    document.addEventListener(
      "visibilitychange",
      onVisibilityChange
    );

    return () =>
      document.removeEventListener(
        "visibilitychange",
        onVisibilityChange
      );
  }, [
    loading,
    attempt?.id,
    saveCheckpoint,
    registerViolation,
  ]);

  /*
  |--------------------------------------------------------------------------
  | DEVTOOLS / CONTEXT MENU
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      loading ||
      !attempt?.id
    ) {
      return;
    }

    const onContextMenu =
      (event) => {
        event.preventDefault();
      };

    const onKeyDown =
      (event) => {
        const key =
          String(
            event.key || ""
          ).toLowerCase();

        const ctrlOrMeta =
          event.ctrlKey ||
          event.metaKey;

        const blocked =
          key === "f12" ||
          (ctrlOrMeta &&
            event.shiftKey &&
            [
              "i",
              "j",
              "c",
            ].includes(
              key
            )) ||
          (ctrlOrMeta &&
            key === "u");

        if (blocked) {
          event.preventDefault();
          event.stopPropagation();

          toast.warning(
            "This action is disabled during the test."
          );
        }
      };

    const onDragStart =
      (event) => {
        event.preventDefault();
      };

    document.addEventListener(
      "contextmenu",
      onContextMenu
    );

    window.addEventListener(
      "keydown",
      onKeyDown,
      true
    );

    document.addEventListener(
      "dragstart",
      onDragStart
    );

    return () => {
      document.removeEventListener(
        "contextmenu",
        onContextMenu
      );

      window.removeEventListener(
        "keydown",
        onKeyDown,
        true
      );

      document.removeEventListener(
        "dragstart",
        onDragStart
      );
    };
  }, [
    loading,
    attempt?.id,
  ]);

  /*
  |--------------------------------------------------------------------------
  | BEFORE UNLOAD
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (
      !attempt?.id ||
      loading
    ) {
      return;
    }

    const onBeforeUnload =
      () => {
        if (
          attemptRef.current?.id &&
          !submittedRef.current
        ) {
          try {
            saveCheckpoint({
              keepalive: true,
            });
          } catch {}
        }
      };

    window.addEventListener(
      "beforeunload",
      onBeforeUnload
    );

    return () =>
      window.removeEventListener(
        "beforeunload",
        onBeforeUnload
      );
  }, [
    attempt?.id,
    loading,
    saveCheckpoint,
  ]);

  /*
  |--------------------------------------------------------------------------
  | CLEANUP
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      if (
        forceSubmitTimerRef.current
      ) {
        clearTimeout(
          forceSubmitTimerRef.current
        );
      }
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | KEYBOARD NAVIGATION
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    if (loading) {
      return;
    }

    const handleKey =
      (event) => {
        if (
          event.ctrlKey ||
          event.metaKey ||
          event.altKey
        ) {
          return;
        }

        if (
          event.key ===
          "ArrowRight"
        ) {
          event.preventDefault();

          /*
           * Uses the same guarded navigation function
           * as the footer.
           */
          nextQuestion();
        }

        if (
          event.key ===
          "ArrowLeft"
        ) {
          event.preventDefault();

          goToQuestion(
            sectionQuestions[
              currentSectionQuestionIndex -
                1
            ]?.id
          );
        }
      };

    window.addEventListener(
      "keydown",
      handleKey
    );

    return () =>
      window.removeEventListener(
        "keydown",
        handleKey
      );
  }, [
    goToQuestion,
    sectionQuestions,
    currentSectionQuestionIndex,
    loading,
  ]);

  /*
  |--------------------------------------------------------------------------
  | OPTION SELECTION
  |--------------------------------------------------------------------------
  */

  const selectOption = (
    optionIndex
  ) => {
    if (!currentQuestion) {
      return;
    }

    setQuestionsState(
      (prev) => ({
        ...prev,

        [currentQuestion.id]:
          {
            ...(prev[
              currentQuestion.id
            ] || {}),

            visited: true,

            selectedOption:
              prev[
                currentQuestion.id
              ]?.selectedOption ===
              optionIndex
                ? null
                : optionIndex,
          },
      })
    );
  };

  /*
  |--------------------------------------------------------------------------
  | REVIEW
  |--------------------------------------------------------------------------
  */

  const toggleReview = () => {
    if (!currentQuestion) {
      return;
    }

    setQuestionsState(
      (prev) => ({
        ...prev,

        [currentQuestion.id]:
          {
            ...(prev[
              currentQuestion.id
            ] || {}),

            visited: true,

            markedForReview:
              !prev[
                currentQuestion.id
              ]?.markedForReview,
          },
      })
    );
  };

  /*
  |--------------------------------------------------------------------------
  | NEXT / PREVIOUS
  |--------------------------------------------------------------------------
  |
  | IMPORTANT PHASE 1 FIX:
  |
  | nextQuestion NEVER manually opens another section.
  |
  | If current section has ended:
  |   - do nothing
  |   - timer is responsible for unlocking next section
  |--------------------------------------------------------------------------
  */

  const nextQuestion =
    useCallback(() => {
      const index =
        sectionQuestions.findIndex(
          (question) =>
            Number(
              question.id
            ) ===
            Number(
              currentQuestionId
            )
        );

      if (index < 0) {
        return;
      }

      /*
       * Normal question inside current section.
       */
      const next =
        sectionQuestions[
          index + 1
        ];

      if (next) {
        goToQuestion(
          next.id
        );

        return;
      }

      /*
       * CURRENT SECTION ENDED.
       *
       * NEVER jump into the next section here.
       *
       * The timer effect is the ONLY place that
       * unlocks the next section.
       */
      if (
        sectional &&
        activeSectionIndex <
          timedSections.length - 1
      ) {
        return;
      }

      /*
       * If this is the final question of the entire
       * test, there is also nothing to navigate to.
       *
       * The footer shows Submit Test separately.
       */
    }, [
      sectionQuestions,
      currentQuestionId,
      goToQuestion,
      sectional,
      activeSectionIndex,
      timedSections.length,
    ]);

  const previousQuestion =
    useCallback(() => {
      const index =
        sectionQuestions.findIndex(
          (question) =>
            Number(
              question.id
            ) ===
            Number(
              currentQuestionId
            )
        );

      const previous =
        sectionQuestions[
          index - 1
        ];

      if (previous) {
        goToQuestion(
          previous.id
        );
      }
    }, [
      sectionQuestions,
      currentQuestionId,
      goToQuestion,
    ]);

  /*
  |--------------------------------------------------------------------------
  | SECTION SELECTION
  |--------------------------------------------------------------------------
  */

  const selectSection =
    (index) => {
      if (
        !sectional ||
        !timedSections[index]
      ) {
        return;
      }

      /*
       * Existing sequential-section behavior
       * remains untouched.
       */
      if (
        timedSections[index]
          .isSequential &&
        index >
          activeSectionIndex
      ) {
        return;
      }

      setActiveSectionIndex(
        index
      );

      const first =
        questions.find(
          (question) =>
            Number(
              question.sectionId
            ) ===
            Number(
              timedSections[index]
                .id
            )
        );

      if (first) {
        goToQuestion(
          first.id
        );
      }
    };

  /*
  |--------------------------------------------------------------------------
  | CURRENT STATE
  |--------------------------------------------------------------------------
  */

  const currentState =
    currentQuestion
      ? questionsState[
          currentQuestion.id
        ] || {
          visited: false,
          selectedOption:
            null,
          markedForReview:
            false,
          timeSpentSeconds:
            0,
        }
      : null;

  /*
  |--------------------------------------------------------------------------
  | HEADER TIMER
  |--------------------------------------------------------------------------
  */

  const headerTime =
    isDpp
      ? elapsedSeconds
      : sectional ||
        fixedTimer
      ? remainingSeconds
      : elapsedSeconds;

  const currentQuestionNumber =
    questions.findIndex(
      (question) =>
        Number(
          question.id
        ) ===
        Number(
          currentQuestion?.id
        )
    ) + 1;

  /*
  |--------------------------------------------------------------------------
  | LOADING
  |--------------------------------------------------------------------------
  */

  if (loading) {
    return (
      <SpiderManLoader text="Loading Test..." />
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ERROR
  |--------------------------------------------------------------------------
  */

  if (
    loadError ||
    !test ||
    !attempt ||
    !currentQuestion
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-[500px] rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
            <AlertTriangle className="h-7 w-7" />
          </div>

          <h1 className="mt-5 text-xl font-extrabold text-slate-900">
            Unable to load test
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {loadError ||
              "Something went wrong while loading this test."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            className="mt-6 cursor-pointer rounded-xl bg-[#ef1118] px-6 py-3 text-sm font-bold text-white"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  /*
  |--------------------------------------------------------------------------
  | MAIN UI
  |--------------------------------------------------------------------------
  */

  return (
    <div className="fixed inset-0 z-[100] flex h-screen h-[100dvh] w-screen flex-col overflow-hidden bg-[#f8fafc] font-sans">
      {/* ================================================================ */}
      {/* HEADER */}
      {/* ================================================================ */}

      <header className="shrink-0 border-b border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
        <div className="flex h-[72px] items-center justify-between px-4 sm:px-5 lg:px-8">
          <div className="min-w-0">
            <div className="truncate text-[16px] font-extrabold tracking-[-0.01em] text-slate-900 sm:text-[17px]">
              {test.title}
            </div>

            <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
              {test.seriesName} · Attempt{" "}
              {
                attempt.attemptNumber
              }
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMobilePalette(
                  true
                )
              }
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 lg:hidden"
            >
              Palette
            </button>

            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-extrabold ${
                headerTime <= 60 &&
                (sectional ||
                  fixedTimer)
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              <Clock3 className="h-4 w-4" />

              {formatTime(
                headerTime
              )}
            </div>
          </div>
        </div>

        {sectional && (
          <div className="flex min-h-[58px] items-center gap-2 overflow-x-auto border-t border-slate-200 bg-[#f1f5f9] px-3 sm:px-5 lg:px-8">
            {timedSections.map(
              (
                section,
                index
              ) => {
                const active =
                  index ===
                  activeSectionIndex;

                const locked =
                  Boolean(
                    section.isSequential
                  ) &&
                  index >
                    activeSectionIndex;

                return (
                  <button
                    key={
                      section.id
                    }
                    type="button"
                    disabled={
                      locked
                    }
                    onClick={() =>
                      selectSection(
                        index
                      )
                    }
                    className={`shrink-0 cursor-pointer rounded-lg border px-4 py-2.5 text-sm font-extrabold transition disabled:cursor-not-allowed ${
                      active
                        ? "border-[#1d4ed8] bg-[#1d4ed8] text-white shadow-sm"
                        : locked
                        ? "border-slate-200 bg-slate-100 text-slate-400"
                        : "border-slate-300 bg-white text-slate-700 hover:border-[#94a3b8] hover:bg-white"
                    }`}
                  >
                    {
                      section.sectionName
                    }
                  </button>
                );
              }
            )}
          </div>
        )}
      </header>

      {/* ================================================================ */}
      {/* BODY */}
      {/* ================================================================ */}

      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col">
            {/* QUESTION HEADER */}

            <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
              <div className="flex items-center gap-2">
                <span className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-extrabold text-slate-700 shadow-[0_1px_3px_rgba(15,23,42,0.08)]">
                  Question{" "}
                  {
                    currentQuestionNumber
                  }
                </span>

                <span className="rounded-lg bg-green-50 px-2.5 py-1.5 text-sm font-extrabold text-green-600">
                  +
                  {
                    currentQuestion.marks
                  }
                </span>

                <span className="rounded-lg bg-red-50 px-2.5 py-1.5 text-sm font-extrabold text-red-500">
                  -
                  {
                    currentQuestion.negativeMarks
                  }
                </span>

                <button
                  type="button"
                  onClick={() =>
                    toast.info(
                      "Report feature will be available soon."
                    )
                  }
                  aria-label="Report question"
                  className="ml-auto flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-slate-400 transition hover:text-slate-600"
                >
                  <Flag className="h-4 w-4" />

                  <span className="hidden sm:inline">
                    Report
                  </span>
                </button>
              </div>
            </div>

            {/* QUESTION BODY */}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 pb-28 lg:px-8 lg:pb-8">
              <div className="mx-auto w-full max-w-[1000px]">
                {currentQuestion.questionText ? (
                  <div className="whitespace-pre-wrap text-[20px] leading-8 tracking-[-0.01em] text-slate-800 sm:text-[22px]">
                    {
                      currentQuestion.questionText
                    }
                  </div>
                ) : null}

                {/* QUESTION IMAGE */}

                {currentQuestion.questionImageUrl ? (
                  <div
                    className={`${
                      currentQuestion.questionText
                        ? "mt-7"
                        : ""
                    } overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_1px_3px_rgba(15,23,42,0.06)]`}
                  >
                    <img
                      src={
                        currentQuestion.questionImageUrl
                      }
                      alt={`Question ${currentQuestionNumber}`}
                      className="mx-auto block h-auto max-h-[65vh] w-auto max-w-full object-contain"
                      loading="eager"
                      draggable={
                        false
                      }
                    />
                  </div>
                ) : null}

                <div className="relative left-1/2 mt-7 w-[calc(100%+16px)] -translate-x-1/2 space-y-3 sm:w-[calc(100%+24px)]">
                  {currentQuestion.options.map(
                    (
                      option,
                      index
                    ) => {
                      const selected =
                        currentState?.selectedOption ===
                        index;

                      return (
                        <button
                          key={
                            option.id
                          }
                          type="button"
                          onClick={() =>
                            selectOption(
                              index
                            )
                          }
                          className={`flex w-full cursor-pointer items-start gap-4 rounded-2xl border-2 px-5 py-4 text-left transition sm:px-6 ${
                            selected
                              ? "border-[#2563eb] bg-blue-50 shadow-[0_8px_25px_rgba(37,99,235,0.08)]"
                              : "border-slate-200 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.08)] hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold ${
                              selected
                                ? "border-[#2563eb] bg-[#2563eb] text-white"
                                : "border-slate-300 bg-white text-slate-700"
                            }`}
                          >
                            {
                              option.label
                            }
                          </span>

                          <span className="whitespace-pre-wrap text-[17px] leading-7 text-slate-700">
                            {
                              option.text
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            </div>

            {/* ============================================================
                FOOTER
            ============================================================ */}

            <div className="fixed bottom-0 left-0 right-0 z-[220] border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-8px_25px_rgba(15,23,42,0.08)] backdrop-blur lg:static lg:z-auto lg:bg-white lg:px-8 lg:py-4 lg:shadow-none">
              <div className="mx-auto flex w-full max-w-[1000px] items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      toggleReview
                    }
                    className={`cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-extrabold transition sm:px-4 sm:text-sm ${
                      currentState?.markedForReview
                        ? "border-purple-300 bg-purple-50 text-purple-700"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Flag className="mr-1.5 inline h-4 w-4" />

                    <span className="hidden sm:inline">
                      Mark for Review
                    </span>

                    <span className="sm:hidden">
                      Review
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      previousQuestion
                    }
                    disabled={
                      !sectionQuestions[
                        currentSectionQuestionIndex -
                          1
                      ]
                    }
                    className="cursor-pointer rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous question"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  {/*
                   * =======================================================
                   * PHASE 1 FOOTER FIX
                   * =======================================================
                   *
                   * SUBMIT TEST ONLY appears on the FINAL QUESTION
                   * OF THE ENTIRE TEST.
                   *
                   * At the end of Section 1 / Section 2 / etc:
                   * Save & Next remains visible but disabled until
                   * the timer unlocks the next section.
                   */}

                  {isLastQuestionOfEntireTest ? (
                    <button
                      type="button"
                      onClick={() =>
                        setShowSubmitModal(
                          true
                        )
                      }
                      className="cursor-pointer rounded-xl bg-gradient-to-r from-[#d41445] to-[#e3003f] px-4 py-2.5 text-xs font-extrabold text-white shadow-sm sm:px-5 sm:text-sm"
                    >
                      SUBMIT TEST
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={
                        nextQuestion
                      }
                      disabled={
                        sectionBoundaryLocked
                      }
                      className={`rounded-xl px-4 py-2.5 text-xs font-extrabold shadow-sm sm:px-5 sm:text-sm ${
                        sectionBoundaryLocked
                          ? "cursor-not-allowed bg-slate-300 text-slate-500 shadow-none"
                          : "cursor-pointer bg-[#2563eb] text-white hover:bg-[#1d4ed8]"
                      }`}
                    >
                      Save & Next
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ============================================================ */}
        {/* DESKTOP PALETTE */}
        {/* ============================================================ */}

        {desktopPalette && (
          <aside className="hidden w-[340px] shrink-0 border-l border-slate-200 bg-[#f8fafc] lg:flex lg:flex-col">
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
              <div className="text-[17px] font-extrabold text-slate-800">
                Question Palette
              </div>

              <button
                type="button"
                onClick={() =>
                  setDesktopPalette(
                    false
                  )
                }
                className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Collapse palette"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2">
                <LegendIcon
                  type={
                    STATUS.ANSWERED
                  }
                  count={
                    answeredCount
                  }
                />

                <span className="text-xs font-semibold text-slate-600">
                  Answered
                </span>
              </div>

              <div className="flex items-center gap-2">
                <LegendIcon
                  type={
                    STATUS.NOT_ANSWERED
                  }
                  count={
                    notAnsweredCount
                  }
                />

                <span className="text-xs font-semibold text-slate-600">
                  Not Answered
                </span>
              </div>

              <div className="flex items-center gap-2">
                <LegendIcon
                  type={
                    STATUS.NOT_VISITED
                  }
                  count={
                    notVisitedCount
                  }
                />

                <span className="text-xs font-semibold text-slate-600">
                  Not Visited
                </span>
              </div>

              <div className="flex items-center gap-2">
                <LegendIcon
                  type={
                    STATUS.REVIEW
                  }
                  count={
                    reviewOnlyCount
                  }
                />

                <span className="text-xs font-semibold text-slate-600">
                  Review
                </span>
              </div>

              <div className="col-span-2 flex items-center gap-2">
                <LegendIcon
                  type={
                    STATUS.ANSWERED_REVIEW
                  }
                  count={
                    answeredReviewCount
                  }
                />

                <span className="text-xs font-semibold text-slate-600">
                  Answered & Marked
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-5 gap-x-3 gap-y-4">
                {sectionQuestions.map(
                  (question) => {
                    const state =
                      questionsState[
                        question.id
                      ] || {
                        visited: false,
                        selectedOption:
                          null,
                        markedForReview:
                          false,
                      };

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
                        className="flex cursor-pointer items-center justify-center"
                      >
                        <PaletteIcon
                          status={getStatus(
                            state
                          )}
                          number={
                            questions.findIndex(
                              (q) =>
                                q.id ===
                                question.id
                            ) + 1
                          }
                          current={
                            Number(
                              currentQuestion.id
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
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-4">
              <button
                type="button"
                onClick={() =>
                  setShowSubmitModal(
                    true
                  )
                }
                className="w-full cursor-pointer rounded-md bg-gradient-to-r from-[#d41445] to-[#e3003f] px-5 py-3.5 text-sm font-extrabold tracking-wide text-white shadow-lg"
              >
                SUBMIT TEST
              </button>
            </div>
          </aside>
        )}

        {!desktopPalette && (
          <button
            type="button"
            onClick={() =>
              setDesktopPalette(
                true
              )
            }
            className="absolute right-0 top-[120px] z-20 hidden cursor-pointer items-center justify-center rounded-l-xl border border-r-0 border-slate-200 bg-white p-3 text-slate-600 shadow-md lg:flex"
            aria-label="Open palette"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}

        {/* ============================================================ */}
        {/* MOBILE PALETTE */}
        {/* ============================================================ */}

        {mobilePalette && (
          <>
            <button
              type="button"
              onClick={() =>
                setMobilePalette(
                  false
                )
              }
              className="fixed inset-0 z-[300] cursor-pointer bg-slate-900/50 lg:hidden"
              aria-label="Close palette"
            />

            <aside className="fixed right-0 top-0 z-[301] flex h-full w-[320px] max-w-[88vw] flex-col bg-[#f8fafc] shadow-2xl lg:hidden">
              <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
                <div className="text-[17px] font-extrabold text-slate-800">
                  Question Palette
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setMobilePalette(
                      false
                    )
                  }
                  className="cursor-pointer rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-4 border-b border-slate-200 bg-white p-5">
                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.ANSWERED
                    }
                    count={
                      answeredCount
                    }
                  />

                  <span className="text-xs font-semibold text-slate-600">
                    Answered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.NOT_ANSWERED
                    }
                    count={
                      notAnsweredCount
                    }
                  />

                  <span className="text-xs font-semibold text-slate-600">
                    Not Answered
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.NOT_VISITED
                    }
                    count={
                      notVisitedCount
                    }
                  />

                  <span className="text-xs font-semibold text-slate-600">
                    Not Visited
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <LegendIcon
                    type={
                      STATUS.REVIEW
                    }
                    count={
                      reviewOnlyCount
                    }
                  />

                  <span className="text-xs font-semibold text-slate-600">
                    Review
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="grid grid-cols-5 gap-4">
                  {sectionQuestions.map(
                    (question) => {
                      const state =
                        questionsState[
                          question.id
                        ] || {
                          visited: false,
                          selectedOption:
                            null,
                          markedForReview:
                            false,
                        };

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
                          className="flex cursor-pointer items-center justify-center"
                        >
                          <PaletteIcon
                            status={getStatus(
                              state
                            )}
                            number={
                              questions.findIndex(
                                (q) =>
                                  q.id ===
                                  question.id
                              ) + 1
                            }
                            current={
                              Number(
                                currentQuestion.id
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
              </div>

              <div className="shrink-0 border-t border-slate-200 bg-white p-4">
                <button
                  type="button"
                  onClick={() => {
                    setMobilePalette(
                      false
                    );

                    setShowSubmitModal(
                      true
                    );
                  }}
                  className="w-full cursor-pointer rounded-md bg-gradient-to-r from-[#d41445] to-[#e3003f] px-5 py-3.5 text-sm font-extrabold tracking-wide text-white"
                >
                  SUBMIT TEST
                </button>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* ================================================================ */}
      {/* SUBMIT MODAL */}
      {/* ================================================================ */}

      {showSubmitModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/65 px-4 backdrop-blur-md">
          <div className="relative w-full max-w-[520px] overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl">
            <div className="h-1.5 w-full bg-gradient-to-r from-[#ef1118] via-[#ff4350] to-[#ef1118]" />

            <div className="p-7 sm:p-8">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ef1118] text-white shadow-lg shadow-red-200">
                  <Flag className="h-7 w-7" />
                </div>
              </div>

              <div className="mt-6 text-center">
                <h2 className="text-2xl font-black tracking-tight text-slate-900">
                  Submit Your Test?
                </h2>

                <p className="mx-auto mt-2 max-w-[390px] text-sm leading-6 text-slate-500">
                  Once submitted, this attempt cannot be continued.
                </p>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-black text-green-600">
                    {
                      answeredCount
                    }
                  </div>

                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Answered
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-black text-orange-500">
                    {
                      notAnsweredCount
                    }
                  </div>

                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Not Answered
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-black text-purple-600">
                    {
                      markedCount
                    }
                  </div>

                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Marked
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
                  <div className="text-2xl font-black text-slate-700">
                    {formatTime(
                      elapsedSeconds
                    )}
                  </div>

                  <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">
                    Time Used
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    setShowSubmitModal(
                      false
                    )
                  }
                  disabled={
                    submitting
                  }
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Continue Test
                </button>

                <button
                  type="button"
                  onClick={() =>
                    submitTest(
                      false
                    )
                  }
                  disabled={
                    submitting
                  }
                  className="cursor-pointer rounded-xl bg-[#ef1118] px-5 py-3 text-sm font-extrabold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Submitting..."
                    : "Yes, Submit Test"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* FULLSCREEN / TAB WARNING */}
      {/* ================================================================ */}

      {showFullscreenWarning && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[430px] rounded-3xl bg-white p-7 text-center shadow-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h3 className="mt-5 text-xl font-black text-slate-900">
              {fullscreenWarnings >=
              3
                ? "Final Warning"
                : "Fullscreen exited"}
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {fullscreenWarnings >=
              3
                ? "Third violation detected. Your test will be submitted automatically."
                : "Please return to fullscreen to continue the test."}
            </p>

            <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">
              Warning{" "}
              {Math.min(
                fullscreenWarnings,
                3
              )}{" "}
              / 3
            </div>

            {fullscreenWarnings <
            3 ? (
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFullscreenWarning(
                      false
                    );

                    submitTest(
                      false
                    );
                  }}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-extrabold text-slate-700"
                >
                  Submit Test
                </button>

                <button
                  type="button"
                  onClick={() =>
                    enterFullscreenRef.current?.()
                  }
                  className="flex-1 cursor-pointer rounded-xl bg-[#ef1118] px-4 py-3 text-sm font-extrabold text-white"
                >
                  Return Fullscreen
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm font-extrabold text-red-600">
                Submitting test...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}