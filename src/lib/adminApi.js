import {
  requireAdmin,
  requireAdminAction,
  adminInternalError,
} from "@/lib/adminSecurity";

/* =========================================================
   WITH ADMIN
========================================================= */

/**
 * Basic admin wrapper.
 *
 * Use when an endpoint only needs:
 *
 * authenticated admin
 *
 * Example:
 *
 * export const GET =
 *   withAdmin(
 *     async ({
 *       userId,
 *       user,
 *     }) => {
 *       ...
 *     }
 *   );
 */

export function withAdmin(
  handler,
  options = {}
) {
  const {
    logContext =
      "[admin API]",
  } = options;

  return async (
    request,
    context
  ) => {
    try {
      /* ---------------------------------------------------
         ADMIN AUTH
      --------------------------------------------------- */

      const admin =
        await requireAdmin();

      if (!admin.ok) {
        return admin.response;
      }

      /* ---------------------------------------------------
         HANDLER
      --------------------------------------------------- */

      return await handler({
        request,

        context,

        user:
          admin.user,

        currentUser:
          admin.currentUser,

        userId:
          admin.userId,

        role:
          admin.role,
      });
    } catch (error) {
      return adminInternalError(
        error,
        logContext
      );
    }
  };
}

/* =========================================================
   WITH ADMIN ACTION
========================================================= */

/**
 * Stronger wrapper for routes which perform a specific
 * privileged operation.
 *
 * Example:
 *
 * export const DELETE =
 *   withAdminAction(
 *     "test:delete",
 *     async ({
 *       userId,
 *       dangerous,
 *     }) => {
 *       ...
 *     }
 *   );
 *
 * The action is defined by the route, NOT by the request.
 */

export function withAdminAction(
  action,
  handler,
  options = {}
) {
  const {
    logContext =
      "[admin API]",
  } = options;

  return async (
    request,
    context
  ) => {
    try {
      /* ---------------------------------------------------
         ACTION + ADMIN AUTH
      --------------------------------------------------- */

      const admin =
        await requireAdminAction(
          action
        );

      if (!admin.ok) {
        return admin.response;
      }

      /* ---------------------------------------------------
         HANDLER
      --------------------------------------------------- */

      return await handler({
        request,

        context,

        user:
          admin.user,

        currentUser:
          admin.currentUser,

        userId:
          admin.userId,

        role:
          admin.role,

        action:
          admin.action,

        dangerous:
          admin.dangerous,
      });
    } catch (error) {
      return adminInternalError(
        error,
        logContext
      );
    }
  };
}