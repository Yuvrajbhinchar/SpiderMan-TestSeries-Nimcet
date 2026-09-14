import { NextResponse } from "next/server";

import {
  requireAuthenticatedUser,
} from "@/lib/testSecurity";

/* =========================================================
   ADMIN ACTIONS
========================================================= */

/*
 * Central list of all privileged operations.
 *
 * IMPORTANT:
 *
 * These names are server-side constants.
 * Do not accept arbitrary action names from:
 *
 * - request body
 * - query parameters
 * - client state
 *
 * Routes should explicitly choose an action.
 */

export const ADMIN_ACTIONS =
  Object.freeze({
    /* -------------------------------------------------------
       DASHBOARD / READ
    ------------------------------------------------------- */

    DASHBOARD_READ:
      "dashboard:read",

    TEST_READ:
      "test:read",

    QUESTION_READ:
      "question:read",

    USER_READ:
      "user:read",

    ACCESS_READ:
      "access:read",

    SERIES_READ:
      "series:read",

    EVENT_READ:
      "event:read",

    /* -------------------------------------------------------
       TEST WRITE
    ------------------------------------------------------- */

    TEST_CREATE:
      "test:create",

    TEST_UPDATE:
      "test:update",

    TEST_DELETE:
      "test:delete",

    TEST_ACTIVATE:
      "test:activate",

    TEST_DEACTIVATE:
      "test:deactivate",

    TEST_PUBLISH:
      "test:publish",

    TEST_UNPUBLISH:
      "test:unpublish",

    /* -------------------------------------------------------
       QUESTION WRITE
    ------------------------------------------------------- */

    QUESTION_CREATE:
      "question:create",

    QUESTION_UPDATE:
      "question:update",

    QUESTION_DELETE:
      "question:delete",

    /* -------------------------------------------------------
       USER MANAGEMENT
    ------------------------------------------------------- */

    USER_ACTIVATE:
      "user:activate",

    USER_DEACTIVATE:
      "user:deactivate",

    /* -------------------------------------------------------
       SERIES MANAGEMENT
    ------------------------------------------------------- */

    SERIES_ACTIVATE:
      "series:activate",

    SERIES_DEACTIVATE:
      "series:deactivate",


      /* -------------------------------------------------------
   CATEGORY MANAGEMENT
------------------------------------------------------- */

CATEGORY_CREATE:
  "category:create",

CATEGORY_UPDATE:
  "category:update",

CATEGORY_ACTIVATE:
  "category:activate",

CATEGORY_DEACTIVATE:
  "category:deactivate",

    /* -------------------------------------------------------
       ACCESS MANAGEMENT
    ------------------------------------------------------- */

    ACCESS_GRANT:
      "access:grant",

    ACCESS_REVOKE:
      "access:revoke",

    ACCESS_UPDATE:
      "access:update",

    /* -------------------------------------------------------
       EVENT / LIVE
    ------------------------------------------------------- */

    EVENT_CREATE:
      "event:create",

    EVENT_UPDATE:
      "event:update",

    EVENT_DELETE:
      "event:delete",

    EVENT_PUBLISH:
      "event:publish",

    EVENT_UNPUBLISH:
      "event:unpublish",
  });

/* =========================================================
   ACTION SET
========================================================= */

const ADMIN_ACTION_SET =
  new Set(
    Object.values(
      ADMIN_ACTIONS
    )
  );

/* =========================================================
   DANGEROUS ACTIONS
========================================================= */

/*
 * These actions modify or remove privileged data/state.
 *
 * We keep them explicitly identifiable so that later we can
 * add stronger safeguards without changing every route.
 */

const DANGEROUS_ACTIONS =
  new Set([
    ADMIN_ACTIONS.TEST_DELETE,

    ADMIN_ACTIONS.QUESTION_DELETE,

    ADMIN_ACTIONS.EVENT_DELETE,

    ADMIN_ACTIONS.USER_DEACTIVATE,

    ADMIN_ACTIONS.TEST_DEACTIVATE,

    ADMIN_ACTIONS.SERIES_DEACTIVATE,

    ADMIN_ACTIONS.ACCESS_REVOKE,
  ]);

/* =========================================================
   ADMIN AUTHORIZATION
========================================================= */

/**
 * Authenticate request + verify server-side admin role.
 *
 * requireAuthenticatedUser() already validates:
 *
 * - JWT
 * - user existence
 * - account active
 * - active session
 * - active device
 */

