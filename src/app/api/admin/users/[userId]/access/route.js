import { NextResponse } from "next/server";

import {
  db,
} from "@/lib/turso";

import {
  getCurrentUser,
} from "@/lib/auth";

/* =========================================================
   CONSTANTS
========================================================= */

const PAID_SERIES = new Map([
  [
    2,
    {
      id: 2,
      slug: "asspire",
      name: "Asspire",
    },
  ],

  [
    3,
    {
      id: 3,
      slug: "imppetus",
      name: "Imppetus",
    },
  ],

  [
    4,
    {
      id: 4,
      slug: "spiderman",
      name: "SpiderMan",
    },
  ],
]);

/* =========================================================
   RESPONSE
========================================================= */

function jsonError(
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

function jsonSuccess(
  payload,
  status = 200
) {
  return NextResponse.json(
    {
      success: true,

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

function normalizeText(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function parseExpiry(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const text =
    String(
      value
    ).trim();

  const date =
    new Date(
      text
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return {
      valid: false,
    };
  }

  if (
    date.getTime() <=
    Date.now()
  ) {
    return {
      valid: false,
    };
  }

  return {
    valid: true,

    value:
      date.toISOString(),
  };
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

  const adminId =
    Number(
      currentUser.id
    );

  if (
    !Number.isInteger(
      adminId
    ) ||
    adminId <= 0
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
          role,
          is_active,
          active_session_id,
          active_device_id
        FROM users
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        adminId,
      ],
    });

  const admin =
    result.rows?.[0];

  if (!admin) {
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
      admin.is_active
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
      admin.role
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
    !admin.active_session_id ||
    String(
      jwtSessionId
    ) !==
      String(
        admin.active_session_id
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
    !admin.active_device_id ||
    String(
      jwtDeviceId
    ) !==
      String(
        admin.active_device_id
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

    adminId,
  };
}

/* =========================================================
   TARGET USER
========================================================= */

async function getTargetUser(
  userId
) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          username,
          email,
          display_name,
          role,
          is_active
        FROM users
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        userId,
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

/* =========================================================
   ACCESS
========================================================= */

function mapAccess(
  row
) {
  if (!row) {
    return null;
  }

  return {
    id:
      Number(
        row.id
      ),

    userId:
      Number(
        row.user_id
      ),

    seriesId:
      Number(
        row.series_id
      ),

    seriesSlug:
      row.series_slug,

    seriesName:
      row.series_name,

    isPaid:
      Number(
        row.is_paid
      ) === 1,

    isActive:
      Number(
        row.is_active
      ) === 1,

    grantedBy:
      row.granted_by ===
          null ||
        row.granted_by ===
          undefined
        ? null
        : Number(
            row.granted_by
          ),

    grantedAt:
      row.granted_at ||
      null,

    expiresAt:
      row.expires_at ||
      null,
  };
}

/* =========================================================
   GET
   /api/admin/users/[userId]/access
========================================================= */

export async function GET(
  request,
  {
    params,
  }
) {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId:
        rawUserId,
    } =
      await params;

    const userId =
      normalizeId(
        rawUserId
      );

    if (!userId) {
      return jsonError(
        "Invalid user ID.",
        400,
        "INVALID_USER_ID"
      );
    }

    const user =
      await getTargetUser(
        userId
      );

    if (!user) {
      return jsonError(
        "User not found.",
        404,
        "USER_NOT_FOUND"
      );
    }

    const result =
      await db.execute({
        sql: `
          SELECT
            usa.id,
            usa.user_id,
            usa.series_id,
            usa.granted_by,
            usa.granted_at,
            usa.expires_at,
            usa.is_active,

            ts.slug AS series_slug,
            ts.name AS series_name,
            ts.is_paid

          FROM user_series_access usa

          INNER JOIN test_series ts
            ON ts.id =
              usa.series_id

          WHERE
            usa.user_id = ?

          ORDER BY
            ts.id ASC
        `,

        args: [
          userId,
        ],
      });

    const accessRows =
      Array.isArray(
        result.rows
      )
        ? result.rows
        : [];

    const accessBySeries =
      new Map();

    accessRows.forEach(
      (
        row
      ) => {
        accessBySeries.set(
          Number(
            row.series_id
          ),
          mapAccess(
            row
          )
        );
      }
    );

    /*
     * Return all paid series, including ones for which no row
     * currently exists.
     */

    const series =
      Array.from(
        PAID_SERIES.values()
      ).map(
        (
          paidSeries
        ) => {
          const existing =
            accessBySeries.get(
              paidSeries.id
            );

          let effectiveActive =
            Boolean(
              existing?.isActive
            );

          if (
            effectiveActive &&
            existing?.expiresAt
          ) {
            const expiry =
              new Date(
                existing.expiresAt
              );

            if (
              !Number.isNaN(
                expiry.getTime()
              ) &&
              expiry.getTime() <=
                Date.now()
            ) {
              effectiveActive =
                false;
            }
          }

          return {
            id:
              paidSeries.id,

            slug:
              paidSeries.slug,

            name:
              paidSeries.name,

            isPaid:
              true,

            accessId:
              existing?.id ??
              null,

            isActive:
              effectiveActive,

            grantedBy:
              existing?.grantedBy ??
              null,

            grantedAt:
              existing?.grantedAt ??
              null,

            expiresAt:
              existing?.expiresAt ??
              null,
          };
        }
      );

    return jsonSuccess({
      user: {
        id:
          Number(
            user.id
          ),

        username:
          user.username,

        email:
          user.email,

        displayName:
          user.display_name ||
          "",

        role:
          user.role,

        isActive:
          Number(
            user.is_active
          ) === 1,
      },

      series,

      note:
        "Access changes revoke the user's current session/device so the next login receives a fresh JWT access snapshot.",
    });
  } catch (
    error
  ) {
    console.error(
      "[GET admin user access] ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Unable to load user access.",
      500,
      "ACCESS_LOAD_FAILED"
    );
  }
}

/* =========================================================
   POST
   GRANT / UPDATE ACCESS

   Body:
   {
     seriesId: 4,
     expiresAt: "2027-09-12T23:59:59.000Z"
   }

   null expiresAt = lifetime access
========================================================= */

export async function POST(
  request,
  {
    params,
  }
) {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId:
        rawUserId,
    } =
      await params;

    const userId =
      normalizeId(
        rawUserId
      );

    if (!userId) {
      return jsonError(
        "Invalid user ID.",
        400,
        "INVALID_USER_ID"
      );
    }

    /*
     * Never let an admin accidentally revoke his own current
     * session by changing his own access.
     */

    if (
      userId ===
      auth.adminId
    ) {
      return jsonError(
        "You cannot change your own series access from here.",
        409,
        "SELF_ACCESS_CHANGE_BLOCKED"
      );
    }

    const user =
      await getTargetUser(
        userId
      );

    if (!user) {
      return jsonError(
        "User not found.",
        404,
        "USER_NOT_FOUND"
      );
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

    const seriesId =
      normalizeId(
        body.seriesId
      );

    if (!seriesId) {
      return jsonError(
        "Valid series ID is required.",
        400,
        "INVALID_SERIES_ID"
      );
    }

    if (
      !PAID_SERIES.has(
        seriesId
      )
    ) {
      return jsonError(
        "Only paid series can be manually granted.",
        400,
        "INVALID_PAID_SERIES"
      );
    }

    const expiry =
      parseExpiry(
        body.expiresAt
      );

    if (
      expiry?.valid ===
      false
    ) {
      return jsonError(
        "Expiry must be a valid future date.",
        400,
        "INVALID_EXPIRY"
      );
    }

    const expiresAt =
      expiry?.value ??
      null;

    /*
     * UPSERT:
     *
     * Existing inactive/expired access becomes active again.
     */

    const result =
      await db.execute({
        sql: `
          INSERT INTO user_series_access (
            user_id,
            series_id,
            granted_by,
            granted_at,
            expires_at,
            is_active
          )

          VALUES (
            ?,
            ?,
            ?,
            CURRENT_TIMESTAMP,
            ?,
            1
          )

          ON CONFLICT (
            user_id,
            series_id
          )

          DO UPDATE SET
            granted_by =
              excluded.granted_by,

            granted_at =
              CURRENT_TIMESTAMP,

            expires_at =
              excluded.expires_at,

            is_active =
              1
        `,

        args: [
          userId,
          seriesId,
          auth.adminId,
          expiresAt,
        ],
      });

    /*
     * IMPORTANT:
     *
     * The entitlement is inside the JWT snapshot.
     * Therefore simply changing user_series_access is NOT enough.
     *
     * Clear both values so the existing JWT fails validation.
     * The user has to login again and receives a fresh JWT.
     */

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
        userId,
      ],
    });

    const series =
      PAID_SERIES.get(
        seriesId
      );

    return jsonSuccess({
      message:
        `${series.name} access granted successfully. The user's current session/device was revoked; they must log in again.`,

      changed:
        true,

      user: {
        id:
          userId,

        username:
          user.username,

        isActive:
          Number(
            user.is_active
          ) === 1,
      },

      access: {
        seriesId,

        seriesSlug:
          series.slug,

        seriesName:
          series.name,

        isActive:
          true,

        expiresAt,
      },

      sessionRevoked:
        true,
    });
  } catch (
    error
  ) {
    console.error(
      "[POST admin user access] ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Unable to grant series access.",
      500,
      "ACCESS_GRANT_FAILED"
    );
  }
}

