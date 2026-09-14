import { db } from "@/lib/turso";

import {
  withAdmin,
} from "@/lib/adminApi";

import {
  adminBadRequestResponse,
  adminError,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getLimit(value) {
  const number = Number(value);
  if (!Number.isInteger(number)) return 25;
  return Math.min(Math.max(number, 1), 100);
}

/* =========================================================
   GET USERS
   /api/admin/users
========================================================= */

export const GET = withAdmin(async ({ request }) => {
  const { searchParams } = new URL(request.url);

  const search = String(searchParams.get("search") || "").trim();
  const status = normalize(searchParams.get("status") || "all");
  const role = normalize(searchParams.get("role") || "all");
  const cursor = normalizeId(searchParams.get("cursor"));
  const limit = getLimit(searchParams.get("limit"));

  if (!["all", "active", "inactive"].includes(status)) {
    return adminBadRequestResponse("Invalid status filter.");
  }

  if (!["all", "user", "admin"].includes(role)) {
    return adminBadRequestResponse("Invalid role filter.");
  }

  const where = ["1 = 1"];
  const args = [];

  if (status === "active") where.push("u.is_active = 1");
  if (status === "inactive") where.push("u.is_active = 0");

  if (role === "user" || role === "admin") {
    where.push("u.role = ?");
    args.push(role);
  }

  if (search) {
    where.push(`
      (
        u.username LIKE ?
        OR u.email LIKE ?
        OR COALESCE(u.display_name, '') LIKE ?
      )
    `);
    const pattern = `%${search}%`;
    args.push(pattern, pattern, pattern);
  }

  if (cursor) {
    where.push("u.id < ?");
    args.push(cursor);
  }

  try {
    const result = await db.execute({
      sql: `
        SELECT
          u.id, u.username, u.email, u.display_name, u.role,
          u.is_active, u.active_session_id, u.active_device_id,
          u.created_at, u.updated_at
        FROM users u
        WHERE ${where.join("\nAND ")}
        ORDER BY u.id DESC
        LIMIT ${limit}
      `,
      args,
    });

    const rows = Array.isArray(result.rows) ? result.rows : [];

    const users = rows.map((row) => ({
      id: Number(row.id),
      username: row.username,
      email: row.email,
      displayName: row.display_name || "",
      role: row.role,
      isActive: Number(row.is_active) === 1,
      hasActiveSession: Boolean(row.active_session_id),
      hasActiveDevice: Boolean(row.active_device_id),
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null,
    }));

    const nextCursor =
      rows.length === limit ? Number(rows[rows.length - 1].id) : null;

    return adminSuccess({
      users,
      pagination: { nextCursor, hasMore: nextCursor !== null },
      count: users.length,
    });
  } catch (error) {
    return adminInternalError(error, "[GET /api/admin/users]");
  }
});

/* =========================================================
   PATCH — single user action
   Body: { userId: 123, action: "activate" | "deactivate" | "revoke_session" }
========================================================= */

export const PATCH = withAdmin(async ({ request, userId: adminId }) => {
  const body = await request.json().catch(() => null);
  if (!body) return adminBadRequestResponse("Invalid JSON request.");

  const targetUserId = normalizeId(body?.userId);
  const action = normalize(body?.action);

  if (!targetUserId) {
    return adminError("Valid user ID is required.", 400, "INVALID_USER_ID");
  }

  if (!["activate", "deactivate", "revoke_session"].includes(action)) {
    return adminError("Invalid user action.", 400, "INVALID_ACTION");
  }

  if (targetUserId === adminId) {
    return adminError(
      "You cannot change your own admin account from here.",
      409,
      "SELF_ACTION_BLOCKED"
    );
  }

  try {
    const targetResult = await db.execute({
      sql: `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
      args: [targetUserId],
    });

    const target = targetResult.rows?.[0];
    if (!target) {
      return adminError("User not found.", 404, "USER_NOT_FOUND");
    }

    if (action === "activate") {
      const result = await db.execute({
        sql: `UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [targetUserId],
      });

      if (Number(result.rowsAffected || 0) !== 1) {
        return adminError("User could not be activated.", 409, "USER_UPDATE_FAILED");
      }

      return adminSuccess({
        message: "User activated successfully.",
        user: { id: targetUserId, isActive: true, role: target.role },
      });
    }

    if (action === "deactivate") {
      const result = await db.execute({
        sql: `
          UPDATE users
          SET is_active = 0, active_session_id = NULL, active_device_id = NULL,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [targetUserId],
      });

      if (Number(result.rowsAffected || 0) !== 1) {
        return adminError("User could not be deactivated.", 409, "USER_UPDATE_FAILED");
      }

      return adminSuccess({
        message: "User deactivated and active session revoked.",
        user: {
          id: targetUserId,
          isActive: false,
          hasActiveSession: false,
          hasActiveDevice: false,
          role: target.role,
        },
      });
    }

    // revoke_session
    const result = await db.execute({
      sql: `
        UPDATE users
        SET active_session_id = NULL, active_device_id = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      args: [targetUserId],
    });

    if (Number(result.rowsAffected || 0) !== 1) {
      return adminError("Session could not be revoked.", 409, "SESSION_REVOKE_FAILED");
    }

    return adminSuccess({
      message: "User session revoked successfully.",
      user: { id: targetUserId, hasActiveSession: false, hasActiveDevice: false },
    });
  } catch (error) {
    return adminInternalError(error, "[PATCH /api/admin/users]");
  }
});