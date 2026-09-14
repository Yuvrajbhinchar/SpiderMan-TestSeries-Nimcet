import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
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
   /api/admin/categories/[id]/status
   Body: { isActive: true | false }
========================================================= */

async function handler({ request, context, userId }) {
  const { id: rawId } = await context.params;
  const categoryId = normalizeId(rawId);

  if (!categoryId) {
    return adminBadRequestResponse("Invalid category ID.");
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
      sql: `SELECT id, name, slug, is_active FROM test_categories WHERE id = ? LIMIT 1`,
      args: [categoryId],
    });

    const existing = existingResult.rows?.[0];

    if (!existing) {
      return adminNotFoundResponse("Category not found.");
    }

    const currentActive = Number(existing.is_active) === 1;

    if (currentActive === nextActive) {
      return adminSuccess({
        message: "Category status is already up to date.",
        changed: false,
        category: {
          id: Number(existing.id),
          name: existing.name,
          slug: existing.slug,
          isActive: currentActive,
        },
      });
    }

    const result = await db.execute({
      sql: `
        UPDATE test_categories
        SET is_active = ?
        WHERE id = ?
        RETURNING id, name, slug, is_active
      `,
      args: [nextActive ? 1 : 0, categoryId],
    });

    const updated = result.rows?.[0];

    if (!updated) {
      return adminNotFoundResponse("Category could not be updated.");
    }

    return adminSuccess({
      message: nextActive
        ? "Category activated successfully."
        : "Category deactivated successfully. Tests under it will be treated as unavailable.",
      changed: true,
      changedBy: Number(userId),
      category: {
        id: Number(updated.id),
        name: updated.name,
        slug: updated.slug,
        isActive: Number(updated.is_active) === 1,
      },
      cacheInvalidation: { type: "category", categoryId },
    });
  } catch (error) {
    return adminInternalError(error, "[POST /api/admin/categories/[id]/status]");
  }
}

export async function POST(request, context) {
  const body = await request.clone().json().catch(() => null);

  const action =
    body?.isActive === true
      ? ADMIN_ACTIONS.CATEGORY_ACTIVATE
      : ADMIN_ACTIONS.CATEGORY_DEACTIVATE;

  return withAdminAction(action, handler, {
    logContext: "[POST /api/admin/categories/[id]/status]",
  })(request, context);
}