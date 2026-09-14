import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminConflictResponse,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase();
}

/* =========================================================
   GET
   /api/admin/categories
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.TEST_READ,

  async () => {
    try {
      const result = await db.execute({
        sql: `
          SELECT id, parent_id, name, slug, description, is_active, created_at
          FROM test_categories
          ORDER BY is_active DESC, name ASC
        `,
        args: [],
      });

      const categories = (result.rows || []).map((row) => ({
        id: Number(row.id),
        parentId: row.parent_id === null ? null : Number(row.parent_id),
        name: row.name,
        slug: row.slug,
        description: row.description || null,
        isActive: Number(row.is_active) === 1,
        createdAt: row.created_at || null,
      }));

      return adminSuccess({ categories });
    } catch (error) {
      return adminInternalError(error, "[GET /api/admin/categories]");
    }
  },

  { logContext: "[GET /api/admin/categories]" }
);

/* =========================================================
   POST
   /api/admin/categories
   Body: { name, slug, description?, parentId? }
========================================================= */

export const POST = withAdminAction(
  ADMIN_ACTIONS.CATEGORY_CREATE,

  async ({ request }) => {
    const body = await request.json().catch(() => null);

    if (!body) {
      return adminBadRequestResponse("Invalid JSON request.");
    }

    const name = String(body.name || "").trim();
    const slug = normalizeSlug(body.slug);
    const description = body.description ? String(body.description).trim() : null;
    const parentId = body.parentId ? normalizeId(body.parentId) : null;

    if (!name || name.length > 150) {
      return adminBadRequestResponse("Name is required (max 150 characters).");
    }

    if (!slug || !SLUG_PATTERN.test(slug) || slug.length > 150) {
      return adminBadRequestResponse(
        "Slug must be lowercase letters, numbers, and hyphens only."
      );
    }

    if (body.parentId && !parentId) {
      return adminBadRequestResponse("Invalid parent category ID.");
    }

    try {
      if (parentId) {
        const parentResult = await db.execute({
          sql: `SELECT id FROM test_categories WHERE id = ? LIMIT 1`,
          args: [parentId],
        });

        if (!parentResult.rows?.[0]) {
          return adminBadRequestResponse("Parent category does not exist.");
        }
      }

      const result = await db.execute({
        sql: `
          INSERT INTO test_categories (parent_id, name, slug, description, is_active)
          VALUES (?, ?, ?, ?, 1)
          RETURNING id, parent_id, name, slug, description, is_active, created_at
        `,
        args: [parentId, name, slug, description],
      });

      const created = result.rows?.[0];

      return adminSuccess(
        {
          message: "Category created successfully.",
          category: {
            id: Number(created.id),
            parentId: created.parent_id === null ? null : Number(created.parent_id),
            name: created.name,
            slug: created.slug,
            description: created.description || null,
            isActive: Number(created.is_active) === 1,
            createdAt: created.created_at,
          },
        },
        201
      );
    } catch (error) {
      const message = String(error?.message || "").toLowerCase();

      if (message.includes("unique")) {
        return adminConflictResponse("A category with this slug already exists.");
      }

      return adminInternalError(error, "[POST /api/admin/categories]");
    }
  },

  { logContext: "[POST /api/admin/categories]" }
);