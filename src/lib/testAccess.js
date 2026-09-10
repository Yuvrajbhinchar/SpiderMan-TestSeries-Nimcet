import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

const SERIES_CONFIG = {
  free: {
    id: 1,
    name: "Free",
    isPaid: false,
    tests: "free_tests",
    sections: "free_test_sections",
    questions: "free_questions",
    options: "free_question_options",
    subjects: "free_test_subjects",
    attempts: "free_test_attempts",
    answers: "free_attempt_answers",
    events: "free_test_events",
  },
  asspire: {
    id: 2,
    name: "Asspire",
    isPaid: true,
    tests: "asspire_tests",
    sections: "asspire_test_sections",
    questions: "asspire_questions",
    options: "asspire_question_options",
    subjects: "asspire_test_subjects",
    attempts: "asspire_test_attempts",
    answers: "asspire_attempt_answers",
    events: "asspire_test_events",
  },
  imppetus: {
    id: 3,
    name: "Imppetus",
    isPaid: true,
    tests: "imppetus_tests",
    sections: "imppetus_test_sections",
    questions: "imppetus_questions",
    options: "imppetus_question_options",
    subjects: "imppetus_test_subjects",
    attempts: "imppetus_test_attempts",
    answers: "imppetus_attempt_answers",
    events: "imppetus_test_events",
  },
  spiderman: {
    id: 4,
    name: "SpiderMan",
    isPaid: true,
    tests: "spiderman_tests",
    sections: "spiderman_test_sections",
    questions: "spiderman_questions",
    options: "spiderman_question_options",
    subjects: "spiderman_test_subjects",
    attempts: "spiderman_test_attempts",
    answers: "spiderman_attempt_answers",
    events: "spiderman_test_events",
  },
};

function normalizeSeries(value) {
  const series = String(value || "").trim().toLowerCase();
  return SERIES_CONFIG[series] ? series : null;
}

export function getSeriesConfig(value) {
  const slug = normalizeSeries(value);
  return slug ? SERIES_CONFIG[slug] : null;
}

export async function requireAuthenticatedUser() {
  const current = await getCurrentUser();

  if (!current?.id || !current.sessionId || !current.deviceId) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  const result = await db.execute({
    sql: `
      SELECT
        id,
        username,
        display_name,
        role,
        is_active,
        active_session_id,
        active_device_id
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    args: [current.id],
  });

  const user = result.rows[0];

  if (!user || Number(user.is_active) !== 1) {
    return {
      ok: false,
      status: 401,
      error: "Account is inactive.",
    };
  }

  if (
    String(user.active_session_id || "") !== String(current.sessionId) ||
    String(user.active_device_id || "") !== String(current.deviceId)
  ) {
    return {
      ok: false,
      status: 401,
      code: "SESSION_REVOKED",
      error: "Your session is no longer active. Please login again.",
    };
  }

  return {
    ok: true,
    userId: Number(user.id),
    user: {
      id: Number(user.id),
      username: String(user.username),
      displayName: user.display_name ? String(user.display_name) : null,
      role: String(user.role || "user"),
    },
  };
}

export async function requireTestAccess(request, seriesOrId, maybeId) {
  const seriesSlug = maybeId === undefined ? null : normalizeSeries(seriesOrId);
  const rawTestId = maybeId === undefined ? seriesOrId : maybeId;
  const testId = Number(rawTestId);

  if (
    !seriesSlug ||
    !Number.isInteger(testId) ||
    testId <= 0
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid test route.",
    };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const config = SERIES_CONFIG[seriesSlug];

  const accessResult = await db.execute({
    sql: `
      SELECT
        ts.id,
        ts.name,
        ts.slug,
        ts.is_paid,
        ts.is_active,
        usa.id AS access_id,
        usa.is_active AS access_is_active,
        usa.expires_at AS access_expires_at
      FROM test_series ts
      LEFT JOIN user_series_access usa
        ON usa.series_id = ts.id
       AND usa.user_id = ?
      WHERE ts.id = ?
        AND ts.slug = ?
        AND ts.is_active = 1
      LIMIT 1
    `,
    args: [auth.userId, config.id, seriesSlug],
  });

  const seriesRow = accessResult.rows[0];

  if (!seriesRow) {
    return {
      ok: false,
      status: 404,
      error: "Test series not found.",
    };
  }

  const accessible =
    Number(seriesRow.is_paid || 0) === 0 ||
    (
      Number(seriesRow.access_is_active || 0) === 1 &&
      (
        !seriesRow.access_expires_at ||
        new Date(String(seriesRow.access_expires_at)).getTime() > Date.now()
      )
    );

  if (!accessible) {
    return {
      ok: false,
      status: 403,
      error: "You do not have access to this test series.",
    };
  }

  const testResult = await db.execute({
    sql: `
      SELECT
        t.id,
        t.category_id,
        t.title,
        t.slug,
        t.description,
        t.duration_minutes,
        t.total_questions,
        t.total_marks,
        t.is_published,
        tc.name AS category_name,
        tc.slug AS category_slug,
        tc.is_active AS category_is_active
      FROM ${config.tests} t
      INNER JOIN test_categories tc
        ON tc.id = t.category_id
      WHERE t.id = ?
        AND t.is_published = 1
        AND tc.is_active = 1
      LIMIT 1
    `,
    args: [testId],
  });

  const test = testResult.rows[0];

  if (!test) {
    return {
      ok: false,
      status: 404,
      error: "Test not found or unpublished.",
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    user: auth.user,
    series: {
      id: config.id,
      name: config.name,
      slug: seriesSlug,
      isPaid: config.isPaid,
    },
    config,
    test: {
      id: Number(test.id),
      categoryId: Number(test.category_id),
      categoryName: String(test.category_name),
      categorySlug: String(test.category_slug),
      title: String(test.title),
      slug: String(test.slug),
      description: test.description ? String(test.description) : null,
      durationMinutes: Number(test.duration_minutes || 0),
      totalQuestions: Number(test.total_questions || 0),
      totalMarks: Number(test.total_marks || 0),
      isPublished: Number(test.is_published || 0) === 1,
      seriesId: config.id,
      seriesName: config.name,
      seriesSlug: seriesSlug,
      isPaid: config.isPaid,
      isDpp: String(test.category_slug || "").toLowerCase() === "dpp",
    },
  };
}

export async function requireAttemptAccess(request, seriesSlug, testId, attemptId) {
  const series = normalizeSeries(seriesSlug);
  const parsedTestId = Number(testId);
  const parsedAttemptId = Number(attemptId);

  if (
    !series ||
    !Number.isInteger(parsedTestId) ||
    parsedTestId <= 0 ||
    !Number.isInteger(parsedAttemptId) ||
    parsedAttemptId <= 0
  ) {
    return {
      ok: false,
      status: 400,
      error: "Invalid attempt route.",
    };
  }

  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth;

  const config = SERIES_CONFIG[series];

  const result = await db.execute({
    sql: `
      SELECT
        id,
        user_id,
        test_id,
        attempt_number,
        status,
        started_at,
        submitted_at,
        deadline_at,
        score,
        total_marks,
        correct_count,
        wrong_count,
        unanswered_count,
        time_taken_seconds,
        created_at,
        event_id
      FROM ${config.attempts}
      WHERE id = ?
        AND user_id = ?
        AND test_id = ?
      LIMIT 1
    `,
    args: [parsedAttemptId, auth.userId, parsedTestId],
  });

  if (result.rows.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "Attempt not found or access denied.",
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    user: auth.user,
    config,
    attempt: result.rows[0],
  };
}
