import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import { getCurrentUser } from "@/lib/auth";

/* =========================================================
   SERIES CONFIG
========================================================= */

export const SERIES_CONFIG = Object.freeze({
  free: {
    seriesId: 1,

    testTable: "free_tests",
    sectionTable: "free_test_sections",
    questionTable: "free_questions",
    optionTable: "free_question_options",

    attemptTable: "free_test_attempts",
    answerTable: "free_attempt_answers",

    testSubjectTable:
      "free_test_subjects",
  },

  asspire: {
    seriesId: 2,

    testTable: "asspire_tests",
    sectionTable: "asspire_test_sections",
    questionTable: "asspire_questions",
    optionTable: "asspire_question_options",

    attemptTable:
      "asspire_test_attempts",
    answerTable:
      "asspire_attempt_answers",

    testSubjectTable:
      "asspire_test_subjects",
  },

  imppetus: {
    seriesId: 3,

    testTable: "imppetus_tests",
    sectionTable:
      "imppetus_test_sections",
    questionTable:
      "imppetus_questions",
    optionTable:
      "imppetus_question_options",

    attemptTable:
      "imppetus_test_attempts",
    answerTable:
      "imppetus_attempt_answers",

    testSubjectTable:
      "imppetus_test_subjects",
  },

  spiderman: {
    seriesId: 4,

    testTable:
      "spiderman_tests",
    sectionTable:
      "spiderman_test_sections",
    questionTable:
      "spiderman_questions",
    optionTable:
      "spiderman_question_options",

    attemptTable:
      "spiderman_test_attempts",
    answerTable:
      "spiderman_attempt_answers",

    testSubjectTable:
      "spiderman_test_subjects",
  },
});

/* =========================================================
   BASIC HELPERS
========================================================= */

