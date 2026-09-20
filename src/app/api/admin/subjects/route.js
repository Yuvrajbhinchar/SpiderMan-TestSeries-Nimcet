import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminInternalError,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  withAdminAction,
} from "@/lib/adminApi";

export const dynamic =
  "force-dynamic";

/* =========================================================
   CANONICAL NIMCET SUBJECTS

   The student dashboard filters DPPs by subject slug, so these
   four slugs are part of the public contract:

     /api/dashboard/tests?mode=dpp&subject=maths

   The ids are fixed too, purely so that an older database that
   was seeded by hand keeps the same ids.

   Seeding here is idempotent (INSERT OR IGNORE on a UNIQUE
   slug), so a fresh Turso database self-heals the first time an
   admin opens the test form instead of silently showing an
   empty subject list.
========================================================= */

const CANONICAL_SUBJECTS = [
  {
    id: 1,
    name: "Mathematics",
    slug: "maths",
  },
  {
    id: 2,
    name: "Logical Reasoning",
    slug: "reasoning",
  },
  {
    id: 3,
    name: "Computer Science",
    slug: "cs",
  },
  {
    id: 4,
    name: "English",
    slug: "english",
  },
];

/* =========================================================
   ENSURE SEED
========================================================= */

async function ensureSubjectsSeeded() {
  const countResult =
    await db.execute(
      "SELECT COUNT(*) AS total FROM subjects"
    );

  const total =
    Number(
      countResult.rows?.[0]
        ?.total || 0
    );

  if (total > 0) {
    return false;
  }

  await db.batch(
    CANONICAL_SUBJECTS.map(
      (subject) => ({
        sql: `
          INSERT OR IGNORE INTO subjects (
            id,
            name,
            slug
          )
          VALUES (?, ?, ?)
        `,

        args: [
          subject.id,
          subject.name,
          subject.slug,
        ],
      })
    ),
    "write"
  );

  return true;
}

/* =========================================================
   GET /api/admin/subjects

   Returns every subject that can be attached to a test.
========================================================= */

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.TEST_READ,

    async () => {
      try {
        const seeded =
          await ensureSubjectsSeeded();

        const result =
          await db.execute(`
            SELECT
              id,
              name,
              slug
            FROM subjects
            ORDER BY
              id ASC
          `);

        const subjects =
          (
            result.rows ||
            []
          ).map(
            (row) => ({
              id:
                Number(
                  row.id
                ),

              name:
                row.name,

              slug:
                row.slug,
            })
          );

        return adminSuccess({
          subjects,

          seeded,
        });
      } catch (error) {
        return adminInternalError(
          error,
          "[GET /api/admin/subjects]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/subjects]",
    }
  );