export async function requireAdmin() {
  const auth =
    await requireAuthenticatedUser();

  if (!auth.ok) {
    return auth;
  }

  const role =
    String(
      auth.user?.role ||
        ""
    )
      .trim()
      .toLowerCase();

  if (
    role !== "admin"
  ) {
    return {
      ok: false,

      response:
        adminError(
          "Admin access required.",
          403,
          "ADMIN_REQUIRED"
        ),
    };
  }

  return {
    ok: true,

    user:
      auth.user,

    currentUser:
      auth.currentUser,

    userId:
      auth.userId,

    role: "admin",
  };
}

/* =========================================================
   REQUIRE ADMIN ACTION
========================================================= */

/**
 * Require:
 *
 * 1. valid authenticated session
 * 2. admin role
 * 3. valid server-defined action
 *
 * The action itself is supplied by the route code, NOT by
 * the browser.
 */

export async function requireAdminAction(
  action
) {
  const normalizedAction =
    String(
      action || ""
    ).trim();

  /* -------------------------------------------------------
     UNKNOWN ACTION
     
     This is a developer/configuration error, not something
     the client should be able to control.
  ------------------------------------------------------- */

  if (
    !ADMIN_ACTION_SET.has(
      normalizedAction
    )
  ) {
    return {
      ok: false,

      response:
        adminError(
          "Invalid admin action.",
          500,
          "INVALID_ADMIN_ACTION"
        ),
    };
  }

  /* -------------------------------------------------------
     ADMIN AUTH
  ------------------------------------------------------- */

  const admin =
    await requireAdmin();

  if (!admin.ok) {
    return admin;
  }

  /* -------------------------------------------------------
     ACTION METADATA
  ------------------------------------------------------- */

  return {
    ...admin,

    action:
      normalizedAction,

    dangerous:
      DANGEROUS_ACTIONS.has(
        normalizedAction
      ),
  };
}

/* =========================================================
   ACTION CHECK
========================================================= */

/**
 * Useful when a route has already authenticated the admin
 * but still wants to validate an action before continuing.
 */

export function isValidAdminAction(
  action
) {
  return ADMIN_ACTION_SET.has(
    String(
      action || ""
    ).trim()
  );
}

export function isDangerousAdminAction(
  action
) {
  return DANGEROUS_ACTIONS.has(
    String(
      action || ""
    ).trim()
  );
}

/* =========================================================
   ADMIN ERROR
========================================================= */

export function adminError(
  message,
  status = 400,
  code = null
) {
  return NextResponse.json(
    {
      success: false,

      error:
        message,

      ...(code
        ? {
            code,
          }
        : {}),
    },
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",
      },
    }
  );
}

/* =========================================================
   ADMIN SUCCESS
========================================================= */

export function adminSuccess(
  data = {},
  status = 200
) {
  return NextResponse.json(
    {
      success: true,

      ...data,
    },
    {
      status,

      headers: {
        "Cache-Control":
          "private, no-store, max-age=0",

        Pragma:
          "no-cache",

        Expires:
          "0",
      },
    }
  );
}

/* =========================================================
   ADMIN INTERNAL ERROR
========================================================= */

export function adminInternalError(
  error,
  logContext =
    "[admin API] Internal error:"
) {
  console.error(
    logContext,
    error
  );

  /*
   * Never expose raw:
   *
   * - SQL errors
   * - stack traces
   * - filesystem paths
   * - implementation details
   */

  return adminError(
    "Something went wrong. Please try again.",
    500,
    "INTERNAL_SERVER_ERROR"
  );
}

/* =========================================================
   COMMON ADMIN ERRORS
========================================================= */

export function adminRequiredResponse() {
  return adminError(
    "Admin access required.",
    403,
    "ADMIN_REQUIRED"
  );
}

export function adminBadRequestResponse(
  message =
    "Invalid request."
) {
  return adminError(
    message,
    400,
    "BAD_REQUEST"
  );
}

export function adminNotFoundResponse(
  message =
    "Resource not found."
) {
  return adminError(
    message,
    404,
    "NOT_FOUND"
  );
}

export function adminConflictResponse(
  message =
    "The requested operation conflicts with the current state."
) {
  return adminError(
    message,
    409,
    "CONFLICT"
  );
}

export function adminDangerousActionResponse() {
  return adminError(
    "This administrative action is restricted.",
    403,
    "ADMIN_ACTION_RESTRICTED"
  );
}