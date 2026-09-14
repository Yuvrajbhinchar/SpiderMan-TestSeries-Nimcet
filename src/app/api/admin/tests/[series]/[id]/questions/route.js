import {
  db,
} from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  firstDefined,
  toNumber,
  toBoolean,
} from "@/lib/testSecurity";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminConflictResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  withAdminAction,
} from "@/lib/adminApi";

/* =========================================================
   QUESTION TYPES
========================================================= */

const QUESTION_TYPES =
  new Set([
    "mcq",
    "msq",
    "numeric",
    "true_false",
  ]);

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  return text || "";
}

function normalizeImageUrl(
  value
) {
  const text =
    String(
      value ?? ""
    ).trim();

  if (!text) {
    return null;
  }

  return text;
}

function normalizeInteger(
  value,
  fallback = null
) {
  const number =
    Number(value);

  if (
    !Number.isInteger(
      number
    )
  ) {
    return fallback;
  }

  return number;
}

function normalizeNumber(
  value,
  fallback = null
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    )
  ) {
    return fallback;
  }

  return number;
}

/* =========================================================
   OPTION NORMALIZATION
========================================================= */

function normalizeOptions(
  rawOptions
) {
  if (
    !Array.isArray(
      rawOptions
    )
  ) {
    return [];
  }

  return rawOptions.map(
    (
      option,
      index
    ) => ({
      id:
        normalizeInteger(
          option?.id
        ),

      label:
        normalizeText(
          firstDefined(
            option?.label,
            option?.optionLabel,
            option?.option_label,
            String.fromCharCode(
              65 + index
            )
          )
        ).toUpperCase(),

      text:
        normalizeText(
          firstDefined(
            option?.text,
            option?.optionText,
            option?.option_text,
            ""
          )
        ),

      isCorrect:
        toBoolean(
          firstDefined(
            option?.isCorrect,
            option?.is_correct,
            0
          )
        ),

      order:
        normalizeInteger(
          firstDefined(
            option?.order,
            option?.optionOrder,
            option?.option_order,
            index + 1
          ),
          index + 1
        ),
    })
  );
}

/* =========================================================
   VALIDATE OPTIONS
========================================================= */

function validateOptions({
  questionType,
  options,
}) {
  /*
   * Numeric questions don't use MCQ options.
   */

  if (
    questionType ===
    "numeric"
  ) {
    return {
      ok: true,
      options: [],
    };
  }

  if (
    options.length <
    2
  ) {
    return {
      ok: false,

      response:
        adminBadRequestResponse(
          "At least 2 options are required for this question type."
        ),
    };
  }

  const seenLabels =
    new Set();

  for (
    let index = 0;
    index <
    options.length;
    index += 1
  ) {
    const option =
      options[index];

    const label =
      String(
        option.label ||
          ""
      )
        .trim()
        .toUpperCase();

    if (!label) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            `Option ${index + 1} needs a label.`
          ),
      };
    }

    if (
      seenLabels.has(
        label
      )
    ) {
      return {
        ok: false,

        response:
          adminConflictResponse(
            `Duplicate option label "${label}".`
          ),
      };
    }

    seenLabels.add(
      label
    );

    if (
      !option.text
    ) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            `Option ${label} needs option text.`
          ),
      };
    }
  }

  const correctCount =
    options.filter(
      (
        option
      ) =>
        option.isCorrect
    ).length;

  if (
    questionType ===
    "mcq" ||
    questionType ===
      "true_false"
  ) {
    if (
      correctCount !==
      1
    ) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            questionType ===
              "true_false"
              ? "True/False question must have exactly one correct option."
              : "MCQ question must have exactly one correct option."
          ),
      };
    }
  }

  if (
    questionType ===
    "msq" &&
    correctCount <
      1
  ) {
    return {
      ok: false,

      response:
        adminBadRequestResponse(
          "MSQ question needs at least one correct option."
        ),
    };
  }

  return {
    ok: true,
    options,
  };
}

/* =========================================================
   TEST
========================================================= */

async function getTest({
  table,
  testId,
}) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          title,
          total_questions,
          total_marks
        FROM ${table}
        WHERE id = ?
        LIMIT 1
      `,

      args: [
        testId,
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

/* =========================================================
   SECTION LIST
========================================================= */

async function getSections({
  table,
  testId,
}) {
  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          section_name,
          section_order,
          duration_minutes,
          question_count,
          is_sequential,
          timer_group
        FROM ${table}
        WHERE test_id = ?
        ORDER BY
          section_order ASC,
          id ASC
      `,

      args: [
        testId,
      ],
    });

  return (
    result.rows ||
    []
  );
}

/* =========================================================
   QUESTION LIST
========================================================= */

