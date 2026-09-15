import { NextResponse } from "next/server";
import { db } from "@/lib/turso";
import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  toNumber,
  toBoolean,
  firstDefined,
  toIsoUtc,
  jsonError,
  requireAuthenticatedUser,
  requireSeriesAccess,
  getTestById,
  getTestCategory,
  requireTestAvailability,
} from "@/lib/testSecurity";

/* =========================================================
   ATTEMPT LIMITS
   ---------------------------------------------------------
   FIX: attempt limit now depends on category (DPP vs mock),
   matching the product rule — DPP/small tests get 4
   attempts, everything else (mocks) gets 3. Previously this
   was a single hardcoded MAX_ATTEMPTS = 3 for every category.
========================================================= */
const DEFAULT_MAX_ATTEMPTS = 3;
const DPP_MAX_ATTEMPTS = 4;

/* =========================================================
   TIMER HELPERS
========================================================= */

function getTimerMode(eventId) {
  return Number(eventId || 0) > 0 ? "live" : "active";
}

function calculateActiveSeconds(storedSeconds, lastActiveAt) {
  let total = Math.max(0, Number(storedSeconds || 0));

  if (!lastActiveAt) {
    return Math.floor(total);
  }

  const text = String(lastActiveAt);
  const parsed = text.includes("T")
    ? new Date(text)
    : new Date(`${text.replace(" ", "T")}Z`);

  const timestamp = parsed.getTime();

  if (!Number.isFinite(timestamp)) {
    return Math.floor(total);
  }

  total += Math.max(0, Math.floor((Date.now() - timestamp) / 1000));

  return Math.floor(total);
}

function getRemainingSeconds(durationSeconds, usedSeconds) {
  return Math.max(
    0,
    Number(durationSeconds || 0) - Math.max(0, Number(usedSeconds || 0))
  );
}

/* =========================================================
   TEST META
========================================================= */

function buildTestMeta(test, category, testId) {
  const categorySlug = String(firstDefined(category?.slug, ""))
    .trim()
    .toLowerCase();

  return {
    id: Number(testId),
    title: firstDefined(test?.title, `Test ${testId}`),
    slug: firstDefined(test?.slug, null),
    description: firstDefined(test?.description, ""),
    categoryId: normalizeId(firstDefined(test?.category_id, test?.categoryId)),
    categorySlug,
    categoryName: firstDefined(category?.name, null),
    isDpp: categorySlug === "dpp",
    isActive: Number(firstDefined(test?.is_active, test?.isActive, 0)) === 1,
    isPublished: toBoolean(firstDefined(test?.is_published, test?.isPublished, 0)),
    durationMinutes: toNumber(
      firstDefined(test?.duration_minutes, test?.durationMinutes, 0),
      0
    ),
    totalQuestions: toNumber(
      firstDefined(test?.total_questions, test?.totalQuestions, 0),
      0
    ),
    totalMarks: toNumber(firstDefined(test?.total_marks, test?.totalMarks, 0), 0),
  };
}

/* =========================================================
   ATTEMPT SERIALIZER
========================================================= */