/* =========================================================
   DELETE
   REVOKE ACCESS

   Body:
   {
     seriesId: 4
   }
========================================================= */

export async function DELETE(
  request,
  {
    params,
  }
) {
  try {
    const auth =
      await requireAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId:
        rawUserId,
    } =
      await params;

    const userId =
      normalizeId(
        rawUserId
      );

    if (!userId) {
      return jsonError(
        "Invalid user ID.",
        400,
        "INVALID_USER_ID"
      );
    }

    if (
      userId ===
      auth.adminId
    ) {
      return jsonError(
        "You cannot revoke your own series access from here.",
        409,
        "SELF_ACCESS_CHANGE_BLOCKED"
      );
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

    const seriesId =
      normalizeId(
        body.seriesId
      );

    if (!seriesId) {
      return jsonError(
        "Valid series ID is required.",
        400,
        "INVALID_SERIES_ID"
      );
    }

    if (
      !PAID_SERIES.has(
        seriesId
      )
    ) {
      return jsonError(
        "Only paid-series access can be manually revoked.",
        400,
        "INVALID_PAID_SERIES"
      );
    }

    const user =
      await getTargetUser(
        userId
      );

    if (!user) {
      return jsonError(
        "User not found.",
        404,
        "USER_NOT_FOUND"
      );
    }

    /*
     * Preserve the row for audit/history.
     * Do NOT delete it.
     */

    const result =
      await db.execute({
        sql: `
          UPDATE user_series_access

          SET
            is_active =
              0

          WHERE
            user_id = ?
            AND series_id = ?
        `,

        args: [
          userId,
          seriesId,
        ],
      });

    /*
     * Even when the row was already inactive, clear the current
     * JWT/session state. This makes revoke idempotent and ensures
     * no stale JWT survives a manual revoke.
     */

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
        userId,
      ],
    });

    const series =
      PAID_SERIES.get(
        seriesId
      );

    return jsonSuccess({
      message:
        `${series.name} access revoked successfully. The user's current session/device was revoked.`,

      changed:
        Number(
          result.rowsAffected ||
            0
        ) >
        0,

      user: {
        id:
          userId,

        username:
          user.username,

        isActive:
          Number(
            user.is_active
          ) === 1,
      },

      access: {
        seriesId,

        seriesSlug:
          series.slug,

        seriesName:
          series.name,

        isActive:
          false,
      },

      sessionRevoked:
        true,
    });
  } catch (
    error
  ) {
    console.error(
      "[DELETE admin user access] ERROR:",
      error
    );

    return jsonError(
      error?.message ||
        "Unable to revoke series access.",
      500,
      "ACCESS_REVOKE_FAILED"
    );
  }
}