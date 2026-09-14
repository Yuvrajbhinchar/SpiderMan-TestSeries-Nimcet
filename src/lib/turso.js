import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  throw new Error("Missing TURSO_DATABASE_URL in .env.local");
}

if (!authToken) {
  throw new Error("Missing TURSO_AUTH_TOKEN in .env.local");
}

console.log(
  `[Turso] Connecting to: ${url.replace(
    /^(.{12}).*(\.turso\.io.*)$/,
    "$1...$2"
  )}`
);

export const db = createClient({
  url,
  authToken,
});

/* =========================================================
   BATCH WRITE HELPER
   ---------------------------------------------------------
   Wraps db.batch() so every admin/bulk route shares:

     - a hard cap on how many statements can go in one call
       (protects the Turso free-tier write quota from an
       accidental huge batch)
     - consistent error logging
     - a single choke point if we ever need to add retries,
       metrics, or a different batching strategy later

   Usage:

     await batchWrite([
       { sql: "UPDATE ...", args: [...] },
       { sql: "INSERT ...", args: [...] },
     ]);

   Returns the same array of ResultSet objects db.batch()
   would return, in the same order as the statements.
========================================================= */

const MAX_BATCH_STATEMENTS = 50;

export async function batchWrite(statements, mode = "write") {
  if (!Array.isArray(statements) || statements.length === 0) {
    throw new Error("batchWrite: statements must be a non-empty array.");
  }

  if (statements.length > MAX_BATCH_STATEMENTS) {
    throw new Error(
      `batchWrite: refusing to run ${statements.length} statements in one batch (max ${MAX_BATCH_STATEMENTS}). Split into multiple calls.`
    );
  }

  for (const statement of statements) {
    if (!statement || typeof statement.sql !== "string" || !statement.sql.trim()) {
      throw new Error("batchWrite: every statement needs a non-empty sql string.");
    }
  }

  try {
    return await db.batch(statements, mode);
  } catch (error) {
    console.error(
      `[Turso] batchWrite failed (${statements.length} statement(s), mode=${mode}):`,
      error
    );

    throw error;
  }
}

/* =========================================================
   CHUNKED IN-CLAUSE HELPER
   ---------------------------------------------------------
   For bulk UPDATE/SELECT ... WHERE id IN (...) calls, this
   splits a large id list into safe-sized chunks and runs
   them sequentially, so a single request can't accidentally
   build a query with thousands of placeholders.

   Usage:

     const results = await chunkedInQuery(
       userIds,
       (chunk) => ({
         sql: `UPDATE users SET is_active = 1 WHERE id IN (${chunk.map(() => "?").join(",")})`,
         args: chunk,
       })
     );

     const totalAffected = results.reduce(
       (sum, r) => sum + Number(r.rowsAffected || 0),
       0
     );
========================================================= */

const MAX_IN_CLAUSE_SIZE = 200;

export async function chunkedInQuery(ids, buildStatement) {
  if (!Array.isArray(ids) || ids.length === 0) {
    return [];
  }

  const chunks = [];

  for (let i = 0; i < ids.length; i += MAX_IN_CLAUSE_SIZE) {
    chunks.push(ids.slice(i, i + MAX_IN_CLAUSE_SIZE));
  }

  const results = [];

  for (const chunk of chunks) {
    const statement = buildStatement(chunk);
    results.push(await db.execute(statement));
  }

  return results;
}