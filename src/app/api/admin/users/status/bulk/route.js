import { db } from "@/lib/turso";

import { withAdmin } from "@/lib/adminApi";

import {
  adminBadRequestResponse,
  adminError,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import { normalizeIdList } from "@/lib/seriesAccess";

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

/* =========================================================
   POST — bulk user status change
   Body: { userIds: [1,2,3], action: "activate" | "deactivate" | "revoke_session" }
========================================================= */

export const POST = withAdmin(async ({ request, userId: adminId }) => {
  const body = await request.json().catch(() => null);
  if (!body) return adminBadRequestResponse("Invalid JSON request.");

  const action = normalize(body?.action);

  if (!["activate", "deactivate", "revoke_session"].includes(action)) {
    return adminError("Invalid bulk action.", 400, "INVALID_ACTION");
  }

  const idResult = normalizeIdList(body?.userIds, { excludeId: adminId });

  if (!idResult.ok) {
    return adminError(idResult.reason, 400, "INVALID_USER_IDS");
  }

  const ids = idResult.ids;
  const placeholders = ids.map(() => "?").join(", ");

  try {
    let sql;

    if (action === "activate") {
      sql = `
        UPDATE users
        SET is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `;
    } else if (action === "deactivate") {
      sql = `
        UPDATE users
        SET is_active = 0, active_session_id = NULL, active_device_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `;
    } else {
      sql = `
        UPDATE users
        SET active_session_id = NULL, active_device_id = NULL,
            updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})
      `;
    }

    const result = await db.execute({ sql, args: ids });

    return adminSuccess({
      message: `Bulk ${action.replace("_", " ")} applied to ${result.rowsAffected || 0} user(s).`,
      action,
      requested: ids.length,
      affected: Number(result.rowsAffected || 0),
      skippedSelf: Array.isArray(body?.userIds)
        ? body.userIds.length - ids.length
        : 0,
    });
  } catch (error) {
    return adminInternalError(error, "[POST /api/admin/users/status/bulk]");
  }
});