export function normalizeSeries(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

export function normalizeId(
  value
) {
  const id = Number(value);

  if (
    !Number.isInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

export function toNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : fallback;
}

export function toBoolean(
  value
) {
  return (
    value === true ||
    value === 1 ||
    value === "1"
  );
}

export function firstDefined(
  ...values
) {
  for (
    const value of values
  ) {
    if (
      value !== undefined &&
      value !== null
    ) {
      return value;
    }
  }

  return null;
}

/* =========================================================
   DATE
========================================================= */

export function toIsoUtc(
  value
) {
  if (!value) {
    return null;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  /*
   * Turso / SQLite:
   *
   * YYYY-MM-DD HH:mm:ss
   */

  if (
    text.length === 19 &&
    text[4] === "-" &&
    text[7] === "-" &&
    text[10] === " " &&
    text[13] === ":" &&
    text[16] === ":"
  ) {
    return `${text.replace(
      " ",
      "T"
    )}Z`;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

/* =========================================================
   JSON ERROR
========================================================= */

export function jsonError(
  message,
  status = 400,
  code = null
) {
  return NextResponse.json(
    {
      error: message,

      ...(code
        ? {
            code,
          }
        : {}),
    },
    {
      status,
    }
  );
}

/* =========================================================
   AUTHENTICATION
========================================================= */

export async function requireAuthenticatedUser() {
  const currentUser =
    await getCurrentUser();

  if (!currentUser?.id) {
    return {
      ok: false,

      response: jsonError(
        "Please login to continue.",
        401,
        "UNAUTHORIZED"
      ),
    };
  }

  const userId =
    Number(
      currentUser.id
    );

  if (
    !Number.isInteger(
      userId
    ) ||
    userId <= 0
  ) {
    return {
      ok: false,

      response: jsonError(
        "Invalid user session.",
        401,
        "INVALID_SESSION"
      ),
    };
  }

  /* -------------------------------------------------------
     CURRENT USER
  ------------------------------------------------------- */

  const userResult =
    await db.execute({
      sql: `
        SELECT
          id,
          username,
          email,
          display_name,
          role,
          is_active,
          active_session_id,
          active_device_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        userId,
      ],
    });

  const user =
    userResult.rows?.[0];

  if (!user) {
    return {
      ok: false,

      response: jsonError(
        "User account not found.",
        401,
        "USER_NOT_FOUND"
      ),
    };
  }

  /* -------------------------------------------------------
     ACCOUNT ACTIVE
  ------------------------------------------------------- */

  if (
    Number(
      user.is_active
    ) !== 1
  ) {
    return {
      ok: false,

      response: jsonError(
        "Your account is inactive.",
        403,
        "ACCOUNT_INACTIVE"
      ),
    };
  }

  /* -------------------------------------------------------
     JWT SESSION / DEVICE
  ------------------------------------------------------- */

  const jwtSessionId =
    firstDefined(
      currentUser.sessionId,
      currentUser.session_id,
      null
    );

  const jwtDeviceId =
    firstDefined(
      currentUser.deviceId,
      currentUser.device_id,
      null
    );

  /* -------------------------------------------------------
     SESSION MUST EXIST + MATCH
  ------------------------------------------------------- */

  if (
    !jwtSessionId ||
    !user.active_session_id ||
    String(
      jwtSessionId
    ) !==
      String(
        user.active_session_id
      )
  ) {
    return {
      ok: false,

      response: jsonError(
        "Your session is no longer active.",
        401,
        "SESSION_REVOKED"
      ),
    };
  }

  /* -------------------------------------------------------
     DEVICE MUST EXIST + MATCH
  ------------------------------------------------------- */

  if (
    !jwtDeviceId ||
    !user.active_device_id ||
    String(
      jwtDeviceId
    ) !==
      String(
        user.active_device_id
      )
  ) {
    return {
      ok: false,

      response: jsonError(
        "This device is no longer active.",
        401,
        "DEVICE_REVOKED"
      ),
    };
  }

  return {
    ok: true,

    user,

    currentUser,

    userId,
  };
}

/* =========================================================
   SERIES ACCESS
========================================================= */

/**
 * Free:
 *   always accessible.
 *
 * Paid:
 *   currentUser.seriesAccess[series] === true
 *
 * IMPORTANT:
 *   No user_series_access entitlement query.
 */

export function hasSeriesAccess(
  currentUser,
  series
) {
  const normalizedSeries =
    normalizeSeries(
      series
    );

  if (
    normalizedSeries ===
    "free"
  ) {
    return true;
  }

  return (
    currentUser?.seriesAccess?.[
      normalizedSeries
    ] === true
  );
}

/* =========================================================
   REQUIRE SERIES ACCESS
========================================================= */

export function requireSeriesAccess(
  currentUser,
  series
) {
  const normalizedSeries =
    normalizeSeries(
      series
    );

  const config =
    SERIES_CONFIG[
      normalizedSeries
    ];

  if (!config) {
    return {
      ok: false,

      response: jsonError(
        "Invalid test series.",
        400,
        "INVALID_SERIES"
      ),
    };
  }

  if (
    !hasSeriesAccess(
      currentUser,
      normalizedSeries
    )
  ) {
    return {
      ok: false,

      response: jsonError(
        "You do not have access to this test series.",
        403,
        "SERIES_ACCESS_REQUIRED"
      ),
    };
  }

  return {
    ok: true,

    series:
      normalizedSeries,

    config,
  };
}

/* =========================================================
   GET TEST
========================================================= */

export async function getTestById(
  series,
  testId
) {
  const normalizedSeries =
    normalizeSeries(
      series
    );

  const normalizedTestId =
    normalizeId(
      testId
    );

  const config =
    SERIES_CONFIG[
      normalizedSeries
    ];

  if (!config) {
    return {
      ok: false,

      response: jsonError(
        "Invalid test series.",
        400,
        "INVALID_SERIES"
      ),
    };
  }

  if (!normalizedTestId) {
    return {
      ok: false,

      response: jsonError(
        "Invalid test ID.",
        400,
        "INVALID_TEST_ID"
      ),
    };
  }

  const result =
    await db.execute({
      sql: `
        SELECT *
        FROM ${config.testTable}
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        normalizedTestId,
      ],
    });

  const test =
    result.rows?.[0];

  if (!test) {
    return {
      ok: false,

      response: jsonError(
        "Test not found.",
        404,
        "TEST_NOT_FOUND"
      ),
    };
  }

  return {
    ok: true,

    series:
      normalizedSeries,

    testId:
      normalizedTestId,

    config,

    test,
  };
}

/* =========================================================
   SERIES STATE
========================================================= */

/**
 * Checks whether the series itself is active.
 *
 * This is intentionally DB-backed because
 * test_series.is_active is an actual server-side control.
 */

export async function getSeriesState(
  seriesId
) {
  const normalizedSeriesId =
    normalizeId(
      seriesId
    );

  if (!normalizedSeriesId) {
    return {
      ok: false,

      active: false,

      response: jsonError(
        "Invalid series.",
        400,
        "INVALID_SERIES"
      ),
    };
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          name,
          slug,
          is_paid,
          is_active
        FROM test_series
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        normalizedSeriesId,
      ],
    });

  const series =
    result.rows?.[0];

  if (!series) {
    return {
      ok: false,

      active: false,

      response: jsonError(
        "Test series not found.",
        404,
        "SERIES_NOT_FOUND"
      ),
    };
  }

  return {
    ok: true,

    active:
      Number(
        series.is_active
      ) === 1,

    series,
  };
}

/* =========================================================
   CATEGORY STATE
========================================================= */

/**
 * Categories have their own is_active field.
 */

export async function getCategoryState(
  categoryId
) {
  const normalizedCategoryId =
    normalizeId(
      categoryId
    );

  if (
    !normalizedCategoryId
  ) {
    return {
      ok: true,

      active: true,

      category: null,
    };
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          parent_id,
          name,
          slug,
          description,
          is_active
        FROM test_categories
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        normalizedCategoryId,
      ],
    });

  const category =
    result.rows?.[0];

  if (!category) {
    return {
      ok: false,

      active: false,

      response: jsonError(
        "Test category not found.",
        404,
        "CATEGORY_NOT_FOUND"
      ),
    };
  }

  return {
    ok: true,

    active:
      Number(
        category.is_active
      ) === 1,

    category,
  };
}

