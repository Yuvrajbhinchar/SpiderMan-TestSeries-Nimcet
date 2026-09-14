import { db } from "@/lib/turso";

import { withAdmin } from "@/lib/adminApi";

import {
  adminBadRequestResponse,
  adminError,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  getPaidSeries,
  isValidPaidSeriesId,
  normalizeIdList,
  parseExpiry,
} from "@/lib/seriesAccess";

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* =========================================================
   POST — bulk grant / update access
   Body: { userIds: [...], seriesId: 4, expiresAt: null | isoString }
========================================================= */

export const POST = withAdmin(async ({ request, userId: adminId }) => {
  const body = await request.json().catch(() => null);
  if (!body) return adminBadRequestResponse("Invalid JSON request.");

  const seriesId = normalizeId(body?.seriesId);

  if (!seriesId || !isValidPaidSeriesId(seriesId)) {
    return adminError(
      "A valid paid series ID is required.",
      400,
      "INVALID_PAID_SERIES"
    );
  }

  const expiry = parseExpiry(body?.expiresAt);

  if (!expiry.valid) {
    return adminError(
      "Expiry must be a valid future date.",
      400,
      "INVALID_EXPIRY"
    );
  }

  const idResult = normalizeIdList(body?.userIds, { excludeId: adminId });

  if (!idResult.ok) {
    return adminError(idResult.reason, 400, "INVALID_USER_IDS");
  }

  const ids = idResult.ids;
  const expiresAt = expiry.value;
  const series = getPaidSeries(seriesId);

  // Build one multi-row INSERT ... ON CONFLICT statement.
  const rowsSql = ids.map(() => "(?, ?, ?, CURRENT_TIMESTAMP, ?, 1)").join(", ");
  const insertArgs = [];

  for (const uid of ids) {
    insertArgs.push(uid, seriesId, adminId, expiresAt);
  }

  const grantPlaceholders = ids.map(() => "?").join(", ");

  try {
    await db.batch(
      [
        {
          sql: `
            INSERT INTO user_series_access
              (user_id, series_id, granted_by, granted_at, expires_at, is_active)
            VALUES ${rowsSql}
            ON CONFLICT (user_id, series_id) DO UPDATE SET
              granted_by = excluded.granted_by,
              granted_at = CURRENT_TIMESTAMP,
              expires_at = excluded.expires_at,
              is_active = 1
          `,
          args: insertArgs,
        },
        {
          sql: `
            UPDATE users
            SET active_session_id = NULL, active_device_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${grantPlaceholders})
          `,
          args: ids,
        },
      ],
      "write"
    );

    return adminSuccess({
      message: `${series.name} access granted to ${ids.length} user(s). Their sessions were revoked; they must log in again.`,
      seriesId,
      seriesSlug: series.slug,
      affectedUsers: ids.length,
      expiresAt,
      sessionRevoked: true,
    });
  } catch (error) {
    return adminInternalError(error, "[POST /api/admin/users/access/bulk]");
  }
});

/* =========================================================
   DELETE — bulk revoke access
   Body: { userIds: [...], seriesId: 4 }
========================================================= */

export const DELETE = withAdmin(async ({ request, userId: adminId }) => {
  const body = await request.json().catch(() => null);
  if (!body) return adminBadRequestResponse("Invalid JSON request.");

  const seriesId = normalizeId(body?.seriesId);

  if (!seriesId || !isValidPaidSeriesId(seriesId)) {
    return adminError(
      "A valid paid series ID is required.",
      400,
      "INVALID_PAID_SERIES"
    );
  }

  const idResult = normalizeIdList(body?.userIds, { excludeId: adminId });

  if (!idResult.ok) {
    return adminError(idResult.reason, 400, "INVALID_USER_IDS");
  }

  const ids = idResult.ids;
  const series = getPaidSeries(seriesId);
  const placeholders = ids.map(() => "?").join(", ");

  try {
    const [accessResult] = await db.batch(
      [
        {
          sql: `
            UPDATE user_series_access
            SET is_active = 0
            WHERE series_id = ?
              AND user_id IN (${placeholders})
          `,
          args: [seriesId, ...ids],
        },
        {
          sql: `
            UPDATE users
            SET active_session_id = NULL, active_device_id = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id IN (${placeholders})
          `,
          args: ids,
        },
      ],
      "write"
    );

    return adminSuccess({
      message: `${series.name} access revoked for ${ids.length} user(s). Their sessions were revoked.`,
      seriesId,
      seriesSlug: series.slug,
      affectedUsers: ids.length,
      changed: Number(accessResult?.rowsAffected || 0) > 0,
      sessionRevoked: true,
    });
  } catch (error) {
    return adminInternalError(error, "[DELETE /api/admin/users/access/bulk]");
  }
});