function serializeAttempt(row, testRow) {
  const eventId = firstDefined(row?.event_id, row?.eventId, null);
  const mode = getTimerMode(eventId);

  const storedActiveSeconds = toNumber(
    firstDefined(row?.active_seconds, row?.activeSeconds, 0),
    0
  );
  const lastActiveAt = firstDefined(row?.last_active_at, row?.lastActiveAt, null);

  const active =
    mode === "active"
      ? calculateActiveSeconds(storedActiveSeconds, lastActiveAt)
      : storedActiveSeconds;

  const durationMinutes = toNumber(
    firstDefined(testRow?.duration_minutes, testRow?.durationMinutes, 0),
    0
  );
  const durationSeconds = durationMinutes * 60;

  return {
    id: Number(row.id),
    userId: Number(firstDefined(row.user_id, row.userId, 0)),
    testId: Number(firstDefined(row.test_id, row.testId, 0)),
    eventId: eventId === null || eventId === undefined ? null : Number(eventId),
    attemptNumber: Number(firstDefined(row.attempt_number, row.attemptNumber, 1)),
    attempt_number: Number(firstDefined(row.attempt_number, row.attemptNumber, 1)),
    status: String(firstDefined(row.status, "in_progress")).toLowerCase(),
    startedAt: toIsoUtc(firstDefined(row.started_at, row.startedAt)),
    started_at: toIsoUtc(firstDefined(row.started_at, row.startedAt)),
    submittedAt: toIsoUtc(firstDefined(row.submitted_at, row.submittedAt)),
    submitted_at: toIsoUtc(firstDefined(row.submitted_at, row.submittedAt)),
    deadlineAt: toIsoUtc(firstDefined(row.deadline_at, row.deadlineAt)),
    deadline_at: toIsoUtc(firstDefined(row.deadline_at, row.deadlineAt)),
    score: row.score === null || row.score === undefined ? null : Number(row.score),
    totalMarks: toNumber(
      firstDefined(row.total_marks, row.totalMarks, testRow?.total_marks, 0),
      0
    ),
    correctCount: toNumber(firstDefined(row.correct_count, row.correctCount, 0), 0),
    wrongCount: toNumber(firstDefined(row.wrong_count, row.wrongCount, 0), 0),
    unansweredCount: toNumber(
      firstDefined(row.unanswered_count, row.unansweredCount, 0),
      0
    ),
    timeTakenSeconds: toNumber(
      firstDefined(row.time_taken_seconds, row.timeTakenSeconds, 0),
      0
    ),
    createdAt: toIsoUtc(firstDefined(row.created_at, row.createdAt)),
    timerMode: mode,
    activeSeconds: active,
    storedActiveSeconds: storedActiveSeconds,
    lastActiveAt: toIsoUtc(lastActiveAt),
    remainingSeconds:
      mode === "active" ? getRemainingSeconds(durationSeconds, active) : null,
  };
}

/* =========================================================
   CURRENT LIVE EVENT
========================================================= */

async function findCurrentLiveEvent(config, testId) {
  const eventTable = config.testTable.replace("_tests", "_test_events");

  const result = await db.execute({
    sql: `
      SELECT
        id,
        test_id,
        start_at,
        start_window_end,
        duration_minutes,
        auto_submit,
        is_published
      FROM ${eventTable}
      WHERE
        test_id = ?
        AND is_published = 1
        AND start_at <= CURRENT_TIMESTAMP
        AND start_window_end >= CURRENT_TIMESTAMP
      ORDER BY
        start_at DESC,
        id DESC
      LIMIT 1
    `,
    args: [testId],
  });

  return result.rows?.[0] || null;
}

/* =========================================================
   TIMER ACTION
========================================================= */