/* =========================================================
   TEST PUBLISHED
========================================================= */

export function isTestPublished(
  test
) {
  return (
    Number(
      firstDefined(
        test?.is_published,
        test?.isPublished,
        0
      )
    ) === 1
  );
}

/* =========================================================
   TEST AVAILABILITY
========================================================= */

/**
 * Phase 5 central availability rule.
 *
 * For NEW student access:
 *
 *   Series active
 *        +
 *   Category active
 *        +
 *   Test published
 *
 * IMPORTANT:
 *
 * There is currently NO is_active column on the individual
 * test tables. Therefore this helper does not invent one.
 *
 * `is_published` is the current test-level availability
 * switch.
 */

export async function requireTestAvailability({
  config,
  test,
}) {
  if (
    !config?.seriesId
  ) {
    return {
      ok: false,

      response: jsonError(
        "Invalid test series configuration.",
        500,
        "INVALID_SERIES_CONFIG"
      ),
    };
  }

  /* -------------------------------------------------------
     SERIES
  ------------------------------------------------------- */

  const seriesState =
    await getSeriesState(
      config.seriesId
    );

  if (!seriesState.ok) {
    return seriesState;
  }

  if (
    !seriesState.active
  ) {
    return {
      ok: false,

      response: jsonError(
        "This test series is currently inactive.",
        403,
        "SERIES_INACTIVE"
      ),
    };
  }

  /* -------------------------------------------------------
     CATEGORY
  ------------------------------------------------------- */

  const categoryId =
    firstDefined(
      test?.category_id,
      test?.categoryId
    );

  const categoryState =
    await getCategoryState(
      categoryId
    );

  if (!categoryState.ok) {
    return categoryState;
  }

  if (
    !categoryState.active
  ) {
    return {
      ok: false,

      response: jsonError(
        "This test category is currently inactive.",
        403,
        "CATEGORY_INACTIVE"
      ),
    };
  }

  /* -------------------------------------------------------
     TEST PUBLISHED
  ------------------------------------------------------- */

  if (
    !isTestPublished(
      test
    )
  ) {
    return {
      ok: false,

      response: jsonError(
        "This test is not currently available.",
        403,
        "TEST_NOT_PUBLISHED"
      ),
    };
  }

  return {
    ok: true,

    series:
      seriesState.series,

    category:
      categoryState.category,

    test,
  };
}

