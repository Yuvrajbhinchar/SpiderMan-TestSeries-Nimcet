import { NextResponse } from "next/server";

import { db } from "@/lib/turso";

import {
  SERIES_CONFIG,
  requireAuthenticatedUser,
} from "@/lib/testSecurity";

/* =========================================================
   HELPERS
========================================================= */

function toNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function toIsoUtc(value) {
  if (!value) {
    return null;
  }

  const text =
    String(value);

  /*
   * Turso / SQLite:
   *
   * YYYY-MM-DD HH:mm:ss
   */

  if (
    text.length === 19 &&
    text[4] === "-" &&
    text[7] === "-" &&
    text[10] === " " &&
    text[13] === ":" &&
    text[16] === ":"
  ) {
    return `${text.replace(
      " ",
      "T"
    )}Z`;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function getSeriesName(
  slug
) {
  switch (
    String(slug || "")
      .trim()
      .toLowerCase()
  ) {
    case "free":
      return "Free";

    case "asspire":
      return "Asspire";

    case "imppetus":
      return "Imppetus";

    case "spiderman":
      return "SpiderMan";

    default:
      return "Test Series";
  }
}

/* =========================================================
   GET
   /api/dashboard/history
========================================================= */

export async function GET(
  request
) {
  try {
    /* -------------------------------------------------------
       AUTH

       Centralized in testSecurity.js.

       This validates:
       - JWT
       - user existence
       - account active
       - active session
       - active device
    ------------------------------------------------------- */

    const auth =
      await requireAuthenticatedUser();

    if (!auth.ok) {
      return auth.response;
    }

    const {
      userId,
    } = auth;

    /* -------------------------------------------------------
       LIMIT

       History remains intentionally lightweight.
    ------------------------------------------------------- */

    const {
      searchParams,
    } = new URL(
      request.url
    );

    let limit =
      Number(
        searchParams.get(
          "limit"
        ) || 50
      );

    if (
      !Number.isInteger(
        limit
      ) ||
      limit <= 0
    ) {
      limit = 50;
    }

    limit =
      Math.min(
        limit,
        100
      );

    /* -------------------------------------------------------
       BUILD UNION

       Central SERIES_CONFIG is now the single source for:
       - series slug
       - series id
       - test table
       - attempt table
    ------------------------------------------------------- */

    const seriesEntries =
      Object.entries(
        SERIES_CONFIG
      );

    const unionParts =
      seriesEntries.map(
        (
          [
            slug,
            series,
          ]
        ) => {
          const seriesId =
            Number(
              series.seriesId
            );

          const seriesName =
            getSeriesName(
              slug
            );

          /*
           * Values such as series ID/name/slug are static
           * application configuration, not user input.
           */

          return `
            SELECT
              ta.id AS attempt_id,

              ta.user_id,

              ta.test_id,

              ta.attempt_number,

              ta.status,

              ta.score,

              ta.total_marks,

              ta.time_taken_seconds,

              ta.submitted_at,

              ta.created_at,

              t.title AS test_title,

              t.slug AS test_slug,

              ${seriesId} AS series_id,

              '${slug}' AS series_slug,

              '${seriesName.replace(
                /'/g,
                "''"
              )}' AS series_name

            FROM ${series.attemptTable} ta

            INNER JOIN ${series.testTable} t
              ON t.id = ta.test_id

            WHERE
              ta.user_id = ?

              AND ta.status IN (
                'submitted',
                'auto_submitted'
              )
          `;
        }
      );

    /* -------------------------------------------------------
       USER ID ARGUMENT
       
       One argument per UNION branch.
    ------------------------------------------------------- */

    const userArgs =
      seriesEntries.map(
        () => userId
      );

    /* -------------------------------------------------------
       HISTORY QUERY
    ------------------------------------------------------- */

    const historyResult =
      await db.execute({
        sql: `
          SELECT *
          FROM (
            ${unionParts.join(
              "\nUNION ALL\n"
            )}
          ) history

          ORDER BY
            COALESCE(
              history.submitted_at,
              history.created_at
            ) DESC,

            history.attempt_id DESC

          LIMIT ?
        `,

        args: [
          ...userArgs,
          limit,
        ],
      });

    /* -------------------------------------------------------
       NORMALIZE
    ------------------------------------------------------- */

    const history =
      (
        historyResult.rows ||
        []
      ).map(
        (row) => ({
          attemptId:
            Number(
              row.attempt_id
            ),

          testId:
            Number(
              row.test_id
            ),

          attemptNumber:
            Number(
              row.attempt_number ||
                1
            ),

          status:
            String(
              row.status ||
                "submitted"
            ),

          score:
            toNumber(
              row.score,
              0
            ),

          totalMarks:
            toNumber(
              row.total_marks,
              0
            ),

          timeTakenSeconds:
            toNumber(
              row.time_taken_seconds,
              0
            ),

          submittedAt:
            toIsoUtc(
              row.submitted_at
            ),

          createdAt:
            toIsoUtc(
              row.created_at
            ),

          test: {
            id:
              Number(
                row.test_id
              ),

            title:
              row.test_title ||
              "Test",

            slug:
              row.test_slug ||
              null,
          },

          series: {
            id:
              Number(
                row.series_id
              ),

            slug:
              row.series_slug ||
              "",

            name:
              row.series_name ||
              "Test Series",
          },
        })
      );

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        history,

        count:
          history.length,
      },
      {
        status: 200,

        headers: {
          "Cache-Control":
            "private, no-store, max-age=0",

          Pragma:
            "no-cache",

          Expires:
            "0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[GET /api/dashboard/history] ERROR:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to load test history.",
      },
      {
        status: 500,
      }
    );
  }
}