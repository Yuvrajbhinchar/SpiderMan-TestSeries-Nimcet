import { db } from "@/lib/turso";

import { withAdmin } from "@/lib/adminApi";

import {
  adminBadRequestResponse,
  adminError,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  PAID_SERIES,
  getPaidSeries,
  isValidPaidSeriesId,
  parseExpiry,
} from "@/lib/seriesAccess";

/* =========================================================
   HELPERS
========================================================= */

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function getTargetUser(userId) {
  const result = await db.execute({
    sql: `
      SELECT id, username, email, display_name, role, is_active
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    args: [userId],
  });

  return result.rows?.[0] || null;
}

function mapAccess(row) {
  if (!row) return null;

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    seriesId: Number(row.series_id),
    seriesSlug: row.series_slug,
    seriesName: row.series_name,
    isPaid: Number(row.is_paid) === 1,
    isActive: Number(row.is_active) === 1,
    grantedBy:
      row.granted_by === null || row.granted_by === undefined
        ? null
        : Number(row.granted_by),
    grantedAt: row.granted_at || null,
    expiresAt: row.expires_at || null,
  };
}

/* =========================================================
   GET
   /api/admin/users/[userId]/access
========================================================= */

export const GET = withAdmin(async ({ context }) => {
  const { userId: rawUserId } = await context.params;
  const userId = normalizeId(rawUserId);

  if (!userId) return adminError("Invalid user ID.", 400, "INVALID_USER_ID");

  try {
    const user = await getTargetUser(userId);
    if (!user) return adminError("User not found.", 404, "USER_NOT_FOUND");

    const result = await db.execute({
      sql: `
        SELECT
          usa.id, usa.user_id, usa.series_id, usa.granted_by,
          usa.granted_at, usa.expires_at, usa.is_active,
          ts.slug AS series_slug, ts.name AS series_name, ts.is_paid
        FROM user_series_access usa
        INNER JOIN test_series ts ON ts.id = usa.series_id
        WHERE usa.user_id = ?
        ORDER BY ts.id ASC
      `,
      args: [userId],
    });

    const accessRows = Array.isArray(result.rows) ? result.rows : [];
    const accessBySeries = new Map();

    accessRows.forEach((row) => {
      accessBySeries.set(Number(row.series_id), mapAccess(row));
    });

    const series = Array.from(PAID_SERIES.values()).map((paidSeries) => {
      const existing = accessBySeries.get(paidSeries.id);
      let effectiveActive = Boolean(existing?.isActive);

      if (effectiveActive && existing?.expiresAt) {
        const expiry = new Date(existing.expiresAt);
        if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) {
          effectiveActive = false;
        }
      }

      return {
        id: paidSeries.id,
        slug: paidSeries.slug,
        name: paidSeries.name,
        isPaid: true,
        accessId: existing?.id ?? null,
        isActive: effectiveActive,
        grantedBy: existing?.grantedBy ?? null,
        grantedAt: existing?.grantedAt ?? null,
        expiresAt: existing?.expiresAt ?? null,
      };
    });

    return adminSuccess({
      user: {
        id: Number(user.id),
        username: user.username,
        email: user.email,
        displayName: user.display_name || "",
        role: user.role,
        isActive: Number(user.is_active) === 1,
      },
      series,
      note:
        "Access changes revoke the user's current session/device so the next login receives a fresh JWT access snapshot.",
    });
  } catch (error) {
    return adminInternalError(error, "[GET admin user access]");
  }
});

/* =========================================================
   POST — grant / update access
   Body: { seriesId: 4, expiresAt: null | isoString }
========================================================= */

export const POST = withAdmin(async ({ request, context, userId: adminId }) => {
  const { userId: rawUserId } = await context.params;
  const userId = normalizeId(rawUserId);

  if (!userId) return adminError("Invalid user ID.", 400, "INVALID_USER_ID");

  if (userId === adminId) {
    return adminError(
      "You cannot change your own series access from here.",
      409,
      "SELF_ACCESS_CHANGE_BLOCKED"
    );
  }

  try {
    const user = await getTargetUser(userId);
    if (!user) return adminError("User not found.", 404, "USER_NOT_FOUND");

    const body = await request.json().catch(() => null);
    if (!body) return adminBadRequestResponse("Invalid JSON request.");

    const seriesId = normalizeId(body.seriesId);

    if (!seriesId || !isValidPaidSeriesId(seriesId)) {
      return adminError(
        "Only paid series can be manually granted.",
        400,
        "INVALID_PAID_SERIES"
      );
    }

    const expiry = parseExpiry(body.expiresAt);

    if (!expiry.valid) {
      return adminError(
        "Expiry must be a valid future date.",
        400,
        "INVALID_EXPIRY"
      );
    }

    const expiresAt = expiry.value;

    await db.batch(
      [
        {
          sql: `
            INSERT INTO user_series_access
              (user_id, series_id, granted_by, granted_at, expires_at, is_active)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 1)
            ON CONFLICT (user_id, series_id) DO UPDATE SET
              granted_by = excluded.granted_by,
              granted_at = CURRENT_TIMESTAMP,
              expires_at = excluded.expires_at,
              is_active = 1
          `,
          args: [userId, seriesId, adminId, expiresAt],
        },
        {
          sql: `
            UPDATE users
            SET active_session_id = NULL, active_device_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [userId],
        },
      ],
      "write"
    );

    const series = getPaidSeries(seriesId);

    return adminSuccess({
      message: `${series.name} access granted successfully. The user's current session/device was revoked; they must log in again.`,
      changed: true,
      user: {
        id: userId,
        username: user.username,
        isActive: Number(user.is_active) === 1,
      },
      access: {
        seriesId,
        seriesSlug: series.slug,
        seriesName: series.name,
        isActive: true,
        expiresAt,
      },
      sessionRevoked: true,
    });
  } catch (error) {
    return adminInternalError(error, "[POST admin user access]");
  }
});

