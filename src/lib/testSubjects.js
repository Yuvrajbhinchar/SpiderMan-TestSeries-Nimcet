import {
  db,
  batchWrite,
} from "@/lib/turso";

/* =========================================================
   TEST SUBJECTS
   ---------------------------------------------------------
   Every series keeps its own link table between a test and the
   NIMCET subjects it covers:

     free_test_subjects      (test_id, subject_id)
     asspire_test_subjects
     imppetus_test_subjects
     spiderman_test_subjects

   The student dashboard uses this to filter DPPs by subject
   (/api/dashboard/tests?mode=dpp&subject=maths) and TestCard
   uses it to show the subject chips, so a DPP with no rows here
   is invisible under every subject tab.

   Everything below is shared by the admin create + update
   routes so the two can never drift apart.
========================================================= */

export const SERIES_SUBJECT_TABLES =
  Object.freeze({
    free: "free_test_subjects",
    asspire: "asspire_test_subjects",
    imppetus: "imppetus_test_subjects",
    spiderman: "spiderman_test_subjects",
  });

/* =========================================================
   TABLE LOOKUP
========================================================= */

export function getSubjectTable(
  series
) {
  const key =
    String(series || "")
      .trim()
      .toLowerCase();

  return (
    SERIES_SUBJECT_TABLES[
      key
    ] || null
  );
}

/* =========================================================
   PARSE SUBJECT IDS FROM A REQUEST BODY

   Returns:

     null  -> the client did not send the field at all
              (PATCH: leave existing subjects untouched)

     []    -> the client explicitly sent an empty selection

     [n]   -> deduplicated, sorted, positive integers
========================================================= */

export function parseSubjectIds(
  value
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const list =
    Array.isArray(value)
      ? value
      : [value];

  const ids = [];

  for (const item of list) {
    const id = Number(item);

    if (
      !Number.isInteger(
        id
      ) ||
      id <= 0
    ) {
      continue;
    }

    if (
      !ids.includes(id)
    ) {
      ids.push(id);
    }
  }

  /*
   * Hard cap: there are four NIMCET subjects. A larger payload
   * is either a bug or someone poking the endpoint.
   */
  return ids
    .sort(
      (a, b) => a - b
    )
    .slice(0, 12);
}

/* =========================================================
   VALIDATE AGAINST THE SUBJECTS TABLE

   Guards against a stale admin tab sending an id that has since
   been deleted, which would otherwise blow up on the foreign
   key mid-write.
========================================================= */

export async function validateSubjectIds(
  subjectIds
) {
  if (
    !Array.isArray(
      subjectIds
    ) ||
    subjectIds.length === 0
  ) {
    return {
      ok: true,
      subjects: [],
    };
  }

  const placeholders =
    subjectIds
      .map(() => "?")
      .join(",");

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          name,
          slug
        FROM subjects
        WHERE id IN (${placeholders})
      `,

      args: subjectIds,
    });

  const rows =
    result.rows || [];

  if (
    rows.length !==
    subjectIds.length
  ) {
    const found = new Set(
      rows.map((row) =>
        Number(row.id)
      )
    );

    const missing =
      subjectIds.filter(
        (id) =>
          !found.has(id)
      );

    return {
      ok: false,

      message: `Unknown subject id(s): ${missing.join(
        ", "
      )}.`,
    };
  }

  return {
    ok: true,

    subjects: rows.map(
      (row) => ({
        id: Number(row.id),
        name: row.name,
        slug: row.slug,
      })
    ),
  };
}

/* =========================================================
   READ THE SUBJECTS ATTACHED TO ONE TEST
========================================================= */

export async function getTestSubjects({
  table,
  testId,
}) {
  if (!table || !testId) {
    return [];
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          s.id,
          s.name,
          s.slug
        FROM ${table} ts

        INNER JOIN subjects s
          ON s.id =
            ts.subject_id

        WHERE
          ts.test_id = ?

        ORDER BY
          s.id ASC
      `,

      args: [testId],
    });

  return (
    result.rows || []
  ).map((row) => ({
    id: Number(row.id),
    name: row.name,
    slug: row.slug,
  }));
}

/* =========================================================
   REPLACE THE SUBJECTS ATTACHED TO ONE TEST

   Delete + insert in a single batch so a failed write can never
   leave a test with no subjects at all.
========================================================= */

export async function setTestSubjects({
  table,
  testId,
  subjectIds,
}) {
  if (!table || !testId) {
    return;
  }

  const statements = [
    {
      sql: `
        DELETE FROM ${table}
        WHERE test_id = ?
      `,

      args: [testId],
    },
  ];

  for (const subjectId of subjectIds ||
    []) {
    statements.push({
      sql: `
        INSERT OR IGNORE INTO ${table} (
          test_id,
          subject_id
        )
        VALUES (?, ?)
      `,

      args: [
        testId,
        subjectId,
      ],
    });
  }

  await batchWrite(
    statements
  );
}

/* =========================================================
   DPP RULE

   A DPP that is not tagged with at least one subject cannot be
   reached from the student dashboard, because every DPP tab is
   a subject tab. Blocking it at save time is far cheaper than
   debugging "my DPP is published but nobody can see it".
========================================================= */

export function requiresSubjects(
  categorySlug
) {
  return (
    String(
      categorySlug || ""
    )
      .trim()
      .toLowerCase() === "dpp"
  );
}