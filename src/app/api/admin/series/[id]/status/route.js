import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminConflictResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* =========================================================
   POST
   /api/admin/series/[id]/status
   Body: { isActive: true | false }
========================================================= */

async function handler({ request, context, userId }) {
  const { id: rawId } = await context.params;
  const seriesId = normalizeId(rawId);

  if (!seriesId) {
    return adminBadRequestResponse("Invalid series ID.");
  }

  const body = await request.json().catch(() => null);

  if (!body || typeof body.isActive !== "boolean") {
    return adminBadRequestResponse(
      "Body must include a boolean isActive field."
    );
  }

  const nextActive = body.isActive;

  try {
    const existingResult = await db.execute({
      sql: `SELECT id, name, slug, is_active FROM test_series WHERE id = ? LIMIT 1`,
      args: [seriesId],
    });

    const existing = existingResult.rows?.[0];

    if (!existing) {
      return adminNotFoundResponse("Series not found.");
    }

    const currentActive = Number(existing.is_active) === 1;

    if (currentActive === nextActive) {
      return adminSuccess({
        message: "Series status is already up to date.",
        changed: false,
        series: {
          id: Number(existing.id),
          name: existing.name,
          slug: existing.slug,
          isActive: currentActive,
        },
      });
    }

    const result = await db.execute({
      sql: `
        UPDATE test_series
        SET is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING id, name, slug, is_active, updated_at
      `,
      args: [nextActive ? 1 : 0, seriesId],
    });

    const updated = result.rows?.[0];

    if (!updated) {
      return adminNotFoundResponse("Series could not be updated.");
    }

    return adminSuccess({
      message: nextActive
        ? "Series activated successfully."
        : "Series deactivated successfully. Existing test attempts are unaffected, but new access checks will be blocked.",
      changed: true,
      changedBy: Number(userId),
      series: {
        id: Number(updated.id),
        name: updated.name,
        slug: updated.slug,
        isActive: Number(updated.is_active) === 1,
        updatedAt: updated.updated_at,
      },
      cacheInvalidation: { type: "series", seriesId },
    });
  } catch (error) {
    return adminInternalError(error, "[POST /api/admin/series/[id]/status]");
  }
}

/*
 * The action passed to requireAdminAction is resolved from the
 * request body's boolean isActive flag below, not taken verbatim
 * from the client — the client can only flip a boolean, never
 * name an arbitrary ADMIN_ACTIONS constant.
 */

export async function POST(request, context) {
  const body = await request.clone().json().catch(() => null);

  const action =
    body?.isActive === true
      ? ADMIN_ACTIONS.SERIES_ACTIVATE
      : ADMIN_ACTIONS.SERIES_DEACTIVATE;

  return withAdminAction(action, handler, {
    logContext: "[POST /api/admin/series/[id]/status]",
  })(request, context);
}