/* =========================================================
   DELETE — revoke access
   Body: { seriesId: 4 }
========================================================= */

export const DELETE = withAdmin(async ({ request, context, userId: adminId }) => {
  const { userId: rawUserId } = await context.params;
  const userId = normalizeId(rawUserId);

  if (!userId) return adminError("Invalid user ID.", 400, "INVALID_USER_ID");

  if (userId === adminId) {
    return adminError(
      "You cannot revoke your own series access from here.",
      409,
      "SELF_ACCESS_CHANGE_BLOCKED"
    );
  }

  try {
    const body = await request.json().catch(() => null);
    if (!body) return adminBadRequestResponse("Invalid JSON request.");

    const seriesId = normalizeId(body.seriesId);

    if (!seriesId || !isValidPaidSeriesId(seriesId)) {
      return adminError(
        "Only paid-series access can be manually revoked.",
        400,
        "INVALID_PAID_SERIES"
      );
    }

    const user = await getTargetUser(userId);
    if (!user) return adminError("User not found.", 404, "USER_NOT_FOUND");

    const [accessResult] = await db.batch(
      [
        {
          sql: `
            UPDATE user_series_access
            SET is_active = 0
            WHERE user_id = ? AND series_id = ?
          `,
          args: [userId, seriesId],
        },
        {
          sql: `
            UPDATE users
            SET active_session_id = NULL, active_device_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          args: [userId],
        },
      ],
      "write"
    );

    const series = getPaidSeries(seriesId);

    return adminSuccess({
      message: `${series.name} access revoked successfully. The user's current session/device was revoked.`,
      changed: Number(accessResult?.rowsAffected || 0) > 0,
      user: {
        id: userId,
        username: user.username,
        isActive: Number(user.is_active) === 1,
      },
      access: {
        seriesId,
        seriesSlug: series.slug,
        seriesName: series.name,
        isActive: false,
      },
      sessionRevoked: true,
    });
  } catch (error) {
    return adminInternalError(error, "[DELETE admin user access]");
  }
});