/* =========================================================
   COMMON TEST CONTEXT
========================================================= */

export async function requireTestContext({
  series,
  testId,
  requireAvailability = false,
}) {
  const normalizedSeries =
    normalizeSeries(
      series
    );

  /* -------------------------------------------------------
     AUTH
  ------------------------------------------------------- */

  const auth =
    await requireAuthenticatedUser();

  if (!auth.ok) {
    return auth;
  }

  const {
    user,
    currentUser,
    userId,
  } = auth;

  /* -------------------------------------------------------
     SERIES ACCESS
  ------------------------------------------------------- */

  const access =
    requireSeriesAccess(
      currentUser,
      normalizedSeries
    );

  if (!access.ok) {
    return access;
  }

  /* -------------------------------------------------------
     TEST
  ------------------------------------------------------- */

  const testResult =
    await getTestById(
      normalizedSeries,
      testId
    );

  if (!testResult.ok) {
    return testResult;
  }

  /* -------------------------------------------------------
     OPTIONAL AVAILABILITY CHECK
  ------------------------------------------------------- */

  if (
    requireAvailability
  ) {
    const availability =
      await requireTestAvailability({
        config:
          testResult.config,

        test:
          testResult.test,
      });

    if (!availability.ok) {
      return availability;
    }
  }

  return {
    ok: true,

    user,

    currentUser,

    userId,

    series:
      normalizedSeries,

    config:
      testResult.config,

    test:
      testResult.test,

    testId:
      testResult.testId,
  };
}

/* =========================================================
   PUBLISHED CHECK
========================================================= */

export function requirePublishedTest(
  test
) {
  if (
    !isTestPublished(
      test
    )
  ) {
    return {
      ok: false,

      response: jsonError(
        "This test is not currently available.",
        403,
        "TEST_NOT_PUBLISHED"
      ),
    };
  }

  return {
    ok: true,
  };
}

/* =========================================================
   CATEGORY
========================================================= */

export async function getTestCategory(
  test
) {
  const categoryId =
    normalizeId(
      firstDefined(
        test?.category_id,
        test?.categoryId
      )
    );

  if (!categoryId) {
    return null;
  }

  try {
    const result =
      await db.execute({
        sql: `
          SELECT
            id,
            name,
            slug,
            parent_id,
            is_active
          FROM test_categories
          WHERE id = ?
          LIMIT 1
        `,

        args: [
          categoryId,
        ],
      });

    return (
      result.rows?.[0] ||
      null
    );
  } catch (error) {
    console.warn(
      "[testSecurity] Category lookup failed:",
      error
    );

    return null;
  }
}

/* =========================================================
   CATEGORY HELPERS
========================================================= */

export function getCategorySlug(
  category
) {
  return String(
    firstDefined(
      category?.slug,
      ""
    )
  )
    .trim()
    .toLowerCase();
}

export function isDppCategory(
  category
) {
  return (
    getCategorySlug(
      category
    ) === "dpp"
  );
}

/* =========================================================
   ERROR RESPONSE HELPERS
========================================================= */

export function unauthorizedResponse() {
  return jsonError(
    "Please login to continue.",
    401,
    "UNAUTHORIZED"
  );
}

export function sessionRevokedResponse() {
  return jsonError(
    "Your session is no longer active.",
    401,
    "SESSION_REVOKED"
  );
}

export function deviceRevokedResponse() {
  return jsonError(
    "This device is no longer active.",
    401,
    "DEVICE_REVOKED"
  );
}

export function seriesAccessRequiredResponse() {
  return jsonError(
    "You do not have access to this test series.",
    403,
    "SERIES_ACCESS_REQUIRED"
  );
}

export function testNotPublishedResponse() {
  return jsonError(
    "This test is not currently available.",
    403,
    "TEST_NOT_PUBLISHED"
  );
}

export function seriesInactiveResponse() {
  return jsonError(
    "This test series is currently inactive.",
    403,
    "SERIES_INACTIVE"
  );
}

export function categoryInactiveResponse() {
  return jsonError(
    "This test category is currently inactive.",
    403,
    "CATEGORY_INACTIVE"
  );
}