async function handleTimerAction({
  config,
  userId,
  testId,
  timerAction,
  attemptId,
  testRow,
}) {
  const result = await db.execute({
    sql: `
      SELECT *
      FROM ${config.attemptTable}
      WHERE
        id = ?
        AND user_id = ?
        AND test_id = ?
      LIMIT 1
    `,
    args: [attemptId, userId, testId],
  });

  const attempt = result.rows?.[0];

  if (!attempt) {
    return jsonError("Attempt not found.", 404, "ATTEMPT_NOT_FOUND");
  }

  if (String(attempt.status || "").toLowerCase() !== "in_progress") {
    return jsonError("This attempt is no longer active.", 409, "ATTEMPT_NOT_ACTIVE");
  }

  const mode = getTimerMode(firstDefined(attempt.event_id, attempt.eventId, null));

  /*
   * LIVE tests ignore pause/heartbeat.
   * Their fixed event deadline remains authoritative.
   */
  if (mode === "live") {
    return NextResponse.json({
      success: true,
      timerMode: "live",
      action: timerAction,
      paused: false,
      activeSeconds: 0,
      remainingSeconds: null,
      deadlineAt: toIsoUtc(attempt.deadline_at),
    });
  }

  const durationSeconds = Math.max(
    0,
    toNumber(firstDefined(testRow?.duration_minutes, testRow?.durationMinutes, 0), 0) *
      60
  );

  const stored = toNumber(firstDefined(attempt.active_seconds, attempt.activeSeconds, 0), 0);

  let current = calculateActiveSeconds(
    stored,
    firstDefined(attempt.last_active_at, attempt.lastActiveAt, null)
  );
  current = Math.min(current, durationSeconds);

  const remaining = getRemainingSeconds(durationSeconds, current);

  /* -------------------------------------------------------
     PAUSE
  ------------------------------------------------------- */
  if (timerAction === "pause") {
    await db.execute({
      sql: `
        UPDATE ${config.attemptTable}
        SET
          active_seconds = ?,
          last_active_at = NULL,
          deadline_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
        WHERE
          id = ?
          AND user_id = ?
          AND test_id = ?
          AND status = 'in_progress'
      `,
      args: [current, remaining, attemptId, userId, testId],
    });

    return NextResponse.json({
      success: true,
      timerMode: "active",
      action: "pause",
      paused: true,
      activeSeconds: current,
      remainingSeconds: remaining,
    });
  }

  /* -------------------------------------------------------
     RESUME
  ------------------------------------------------------- */
  if (timerAction === "resume") {
    if (remaining <= 0) {
      return NextResponse.json(
        {
          success: true,
          timerMode: "active",
          action: "resume",
          paused: true,
          activeSeconds: durationSeconds,
          remainingSeconds: 0,
          expired: true,
        },
        { status: 409 }
      );
    }

    await db.execute({
      sql: `
        UPDATE ${config.attemptTable}
        SET
          active_seconds = ?,
          last_active_at = CURRENT_TIMESTAMP,
          deadline_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
        WHERE
          id = ?
          AND user_id = ?
          AND test_id = ?
          AND status = 'in_progress'
      `,
      args: [current, remaining, attemptId, userId, testId],
    });

    return NextResponse.json({
      success: true,
      timerMode: "active",
      action: "resume",
      paused: false,
      activeSeconds: current,
      remainingSeconds: remaining,
    });
  }

  /* -------------------------------------------------------
     HEARTBEAT
  ------------------------------------------------------- */
  if (remaining <= 0) {
    await db.execute({
      sql: `
        UPDATE ${config.attemptTable}
        SET
          active_seconds = ?,
          last_active_at = NULL,
          deadline_at = CURRENT_TIMESTAMP
        WHERE
          id = ?
          AND user_id = ?
          AND test_id = ?
          AND status = 'in_progress'
      `,
      args: [durationSeconds, attemptId, userId, testId],
    });

    return NextResponse.json(
      {
        success: true,
        timerMode: "active",
        action: "heartbeat",
        paused: true,
        activeSeconds: durationSeconds,
        remainingSeconds: 0,
        expired: true,
      },
      { status: 409 }
    );
  }

  await db.execute({
    sql: `
      UPDATE ${config.attemptTable}
      SET
        active_seconds = ?,
        last_active_at = CURRENT_TIMESTAMP,
        deadline_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
      WHERE
        id = ?
        AND user_id = ?
        AND test_id = ?
        AND status = 'in_progress'
    `,
    args: [current, remaining, attemptId, userId, testId],
  });

  return NextResponse.json({
    success: true,
    timerMode: "active",
    action: "heartbeat",
    paused: false,
    activeSeconds: current,
    remainingSeconds: remaining,
  });
}

/* =========================================================
   GET ATTEMPT
========================================================= */

