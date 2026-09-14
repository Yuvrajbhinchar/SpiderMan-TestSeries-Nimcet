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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/* =========================================================
   PATCH
   /api/admin/categories/[id]
   Body: { name?, slug?, description?, parentId? }
   Only provided fields are updated.
========================================================= */

export const PATCH = withAdminAction(
  ADMIN_ACTIONS.CATEGORY_UPDATE,

  async ({ request, context }) => {
    const { id: rawId } = await context.params;
    const categoryId = normalizeId(rawId);

    if (!categoryId) {
      return adminBadRequestResponse("Invalid category ID.");
    }

    const body = await request.json().catch(() => null);

    if (!body) {
      return adminBadRequestResponse("Invalid JSON request.");
    }

    const setClauses = [];
    const args = [];

    if (body.name !== undefined) {
      const name = String(body.name || "").trim();

      if (!name || name.length > 150) {
        return adminBadRequestResponse("Name must be 1-150 characters.");
      }

      setClauses.push("name = ?");
      args.push(name);
    }

    if (body.slug !== undefined) {
      const slug = String(body.slug || "").trim().toLowerCase();

      if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 150) {
        return adminBadRequestResponse(
          "Slug must be lowercase letters, numbers, and hyphens only."
        );
      }

      setClauses.push("slug = ?");
      args.push(slug);
    }

    if (body.description !== undefined) {
      setClauses.push("description = ?");
      args.push(body.description ? String(body.description).trim() : null);
    }

    if (body.parentId !== undefined) {
      const parentId = body.parentId === null ? null : normalizeId(body.parentId);

      if (body.parentId !== null && !parentId) {
        return adminBadRequestResponse("Invalid parent category ID.");
      }

      if (parentId === categoryId) {
        return adminBadRequestResponse("A category cannot be its own parent.");
      }

      setClauses.push("parent_id = ?");
      args.push(parentId);
    }

    if (setClauses.length === 0) {
      return adminBadRequestResponse("No fields provided to update.");
    }

    args.push(categoryId);

    try {
      const result = await db.execute({
        sql: `
          UPDATE test_categories
          SET ${setClauses.join(", ")}
          WHERE id = ?
          RETURNING id, parent_id, name, slug, description, is_active, created_at
        `,
        args,
      });

      const updated = result.rows?.[0];

      if (!updated) {
        return adminNotFoundResponse("Category not found.");
      }

      return adminSuccess({
        message: "Category updated successfully.",
        category: {
          id: Number(updated.id),
          parentId: updated.parent_id === null ? null : Number(updated.parent_id),
          name: updated.name,
          slug: updated.slug,
          description: updated.description || null,
          isActive: Number(updated.is_active) === 1,
          createdAt: updated.created_at,
        },
      });
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();

      if (message.includes("unique")) {
        return adminConflictResponse("A category with this slug already exists.");
      }

      return adminInternalError(error, "[PATCH /api/admin/categories/[id]]");
    }
  },

  { logContext: "[PATCH /api/admin/categories/[id]]" }
);