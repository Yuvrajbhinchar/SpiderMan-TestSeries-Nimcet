import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/turso";

export const SERIES_CONFIG = {
  free: {
    id: 1,
    tests: "free_tests",
    sections: "free_test_sections",
    questions: "free_questions",
    options: "free_question_options",
    attempts: "free_test_attempts",
    answers: "free_attempt_answers",
    events: "free_test_events",
    accessByDefault: true,
    isPaid: false,
  },

  asspire: {
    id: 2,
    tests: "asspire_tests",
    sections: "asspire_test_sections",
    questions: "asspire_questions",
    options: "asspire_question_options",
    attempts: "asspire_test_attempts",
    answers: "asspire_attempt_answers",
    events: "asspire_test_events",
    accessByDefault: false,
    isPaid: true,
  },

  imppetus: {
    id: 3,
    tests: "imppetus_tests",
    sections: "imppetus_test_sections",
    questions: "imppetus_questions",
    options: "imppetus_question_options",
    attempts: "imppetus_test_attempts",
    answers: "imppetus_attempt_answers",
    events: "imppetus_test_events",
    accessByDefault: false,
    isPaid: true,
  },

  spiderman: {
    id: 4,
    tests: "spiderman_tests",
    sections: "spiderman_test_sections",
    questions: "spiderman_questions",
    options: "spiderman_question_options",
    attempts: "spiderman_test_attempts",
    answers: "spiderman_attempt_answers",
    events: "spiderman_test_events",
    accessByDefault: false,
    isPaid: true,
  },
};

export function getSeriesConfig(series) {
  const key = String(series || "").trim().toLowerCase();

  return SERIES_CONFIG[key]
    ? { key, ...SERIES_CONFIG[key] }
    : null;
}

export async function requireRuntimeUser() {
  const user = await getCurrentUser();

  if (!user?.id) {
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
        role,
        is_active,
        active_session_id,
        active_device_id
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    args: [user.id],
  });

  const row = result.rows?.[0];

  if (!row || Number(row.is_active) !== 1) {
    return {
      ok: false,
      status: 401,
      error: "Your account is inactive.",
    };
  }

  if (
    user.sessionId &&
    String(row.active_session_id || "") !== String(user.sessionId)
  ) {
    return {
      ok: false,
      status: 401,
      error: "Your session has expired. Please login again.",
      code: "SESSION_REVOKED",
    };
  }

  if (
    user.deviceId &&
    String(row.active_device_id || "") !== String(user.deviceId)
  ) {
    return {
      ok: false,
      status: 401,
      error: "Your session is active on another device.",
      code: "SESSION_REVOKED",
    };
  }

  return {
    ok: true,
    userId: Number(row.id),
    role: String(row.role || "user"),
  };
}

export async function getAccessibleTest(series, testId, userId) {
  const config = getSeriesConfig(series);

  if (!config) {
    return {
      ok: false,
      status: 400,
      error: "Invalid test series.",
    };
  }

  const parsedTestId = Number(testId);

  if (!Number.isInteger(parsedTestId) || parsedTestId <= 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid test id.",
    };
  }

  const currentUser = await getCurrentUser();

  if (
    !currentUser?.id ||
    Number(currentUser.id) !== Number(userId)
  ) {
    return {
      ok: false,
      status: 401,
      error: "Authentication required.",
    };
  }

  /*
   * Paid-series access is intentionally checked from the JWT
   * seriesAccess snapshot. We do not query user_series_access here.
   *
   * Free series remain freely accessible to authenticated users.
   */
  const hasSeriesAccess =
    !config.isPaid ||
    currentUser.seriesAccess?.[config.key] === true;

  if (!hasSeriesAccess) {
    return {
      ok: false,
      status: 403,
      error: "You do not have access to this test.",
      code: "SERIES_ACCESS_REQUIRED",
    };
  }

  const result = await db.execute({
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
        ts.id AS series_id,
        ts.name AS series_name,
        ts.slug AS series_slug,
        ts.is_paid
      FROM ${config.tests} t
      INNER JOIN test_categories tc
        ON tc.id = t.category_id
      INNER JOIN test_series ts
        ON ts.id = ?
      WHERE
        t.id = ?
        AND t.is_published = 1
        AND tc.is_active = 1
        AND ts.is_active = 1
      LIMIT 1
    `,
    args: [config.id, parsedTestId],
  });

  const row = result.rows?.[0];

  if (!row) {
    return {
      ok: false,
      status: 404,
      error: "Test not found.",
    };
  }

  return {
    ok: true,
    config,

    test: {
      id: Number(row.id),
      categoryId: Number(row.category_id),
      title: String(row.title),
      slug: String(row.slug),
      description: row.description ? String(row.description) : null,
      durationMinutes: Number(row.duration_minutes || 0),
      totalQuestions: Number(row.total_questions || 0),
      totalMarks: Number(row.total_marks || 0),

      seriesId: Number(row.series_id),
      seriesName: String(row.series_name),
      seriesSlug: String(row.series_slug),

      categoryName: String(row.category_name),
      categorySlug: String(row.category_slug),

      isPaid: Number(row.is_paid) === 1,
    },
  };
}

export function jsonError(message, status = 500, code) {
  return {
    error: message,
    ...(code ? { code } : {}),
    status,
  };
}