export const GET =
  withAdminAction(
    ADMIN_ACTIONS.QUESTION_READ,

    async ({
      context,
    }) => {
      try {
        const {
          series:
            rawSeries,
          id:
            rawId,
        } =
          await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawId
          );

        const config =
          SERIES_CONFIG[
            series
          ];

        if (!config) {
          return adminBadRequestResponse(
            "Invalid test series."
          );
        }

        if (!testId) {
          return adminBadRequestResponse(
            "Invalid test ID."
          );
        }

        const test =
          await getTest({
            table:
              config.testTable,

            testId,
          });

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        /* ---------------------------------------------------
           QUESTIONS
        --------------------------------------------------- */

        const questionResult =
          await db.execute({
            sql: `
              SELECT
                q.id,
                q.test_id,
                q.section_id,
                q.question_text,
                q.question_image_url,
                q.explanation,
                q.question_type,
                q.marks,
                q.negative_marks,
                q.question_order,

                s.section_name

              FROM ${config.questionTable} q

              LEFT JOIN ${config.sectionTable} s
                ON s.id =
                  q.section_id

              WHERE
                q.test_id = ?

              ORDER BY
                q.question_order ASC,
                q.id ASC
            `,

            args: [
              testId,
            ],
          });

        const rows =
          Array.isArray(
            questionResult.rows
          )
            ? questionResult.rows
            : [];

        /* ---------------------------------------------------
           OPTIONS
        --------------------------------------------------- */

        const questionIds =
          rows
            .map(
              (row) =>
                Number(
                  row.id
                )
            )
            .filter(
              (
                id
              ) =>
                Number.isInteger(
                  id
                ) &&
                id > 0
            );

        let optionRows =
          [];

        if (
          questionIds.length >
          0
        ) {
          const placeholders =
            questionIds
              .map(
                () => "?"
              )
              .join(
                ","
              );

          const optionResult =
            await db.execute({
              sql: `
                SELECT
                  id,
                  question_id,
                  option_label,
                  option_text,
                  is_correct,
                  option_order
                FROM ${config.optionTable}
                WHERE
                  question_id IN (${placeholders})
                ORDER BY
                  question_id ASC,
                  option_order ASC,
                  id ASC
              `,

              args:
                questionIds,
            });

          optionRows =
            Array.isArray(
              optionResult.rows
            )
              ? optionResult.rows
              : [];
        }

        const optionsByQuestion =
          new Map();

        for (
          const option of
            optionRows
        ) {
          const questionId =
            Number(
              option.question_id
            );

          if (
            !optionsByQuestion.has(
              questionId
            )
          ) {
            optionsByQuestion.set(
              questionId,
              []
            );
          }

          optionsByQuestion
            .get(
              questionId
            )
            .push({
              id:
                Number(
                  option.id
                ),

              label:
                option.option_label,

              text:
                option.option_text,

              isCorrect:
                Number(
                  option.is_correct
                ) === 1,

              order:
                Number(
                  option.option_order
                ),
            });
        }

        /* ---------------------------------------------------
           RESPONSE
        --------------------------------------------------- */

        const questions =
          rows.map(
            (
              row,
              index
            ) => ({
              id:
                Number(
                  row.id
                ),

              testId:
                Number(
                  row.test_id
                ),

              sectionId:
                row.section_id ===
                  null ||
                row.section_id ===
                  undefined
                  ? null
                  : Number(
                      row.section_id
                    ),

              sectionName:
                row.section_name ||
                null,

              questionText:
                row.question_text ||
                "",

              questionImageUrl:
                row.question_image_url ||
                null,

              explanation:
                row.explanation ||
                "",

              questionType:
                String(
                  row.question_type ||
                    "mcq"
                )
                  .trim()
                  .toLowerCase(),

              marks:
                Number(
                  row.marks ||
                    0
                ),

              negativeMarks:
                Number(
                  row.negative_marks ||
                    0
                ),

              questionOrder:
                Number(
                  row.question_order ||
                    index + 1
                ),

              options:
                optionsByQuestion.get(
                  Number(
                    row.id
                  )
                ) || [],
            })
          );

        const sections =
          (
            await getSections({
              table:
                config.sectionTable,

              testId,
            })
          ).map(
            (
              row
            ) => ({
              id:
                Number(
                  row.id
                ),

              sectionName:
                row.section_name,

              sectionOrder:
                Number(
                  row.section_order
                ),

              durationMinutes:
                row.duration_minutes ===
                null
                  ? null
                  : Number(
                      row.duration_minutes
                    ),

              questionCount:
                Number(
                  row.question_count ||
                    0
                ),

              isSequential:
                Number(
                  row.is_sequential
                ) === 1,

              timerGroup:
                row.timer_group ||
                null,
            })
          );

        return adminSuccess({
          test: {
            id:
              Number(
                test.id
              ),

            title:
              test.title,

            storedQuestionCount:
              Number(
                test.total_questions ||
                  0
              ),

            storedMarks:
              Number(
                test.total_marks ||
                  0
              ),
          },

          questions,

          sections,

          counts: {
            questions:
              questions.length,

            options:
              optionRows.length,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET /api/admin/tests/[series]/[id]/questions]"
        );
      }
    },

    {
      logContext:
        "[GET /api/admin/tests/[series]/[id]/questions]",
    }
  );

