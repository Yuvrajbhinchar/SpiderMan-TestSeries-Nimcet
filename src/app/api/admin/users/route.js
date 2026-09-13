import { NextResponse } from "next/server";

import {
  db,
} from "@/lib/turso";

import {
  getCurrentUser,
} from "@/lib/auth";

/* =========================================================
   RESPONSE HELPERS
========================================================= */

function jsonError(
  message,
  status = 400,
  code = null
) {
  return NextResponse.json(
    {
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
    }
  );
}

function jsonSuccess(
  payload,
  status = 200
) {
  return NextResponse.json(
    {
      success:
        true,

      ...payload,
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
   HELPERS
========================================================= */

function normalize(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function normalizeId(
  value
) {
  const id =
    Number(value);

  if (
    !Number.isInteger(
      id
    ) ||
    id <= 0
  ) {
    return null;
  }

  return id;
}

function getLimit(
  value
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    )
  ) {
    return 25;
  }

  return Math.min(
    Math.max(
      number,
      1
    ),
    100
  );
}

/* =========================================================
   ADMIN AUTH
========================================================= */

async function requireAdmin() {
  const currentUser =
    await getCurrentUser();

  if (
    !currentUser?.id
  ) {
    return {
      ok: false,

      response:
        jsonError(
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

      response:
        jsonError(
          "Invalid user session.",
          401,
          "INVALID_SESSION"
        ),
    };
  }

  const result =
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

        WHERE
          id = ?

        LIMIT 1
      `,

      args: [
        userId,
      ],
    });

  const user =
    result.rows?.[0];

  if (!user) {
    return {
      ok: false,

      response:
        jsonError(
          "User account not found.",
          401,
          "USER_NOT_FOUND"
        ),
    };
  }

  if (
    Number(
      user.is_active
    ) !== 1
  ) {
    return {
      ok: false,

      response:
        jsonError(
          "Your account is inactive.",
          403,
          "ACCOUNT_INACTIVE"
        ),
    };
  }

  if (
    String(
      user.role
    ) !==
    "admin"
  ) {
    return {
      ok: false,

      response:
        jsonError(
          "Admin access required.",
          403,
          "ADMIN_REQUIRED"
        ),
    };
  }

  /*
   * JWT session/device must match DB state.
   */

  const jwtSessionId =
    currentUser.sessionId ??
    currentUser.session_id ??
    null;

  const jwtDeviceId =
    currentUser.deviceId ??
    currentUser.device_id ??
    null;

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

      response:
        jsonError(
          "Your session is no longer active.",
          401,
          "SESSION_REVOKED"
        ),
    };
  }

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

      response:
        jsonError(
          "This device is no longer active.",
          401,
          "DEVICE_REVOKED"
        ),
    };
  }

  return {
    ok: true,

    userId,

    user,
  };
}

/* =========================================================
   GET USERS
   /api/admin/users
========================================================= */

export async function GET(
  request
) {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      searchParams,
    } =
      new URL(
        request.url
      );

    const search =
      String(
        searchParams.get(
          "search"
        ) || ""
      ).trim();

    const status =
      normalize(
        searchParams.get(
          "status"
        ) || "all"
      );

    const role =
      normalize(
        searchParams.get(
          "role"
        ) || "all"
      );

    const cursor =
      normalizeId(
        searchParams.get(
          "cursor"
        )
      );

    const limit =
      getLimit(
        searchParams.get(
          "limit"
        )
      );

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    if (
      ![
        "all",
        "active",
        "inactive",
      ].includes(
        status
      )
    ) {
      return jsonError(
        "Invalid status filter.",
        400,
        "INVALID_STATUS"
      );
    }

    if (
      ![
        "all",
        "user",
        "admin",
      ].includes(
        role
      )
    ) {
      return jsonError(
        "Invalid role filter.",
        400,
        "INVALID_ROLE"
      );
    }

    /* -------------------------------------------------------
       WHERE
    ------------------------------------------------------- */

    const where = [
      "1 = 1",
    ];

    const args = [];

    if (
      status ===
      "active"
    ) {
      where.push(
        "u.is_active = 1"
      );
    }

    if (
      status ===
      "inactive"
    ) {
      where.push(
        "u.is_active = 0"
      );
    }

    if (
      role ===
      "user" ||
      role ===
      "admin"
    ) {
      where.push(
        "u.role = ?"
      );

      args.push(
        role
      );
    }

    if (
      search
    ) {
      where.push(`
        (
          u.username LIKE ?
          OR u.email LIKE ?
          OR COALESCE(
            u.display_name,
            ''
          ) LIKE ?
        )
      `);

      const pattern =
        `%${search}%`;

      args.push(
        pattern,
        pattern,
        pattern
      );
    }

    if (
      cursor
    ) {
      where.push(
        "u.id < ?"
      );

      args.push(
        cursor
      );
    }

    /* -------------------------------------------------------
       QUERY
    ------------------------------------------------------- */

    const result =
      await db.execute({
        sql: `
          SELECT
            u.id,
            u.username,
            u.email,
            u.display_name,
            u.role,
            u.is_active,
            u.active_session_id,
            u.active_device_id,
            u.created_at,
            u.updated_at

          FROM users u

          WHERE
            ${where.join(
              "\nAND "
            )}

          ORDER BY
            u.id DESC

          LIMIT ${limit}
        `,

        args,
      });

    const rows =
      Array.isArray(
        result.rows
      )
        ? result.rows
        : [];

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    const users =
      rows.map(
        (
          row
        ) => ({
          id:
            Number(
              row.id
            ),

          username:
            row.username,

          email:
            row.email,

          displayName:
            row.display_name ||
            "",

          role:
            row.role,

          isActive:
            Number(
              row.is_active
            ) === 1,

          hasActiveSession:
            Boolean(
              row.active_session_id
            ),

          hasActiveDevice:
            Boolean(
              row.active_device_id
            ),

          createdAt:
            row.created_at ||
            null,

          updatedAt:
            row.updated_at ||
            null,
        })
      );

    const nextCursor =
      rows.length ===
      limit
        ? Number(
            rows[
              rows.length -
                1
            ].id
          )
        : null;

    return jsonSuccess({
      users,

      pagination: {
        nextCursor,

        hasMore:
          nextCursor !==
          null,
      },

      count:
        users.length,
    });
  } catch (
    error
  ) {
    console.error(
      "[GET /api/admin/users] ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Unable to load users.",
      500,
      "ADMIN_USERS_LOAD_FAILED"
    );
  }
}

/* =========================================================
   PATCH USER
   /api/admin/users

   Body:
   {
     userId: 123,
     action: "activate"
   }

   Actions:
   activate
   deactivate
   revoke_session
========================================================= */

export async function PATCH(
  request
) {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const body =
      await request
        .json()
        .catch(
          () => null
        );

    if (!body) {
      return jsonError(
        "Invalid JSON request."
      );
    }

    const targetUserId =
      normalizeId(
        body?.userId
      );

    const action =
      normalize(
        body?.action
      );

    if (
      !targetUserId
    ) {
      return jsonError(
        "Valid user ID is required.",
        400,
        "INVALID_USER_ID"
      );
    }

    if (
      ![
        "activate",
        "deactivate",
        "revoke_session",
      ].includes(
        action
      )
    ) {
      return jsonError(
        "Invalid user action.",
        400,
        "INVALID_ACTION"
      );
    }

    /* -------------------------------------------------------
       LOAD TARGET
    ------------------------------------------------------- */

    const targetResult =
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

          WHERE
            id = ?

          LIMIT 1
        `,

        args: [
          targetUserId,
        ],
      });

    const target =
      targetResult
        .rows?.[0];

    if (!target) {
      return jsonError(
        "User not found.",
        404,
        "USER_NOT_FOUND"
      );
    }

    /* -------------------------------------------------------
       SELF PROTECTION
    ------------------------------------------------------- */

    if (
      targetUserId ===
      auth.userId
    ) {
      return jsonError(
        "You cannot change your own admin account from here.",
        409,
        "SELF_ACTION_BLOCKED"
      );
    }

    /* -------------------------------------------------------
       ACTIVATE
    ------------------------------------------------------- */

    if (
      action ===
      "activate"
    ) {
      const result =
        await db.execute({
          sql: `
            UPDATE users

            SET
              is_active = 1,
              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
          `,

          args: [
            targetUserId,
          ],
        });

      if (
        Number(
          result.rowsAffected ||
            0
        ) !== 1
      ) {
        return jsonError(
          "User could not be activated.",
          409,
          "USER_UPDATE_FAILED"
        );
      }

      return jsonSuccess({
        message:
          "User activated successfully.",

        user: {
          id:
            targetUserId,

          isActive:
            true,

          role:
            target.role,
        },
      });
    }

    /* -------------------------------------------------------
       DEACTIVATE
    ------------------------------------------------------- */

    if (
      action ===
      "deactivate"
    ) {
      /*
       * IMPORTANT:
       *
       * Deactivation ALSO clears the active session/device.
       *
       * This means the current JWT becomes unusable on the
       * next protected request.
       */

      const result =
        await db.execute({
          sql: `
            UPDATE users

            SET
              is_active = 0,

              active_session_id =
                NULL,

              active_device_id =
                NULL,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
          `,

          args: [
            targetUserId,
          ],
        });

      if (
        Number(
          result.rowsAffected ||
            0
        ) !== 1
      ) {
        return jsonError(
          "User could not be deactivated.",
          409,
          "USER_UPDATE_FAILED"
        );
      }

      return jsonSuccess({
        message:
          "User deactivated and active session revoked.",

        user: {
          id:
            targetUserId,

          isActive:
            false,

          hasActiveSession:
            false,

          hasActiveDevice:
            false,

          role:
            target.role,
        },
      });
    }

    /* -------------------------------------------------------
       REVOKE SESSION
    ------------------------------------------------------- */

    if (
      action ===
      "revoke_session"
    ) {
      const result =
        await db.execute({
          sql: `
            UPDATE users

            SET
              active_session_id =
                NULL,

              active_device_id =
                NULL,

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
          `,

          args: [
            targetUserId,
          ],
        });

      if (
        Number(
          result.rowsAffected ||
            0
        ) !== 1
      ) {
        return jsonError(
          "Session could not be revoked.",
          409,
          "SESSION_REVOKE_FAILED"
        );
      }

      return jsonSuccess({
        message:
          "User session revoked successfully.",

        user: {
          id:
            targetUserId,

          hasActiveSession:
            false,

          hasActiveDevice:
            false,
        },
      });
    }

    return jsonError(
      "Unsupported action.",
      400,
      "UNSUPPORTED_ACTION"
    );
  } catch (
    error
  ) {
    console.error(
      "[PATCH /api/admin/users] ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Unable to update user.",
      500,
      "ADMIN_USER_UPDATE_FAILED"
    );
  }
}