export async function GET(request, { params }) {
  try {
    const { series: rawSeries, id: rawId } = await params;

    const series = normalizeSeries(rawSeries);
    const testId = normalizeId(rawId);
    const attemptId = normalizeId(new URL(request.url).searchParams.get("attemptId"));

    if (!SERIES_CONFIG[series]) {
      return jsonError("Invalid test series.", 400, "INVALID_SERIES");
    }

    if (!testId) {
      return jsonError("Invalid test ID.", 400, "INVALID_TEST_ID");
    }

    if (!attemptId) {
      return jsonError("Attempt ID is required.", 400, "ATTEMPT_ID_REQUIRED");
    }

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) {
      return auth.response;
    }

    const { userId, currentUser } = auth;

    const access = requireSeriesAccess(currentUser, series);
    if (!access.ok) {
      return access.response;
    }

    const testResult = await getTestById(series, testId);
    if (!testResult.ok) {
      return testResult.response;
    }

    const { config, test: testRow } = testResult;
    const category = await getTestCategory(testRow);

    const [attemptResult, sectionResult, questionResult, answerResult] =
      await Promise.all([
        db.execute({
          sql: `
            SELECT *
            FROM ${config.attemptTable}
            WHERE id = ? AND user_id = ? AND test_id = ?
            LIMIT 1
          `,
          args: [attemptId, userId, testId],
        }),
        db.execute({
          sql: `
            SELECT *
            FROM ${config.sectionTable}
            WHERE test_id = ?
            ORDER BY section_order ASC, id ASC
          `,
          args: [testId],
        }),
        db.execute({
          sql: `
            SELECT *
            FROM ${config.questionTable}
            WHERE test_id = ?
            ORDER BY question_order ASC, id ASC
          `,
          args: [testId],
        }),
        db.execute({
          sql: `
            SELECT *
            FROM ${config.answerTable}
            WHERE attempt_id = ?
            ORDER BY question_id ASC
          `,
          args: [attemptId],
        }),
      ]);

    const attemptRow = attemptResult.rows?.[0];

    if (!attemptRow) {
      return jsonError("Attempt not found.", 404, "ATTEMPT_NOT_FOUND");
    }

    /* =======================================================
       FIX: explanation must never leak while the attempt is
       still in progress. It is only safe to send back once
       this attempt is submitted — result/analysis routes
       already use this exact rule; this route was the one
       place that didn't.
    ======================================================= */
    const isSubmittedAttempt =
      String(firstDefined(attemptRow.status, "in_progress")).toLowerCase() ===
      "submitted";

    const sections = (sectionResult.rows || []).map((section, index) => ({
      id: Number(section.id),
      testId,
      sectionName: firstDefined(
        section.section_name,
        section.sectionName,
        `Section ${index + 1}`
      ),
      sectionOrder: Number(
        firstDefined(section.section_order, section.sectionOrder, index + 1)
      ),
      durationMinutes:
        firstDefined(section.duration_minutes, section.durationMinutes) == null
          ? null
          : Number(firstDefined(section.duration_minutes, section.durationMinutes)),
      questionCount: Number(
        firstDefined(section.question_count, section.questionCount, 0)
      ),
      isSequential: toBoolean(
        firstDefined(section.is_sequential, section.isSequential, 0)
      ),
      timerGroup: firstDefined(section.timer_group, section.timerGroup, null),
    }));

    const rawQuestions = questionResult.rows || [];

    if (rawQuestions.length === 0) {
      return jsonError("No questions were found for this test.", 422, "NO_QUESTIONS");
    }

    const questionIds = rawQuestions
      .map((q) => Number(q.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    let rawOptions = [];

    if (questionIds.length) {
      const placeholders = questionIds.map(() => "?").join(",");

      const optionsResult = await db.execute({
        sql: `
          SELECT *
          FROM ${config.optionTable}
          WHERE question_id IN (${placeholders})
          ORDER BY question_id ASC, option_order ASC, id ASC
        `,
        args: questionIds,
      });

      rawOptions = optionsResult.rows || [];
    }

    const optionsByQuestion = new Map();

    for (const option of rawOptions) {
      const questionId = Number(firstDefined(option.question_id, option.questionId));

      if (!Number.isInteger(questionId)) {
        continue;
      }

      if (!optionsByQuestion.has(questionId)) {
        optionsByQuestion.set(questionId, []);
      }

      const label = firstDefined(option.option_label, option.optionLabel, "");
      const text = firstDefined(option.option_text, option.optionText, option.text, "");

      optionsByQuestion.get(questionId).push({
        id: Number(option.id),
        label,
        text,
        optionLabel: label,
        optionText: text,
        optionOrder: Number(firstDefined(option.option_order, option.optionOrder, 0)),
      });
    }

    const answersByQuestion = new Map();

    for (const answer of answerResult.rows || []) {
      const questionId = Number(firstDefined(answer.question_id, answer.questionId));

      if (!Number.isInteger(questionId) || questionId <= 0) {
        continue;
      }

      answersByQuestion.set(questionId, {
        selectedOptionId:
          firstDefined(answer.selected_option_id, answer.selectedOptionId) == null
            ? null
            : Number(firstDefined(answer.selected_option_id, answer.selectedOptionId)),
        timeSpentSeconds: Number(
          firstDefined(answer.time_spent_seconds, answer.timeSpentSeconds, 0)
        ),
        answeredAt: toIsoUtc(firstDefined(answer.answered_at, answer.answeredAt)),
        visited: toBoolean(firstDefined(answer.visited, 0)),
        markedForReview: toBoolean(
          firstDefined(answer.marked_for_review, answer.markedForReview, 0)
        ),
      });
    }

    const sectionMap = new Map(sections.map((section) => [section.id, section]));

    const questions = rawQuestions.map((question, index) => {
      const questionId = Number(question.id);
      const sectionIdValue = firstDefined(question.section_id, question.sectionId);
      const sectionId = sectionIdValue == null ? null : Number(sectionIdValue);
      const saved = answersByQuestion.get(questionId);

      return {
        id: questionId,
        testId,
        sectionId,
        sectionName:
          sectionId != null ? sectionMap.get(sectionId)?.sectionName || null : null,
        questionText: firstDefined(
          question.question_text,
          question.questionText,
          question.text,
          ""
        ),
        questionImageUrl: firstDefined(
          question.question_image_url,
          question.questionImageUrl,
          null
        ),

        /*
         * FIX: only reveal the explanation once this attempt
         * has actually been submitted. Previously this leaked
         * on every load — including mid-attempt — letting
         * anyone read the correct-answer explanation via the
         * network tab while the test was still in progress.
         */
        explanation: isSubmittedAttempt ? firstDefined(question.explanation, null) : null,

        questionType: String(
          firstDefined(question.question_type, question.questionType, "mcq")
        ).toLowerCase(),
        marks: Number(firstDefined(question.marks, 0)),
        negativeMarks: Number(
          firstDefined(question.negative_marks, question.negativeMarks, 0)
        ),
        questionOrder: Number(
          firstDefined(question.question_order, question.questionOrder, index + 1)
        ),
        options: optionsByQuestion.get(questionId) || [],
        selectedOptionId: saved?.selectedOptionId ?? null,
        timeSpentSeconds: saved?.timeSpentSeconds ?? 0,
        answeredAt: saved?.answeredAt ?? null,
        visited: saved?.visited ?? false,
        markedForReview: saved?.markedForReview ?? false,
      };
    });

    const meta = buildTestMeta(testRow, category, testId);

    const hasTimedSections = sections.some(
      (section) => Number(section.durationMinutes || 0) > 0
    );
    const sectional = !meta.isDpp && hasTimedSections;

    return NextResponse.json(
      {
        success: true,
        test: { ...meta, isSectional: sectional, sectional },
        attempt: serializeAttempt(attemptRow, testRow),
        sections,
        questions,
        meta: {
          series,
          seriesId: config.seriesId,
          testId,
          attemptId,
          questionCount: questions.length,
          optionCount: rawOptions.length,
          sectionCount: sections.length,
          savedAnswerCount: answerResult.rows?.length || 0,
          availabilityCheckSkipped: true,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          Pragma: "no-cache",
        },
      }
    );
  } catch (error) {
    console.error("[GET attempt] ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Failed to load test attempt." },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST ATTEMPT
========================================================= */

export async function POST(request, { params }) {
  try {
    const { series: rawSeries, id: rawId } = await params;

    const series = normalizeSeries(rawSeries);
    const testId = normalizeId(rawId);

    if (!SERIES_CONFIG[series]) {
      return jsonError("Invalid test series.", 400, "INVALID_SERIES");
    }

    if (!testId) {
      return jsonError("Invalid test ID.", 400, "INVALID_TEST_ID");
    }

    const config = SERIES_CONFIG[series];

    const auth = await requireAuthenticatedUser();
    if (!auth.ok) {
      return auth.response;
    }

    const { userId, currentUser } = auth;

    const access = requireSeriesAccess(currentUser, series);
    if (!access.ok) {
      return access.response;
    }

    const body = await request.json().catch(() => ({}));

    const mode = String(body?.mode || "new").trim().toLowerCase();
    const attemptId = normalizeId(body?.attemptId);
    const abandonAttemptId = normalizeId(body?.abandonAttemptId);
    const timerAction = String(body?.timerAction || "").trim().toLowerCase();

    if (mode !== "new" && mode !== "resume") {
      return jsonError("Invalid attempt mode.", 400, "INVALID_MODE");
    }

    const testResult = await getTestById(series, testId);
    if (!testResult.ok) {
      return testResult.response;
    }

    const { test: testRow } = testResult;
    const category = await getTestCategory(testRow);

    /* =======================================================
       FIX: attempt limit now depends on the test's category —
       DPP/small tests get 4 attempts, everything else (mocks)
       gets 3, matching the intended product rule. Previously
       this was hardcoded to 3 for every category.
    ======================================================= */
    const categorySlugForAttempts = String(firstDefined(category?.slug, ""))
      .trim()
      .toLowerCase();
    const isDppTest = categorySlugForAttempts === "dpp";
    const maxAttempts = isDppTest ? DPP_MAX_ATTEMPTS : DEFAULT_MAX_ATTEMPTS;

    /* -------------------------------------------------------
       TIMER ACTIONS
    ------------------------------------------------------- */
    if (
      timerAction === "pause" ||
      timerAction === "resume" ||
      timerAction === "heartbeat"
    ) {
      if (!attemptId) {
        return jsonError("Valid attempt ID is required.", 400, "ATTEMPT_ID_REQUIRED");
      }

      return handleTimerAction({ config, userId, testId, timerAction, attemptId, testRow });
    }

    /* -------------------------------------------------------
       ABANDON OLD ATTEMPT
    ------------------------------------------------------- */
    if (abandonAttemptId) {
      await db.execute({
        sql: `
          UPDATE ${config.attemptTable}
          SET status = 'abandoned', submitted_at = CURRENT_TIMESTAMP, last_active_at = NULL
          WHERE id = ? AND user_id = ? AND test_id = ? AND status = 'in_progress'
        `,
        args: [abandonAttemptId, userId, testId],
      });
    }

    /* -------------------------------------------------------
       EXPLICIT RESUME
    ------------------------------------------------------- */
    if (mode === "resume") {
      if (!attemptId) {
        return jsonError("Valid attempt ID is required.", 400, "ATTEMPT_ID_REQUIRED");
      }

      const result = await db.execute({
        sql: `
          SELECT *
          FROM ${config.attemptTable}
          WHERE id = ? AND user_id = ? AND test_id = ?
          LIMIT 1
        `,
        args: [attemptId, userId, testId],
      });

      const attempt = result.rows?.[0];

      if (!attempt) {
        return jsonError("Attempt not found.", 404, "ATTEMPT_NOT_FOUND");
      }

      if (String(attempt.status || "") !== "in_progress") {
        return jsonError("This attempt is no longer active.", 409, "ATTEMPT_NOT_ACTIVE");
      }

      const modeForAttempt = getTimerMode(attempt.event_id);

      if (modeForAttempt === "active") {
        const durationSeconds = Math.max(0, toNumber(testRow.duration_minutes, 0) * 60);

        const current = Math.min(
          durationSeconds,
          calculateActiveSeconds(attempt.active_seconds, attempt.last_active_at)
        );

        const remaining = getRemainingSeconds(durationSeconds, current);

        if (remaining <= 0) {
          return jsonError("This attempt has expired.", 409, "ATTEMPT_EXPIRED");
        }

        await db.execute({
          sql: `
            UPDATE ${config.attemptTable}
            SET
              active_seconds = ?,
              last_active_at = CURRENT_TIMESTAMP,
              deadline_at = datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds')
            WHERE id = ? AND user_id = ? AND test_id = ? AND status = 'in_progress'
          `,
          args: [current, remaining, attemptId, userId, testId],
        });

        attempt.active_seconds = current;
        attempt.last_active_at = new Date().toISOString();
      }

      return NextResponse.json(
        {
          success: true,
          resumed: true,
          mode: "resume",
          attempt: serializeAttempt(attempt, testRow),
          test: buildTestMeta(testRow, category, testId),
        },
        { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    /* -------------------------------------------------------
       FIND EXISTING ACTIVE ATTEMPT
    ------------------------------------------------------- */
    const existingResult = await db.execute({
      sql: `
        SELECT *
        FROM ${config.attemptTable}
        WHERE user_id = ? AND test_id = ? AND status = 'in_progress'
        ORDER BY id DESC
        LIMIT 1
      `,
      args: [userId, testId],
    });

    const existingAttempt = existingResult.rows?.[0];

    if (existingAttempt) {
      return NextResponse.json(
        {
          success: true,
          resumed: true,
          mode: "resume",
          attempt: serializeAttempt(existingAttempt, testRow),
          test: buildTestMeta(testRow, category, testId),
        },
        { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
      );
    }

    /* -------------------------------------------------------
       AVAILABILITY FOR NEW ATTEMPT
    ------------------------------------------------------- */
    const availability = await requireTestAvailability({ config, test: testRow });

    if (!availability.ok) {
      return availability.response;
    }

    /* -------------------------------------------------------
       SUBMITTED ATTEMPT COUNT
    ------------------------------------------------------- */
    const submittedResult = await db.execute({
      sql: `
        SELECT COUNT(*) AS count
        FROM ${config.attemptTable}
        WHERE user_id = ? AND test_id = ? AND status = 'submitted'
      `,
      args: [userId, testId],
    });

    const submittedCount = Number(submittedResult.rows?.[0]?.count || 0);

    if (submittedCount >= maxAttempts) {
      return jsonError(
        `You have already completed the maximum ${maxAttempts} attempts for this test.`,
        403,
        "ATTEMPTS_EXHAUSTED"
      );
    }

    /* -------------------------------------------------------
       TIMER MODE
    ------------------------------------------------------- */
    const liveEvent = await findCurrentLiveEvent(config, testId);
    const isLive = Boolean(liveEvent);
    const eventId = isLive ? Number(liveEvent.id) : null;

    const durationMinutes = Number(
      firstDefined(isLive ? liveEvent.duration_minutes : testRow.duration_minutes, 0)
    );
    const durationSeconds = Math.max(0, durationMinutes * 60);

    let deadlineAt = null;

    /*
     * LIVE: fixed event deadline.
     * SELF-PACED: virtual deadline from current remaining active time.
     * It will be shifted whenever pause/resume/heartbeat updates the attempt.
     */
    if (durationSeconds > 0) {
      if (isLive) {
        const deadlineResult = await db.execute({
          sql: `SELECT datetime(?, '+' || ? || ' minutes') AS deadline_at`,
          args: [liveEvent.start_at, Number(liveEvent.duration_minutes)],
        });

        deadlineAt = deadlineResult.rows?.[0]?.deadline_at || null;
      } else {
        const deadlineResult = await db.execute({
          sql: `SELECT datetime(CURRENT_TIMESTAMP, '+' || ? || ' seconds') AS deadline_at`,
          args: [durationSeconds],
        });

        deadlineAt = deadlineResult.rows?.[0]?.deadline_at || null;
      }
    }

    /* -------------------------------------------------------
       ATOMIC INSERT
    ------------------------------------------------------- */
    const insertResult = await db.execute({
      sql: `
        INSERT INTO ${config.attemptTable} (
          user_id, test_id, event_id, attempt_number, status,
          started_at, submitted_at, score, total_marks,
          correct_count, wrong_count, unanswered_count,
          time_taken_seconds, deadline_at, active_seconds,
          last_active_at, created_at
        )
        SELECT
          ?,
          ?,
          ?,
          COALESCE(
            (SELECT MAX(attempt_number) FROM ${config.attemptTable} WHERE user_id = ? AND test_id = ?),
            0
          ) + 1,
          'in_progress',
          CURRENT_TIMESTAMP,
          NULL,
          NULL,
          ?,
          0,
          0,
          0,
          0,
          ?,
          0,
          CASE WHEN ? = 0 THEN CURRENT_TIMESTAMP ELSE NULL END,
          CURRENT_TIMESTAMP
        WHERE
          NOT EXISTS (
            SELECT 1 FROM ${config.attemptTable}
            WHERE user_id = ? AND test_id = ? AND status = 'in_progress'
          )
          AND (
            SELECT COUNT(*) FROM ${config.attemptTable}
            WHERE user_id = ? AND test_id = ? AND status = 'submitted'
          ) < ?
        RETURNING *
      `,
      args: [
        userId,
        testId,
        eventId,
        userId,
        testId,
        toNumber(firstDefined(testRow.total_marks, testRow.totalMarks, 0), 0),
        deadlineAt,
        isLive ? 1 : 0,
        userId,
        testId,
        userId,
        testId,
        maxAttempts,
      ],
    });

    /* -------------------------------------------------------
       ATOMIC INSERT DID NOT CREATE
    ------------------------------------------------------- */
    if (!insertResult.rows?.[0]) {
      const retry = await db.execute({
        sql: `
          SELECT *
          FROM ${config.attemptTable}
          WHERE user_id = ? AND test_id = ? AND status = 'in_progress'
          ORDER BY id DESC
          LIMIT 1
        `,
        args: [userId, testId],
      });

      const raceAttempt = retry.rows?.[0];

      if (raceAttempt) {
        return NextResponse.json(
          {
            success: true,
            resumed: true,
            mode: "resume",
            attempt: serializeAttempt(raceAttempt, testRow),
            test: buildTestMeta(testRow, category, testId),
          },
          { status: 200 }
        );
      }

      return jsonError(
        `You have already completed the maximum ${maxAttempts} attempts for this test.`,
        403,
        "ATTEMPTS_EXHAUSTED"
      );
    }

    const attempt = insertResult.rows[0];

    return NextResponse.json(
      {
        success: true,
        resumed: false,
        mode: "new",
        attempt: serializeAttempt(attempt, testRow),
        submittedCount,
        maxAttempts,
        remainingAttempts: Math.max(0, maxAttempts - submittedCount),
        test: {
          ...buildTestMeta(testRow, category, testId),
          timerMode: isLive ? "live" : "active",
          eventId,
          availabilityValidated: true,
        },
      },
      { status: 200, headers: { "Cache-Control": "private, no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[POST attempt] ERROR:", error);

    return NextResponse.json(
      { error: error?.message || "Unable to start test attempt." },
      { status: 500 }
    );
  }
}