/* =========================================================
   POST
   CREATE QUESTION
========================================================= */

export const POST =
  withAdminAction(
    ADMIN_ACTIONS.QUESTION_CREATE,

    async ({
      request,
      context,
    }) => {
      try {
        const {
          series:
            rawSeries,
          id:
            rawId,
        } =
          await context.params;

        const series =
          normalizeSeries(
            rawSeries
          );

        const testId =
          normalizeId(
            rawId
          );

        const config =
          SERIES_CONFIG[
            series
          ];

        if (!config) {
          return adminBadRequestResponse(
            "Invalid test series."
          );
        }

        if (!testId) {
          return adminBadRequestResponse(
            "Invalid test ID."
          );
        }

        const test =
          await getTest({
            table:
              config.testTable,

            testId,
          });

        if (!test) {
          return adminNotFoundResponse(
            "Test not found."
          );
        }

        const body =
          await request
            .json()
            .catch(
              () => null
            );

        if (!body) {
          return adminBadRequestResponse(
            "Invalid JSON request."
          );
        }

        /* ---------------------------------------------------
           QUESTION
        --------------------------------------------------- */

        const questionText =
          normalizeText(
            body.questionText
          );

        const questionImageUrl =
          normalizeImageUrl(
            body.questionImageUrl
          );

        const questionType =
          normalizeText(
            body.questionType ||
              "mcq"
          ).toLowerCase();

        const explanation =
          normalizeText(
            body.explanation
          );

        const marks =
          normalizeNumber(
            body.marks,
            0
          );

        const negativeMarks =
          normalizeNumber(
            body.negativeMarks,
            0
          );

        const sectionId =
          body.sectionId ===
              null ||
            body.sectionId ===
              "" ||
            body.sectionId ===
              undefined
            ? null
            : normalizeInteger(
                body.sectionId
              );

        const requestedOrder =
          body.questionOrder ===
              undefined ||
            body.questionOrder ===
              null ||
            body.questionOrder ===
              ""
            ? null
            : normalizeInteger(
                body.questionOrder
              );

        /* ---------------------------------------------------
           VALIDATE TYPE
        --------------------------------------------------- */

        if (
          !QUESTION_TYPES.has(
            questionType
          )
        ) {
          return adminBadRequestResponse(
            "Invalid question type."
          );
        }

        /* ---------------------------------------------------
           TEXT / IMAGE
        --------------------------------------------------- */

        if (
          !questionText &&
          !questionImageUrl
        ) {
          return adminBadRequestResponse(
            "Provide either question text or a question image."
          );
        }

        if (
          questionText.length >
          100000
        ) {
          return adminBadRequestResponse(
            "Question text is too large."
          );
        }

        if (
          explanation.length >
          100000
        ) {
          return adminBadRequestResponse(
            "Explanation is too large."
          );
        }

        if (
          !Number.isFinite(
            marks
          ) ||
          marks < 0
        ) {
          return adminBadRequestResponse(
            "Marks must be 0 or greater."
          );
        }

        if (
          !Number.isFinite(
            negativeMarks
          ) ||
          negativeMarks < 0
        ) {
          return adminBadRequestResponse(
            "Negative marks must be 0 or greater."
          );
        }

        /* ---------------------------------------------------
           SECTION VALIDATION
        --------------------------------------------------- */

        if (
          sectionId !== null
        ) {
          if (
            !Number.isInteger(
              sectionId
            ) ||
            sectionId <= 0
          ) {
            return adminBadRequestResponse(
              "Invalid section ID."
            );
          }

          const sectionResult =
            await db.execute({
              sql: `
                SELECT
                  id
                FROM ${config.sectionTable}
                WHERE
                  id = ?
                  AND test_id = ?
                LIMIT 1
              `,

              args: [
                sectionId,
                testId,
              ],
            });

          if (
            !sectionResult
              .rows?.length
          ) {
            return adminBadRequestResponse(
              "Selected section does not belong to this test."
            );
          }
        }

        /* ---------------------------------------------------
           OPTIONS
        --------------------------------------------------- */

        const options =
          normalizeOptions(
            body.options
          );

        const optionValidation =
          validateOptions({
            questionType,

            options,
          });

        if (
          !optionValidation.ok
        ) {
          return optionValidation.response;
        }

        /* ---------------------------------------------------
           QUESTION ORDER
        --------------------------------------------------- */

        let questionOrder =
          requestedOrder;

        if (
          questionOrder ===
            null ||
          !Number.isInteger(
            questionOrder
          ) ||
          questionOrder <=
            0
        ) {
          const maxResult =
            await db.execute({
              sql: `
                SELECT
                  COALESCE(
                    MAX(question_order),
                    0
                  ) + 1 AS next_order
                FROM ${config.questionTable}
                WHERE
                  test_id = ?
              `,

              args: [
                testId,
              ],
            });

          questionOrder =
            Number(
              maxResult
                .rows?.[0]
                ?.next_order ||
                1
            );
        }

        /* ---------------------------------------------------
           ORDER COLLISION
        --------------------------------------------------- */

        const orderExists =
          await db.execute({
            sql: `
              SELECT
                id
              FROM ${config.questionTable}

              WHERE
                test_id = ?
                AND question_order = ?

              LIMIT 1
            `,

            args: [
              testId,
              questionOrder,
            ],
          });

        if (
          orderExists.rows?.length
        ) {
          return adminConflictResponse(
            `Question order ${questionOrder} is already in use for this test.`
          );
        }

        /* ---------------------------------------------------
           INSERT
        --------------------------------------------------- */

        const questionResult =
          await db.execute({
            sql: `
              INSERT INTO ${config.questionTable} (
                test_id,
                section_id,
                question_text,
                explanation,
                question_type,
                marks,
                negative_marks,
                question_order,
                question_image_url,
                created_at,
                updated_at
              )

              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                ?,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )

              RETURNING
                id,
                test_id,
                section_id,
                question_text,
                explanation,
                question_type,
                marks,
                negative_marks,
                question_order,
                question_image_url,
                created_at,
                updated_at
            `,

            args: [
              testId,

              sectionId,

              questionText,

              explanation ||
                null,

              questionType,

              marks,

              negativeMarks,

              questionOrder,

              questionImageUrl,
            ],
          });

        const question =
          questionResult.rows?.[0];

        if (!question) {
          throw new Error(
            "Question insert returned no row."
          );
        }

        /* ---------------------------------------------------
           INSERT OPTIONS
        --------------------------------------------------- */

        for (
          let index = 0;
          index <
          options.length;
          index += 1
        ) {
          const option =
            options[index];

          await db.execute({
            sql: `
              INSERT INTO ${config.optionTable} (
                question_id,
                option_label,
                option_text,
                is_correct,
                option_order
              )

              VALUES (
                ?,
                ?,
                ?,
                ?,
                ?
              )
            `,

            args: [
              Number(
                question.id
              ),

              option.label,

              option.text,

              option.isCorrect
                ? 1
                : 0,

              index +
                1,
            ],
          });
        }

        /* ---------------------------------------------------
           UPDATE TEST COUNTS
        --------------------------------------------------- */

        await db.execute({
          sql: `
            UPDATE ${config.testTable}

            SET
              total_questions = (
                SELECT
                  COUNT(*)
                FROM ${config.questionTable}
                WHERE
                  test_id = ?
              ),

              total_marks = (
                SELECT
                  COALESCE(
                    SUM(marks),
                    0
                  )
                FROM ${config.questionTable}
                WHERE
                  test_id = ?
              ),

              updated_at =
                CURRENT_TIMESTAMP

            WHERE
              id = ?
          `,

          args: [
            testId,
            testId,
            testId,
          ],
        });

        return adminSuccess(
          {
            message:
              "Question created successfully.",

            question: {
              id:
                Number(
                  question.id
                ),

              testId,

              sectionId,

              questionText:
                question.question_text ||
                "",

              questionImageUrl:
                question.question_image_url ||
                null,

              explanation:
                question.explanation ||
                "",

              questionType:
                question.question_type,

              marks:
                Number(
                  question.marks
                ),

              negativeMarks:
                Number(
                  question.negative_marks
                ),

              questionOrder:
                Number(
                  question.question_order
                ),

              options:
                options.map(
                  (
                    option,
                    index
                  ) => ({
                    label:
                      option.label,

                    text:
                      option.text,

                    isCorrect:
                      option.isCorrect,

                    order:
                      index +
                      1,
                  })
                ),
            },

            cacheInvalidation: {
              type:
                "series",

              series,
            },
          },
          201
        );
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[POST /api/admin/tests/[series]/[id]/questions]"
        );
      }
    },

    {
      logContext:
        "[POST /api/admin/tests/[series]/[id]/questions]",
    }
  );