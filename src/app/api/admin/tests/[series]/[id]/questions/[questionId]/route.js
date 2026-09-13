import {
  db,
} from "@/lib/turso";

import {
  SERIES_CONFIG,
  normalizeSeries,
  normalizeId,
  firstDefined,
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

function text(
  value
) {
  return String(
    value ?? ""
  ).trim();
}

function nullableText(
  value
) {
  const valueText =
    text(value);

  return valueText ||
    null;
}

function number(
  value,
  fallback = null
) {
  const result =
    Number(value);

  return Number.isFinite(
    result
  )
    ? result
    : fallback;
}

function integer(
  value,
  fallback = null
) {
  const result =
    Number(value);

  return Number.isInteger(
    result
  )
    ? result
    : fallback;
}

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
        integer(
          option?.id
        ),

      label:
        text(
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
        text(
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
        integer(
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

function validateOptions({
  questionType,
  options,
}) {
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
          "At least 2 options are required."
        ),
    };
  }

  const labels =
    new Set();

  for (
    const option of
      options
  ) {
    if (
      !option.label
    ) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            "Every option needs a label."
          ),
      };
    }

    if (
      !option.text
    ) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            `Option ${option.label} needs option text.`
          ),
      };
    }

    if (
      labels.has(
        option.label
      )
    ) {
      return {
        ok: false,

        response:
          adminConflictResponse(
            `Duplicate option label "${option.label}".`
          ),
      };
    }

    labels.add(
      option.label
    );
  }

  const correct =
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
      correct !==
      1
    ) {
      return {
        ok: false,

        response:
          adminBadRequestResponse(
            "This question type needs exactly one correct option."
          ),
      };
    }
  }

  if (
    questionType ===
      "msq" &&
    correct <
      1
  ) {
    return {
      ok: false,

      response:
        adminBadRequestResponse(
          "MSQ needs at least one correct option."
        ),
    };
  }

  return {
    ok: true,
    options,
  };
}

/* =========================================================
   GET QUESTION
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
          questionId:
            rawQuestionId,
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

        const questionId =
          normalizeId(
            rawQuestionId
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

        if (!questionId) {
          return adminBadRequestResponse(
            "Invalid question ID."
          );
        }

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
                q.id = ?
                AND q.test_id = ?

              LIMIT 1
            `,

            args: [
              questionId,
              testId,
            ],
          });

        const question =
          questionResult.rows?.[0];

        if (!question) {
          return adminNotFoundResponse(
            "Question not found."
          );
        }

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
                question_id = ?

              ORDER BY
                option_order ASC,
                id ASC
            `,

            args: [
              questionId,
            ],
          });

        const options =
          (
            optionResult.rows ||
            []
          ).map(
            (
              option
            ) => ({
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
            })
          );

        return adminSuccess({
          question: {
            id:
              Number(
                question.id
              ),

            testId:
              Number(
                question.test_id
              ),

            sectionId:
              question.section_id ===
                null
                ? null
                : Number(
                    question.section_id
                  ),

            sectionName:
              question.section_name ||
              null,

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
              String(
                question.question_type ||
                  "mcq"
              )
                .trim()
                .toLowerCase(),

            marks:
              Number(
                question.marks ||
                  0
              ),

            negativeMarks:
              Number(
                question.negative_marks ||
                  0
              ),

            questionOrder:
              Number(
                question.question_order
              ),

            options,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[GET question]"
        );
      }
    },

    {
      logContext:
        "[GET question]",
    }
  );

/* =========================================================
   PATCH QUESTION
========================================================= */

export const PATCH =
  withAdminAction(
    ADMIN_ACTIONS.QUESTION_UPDATE,

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
          questionId:
            rawQuestionId,
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

        const questionId =
          normalizeId(
            rawQuestionId
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

        if (!questionId) {
          return adminBadRequestResponse(
            "Invalid question ID."
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
           EXISTING
        --------------------------------------------------- */

        const existingResult =
          await db.execute({
            sql: `
              SELECT *
              FROM ${config.questionTable}

              WHERE
                id = ?
                AND test_id = ?

              LIMIT 1
            `,

            args: [
              questionId,
              testId,
            ],
          });

        const existing =
          existingResult.rows?.[0];

        if (!existing) {
          return adminNotFoundResponse(
            "Question not found."
          );
        }

        /* ---------------------------------------------------
           VALUES
        --------------------------------------------------- */

        const questionText =
          body.questionText !==
          undefined
            ? text(
                body.questionText
              )
            : existing.question_text ||
              "";

        const questionImageUrl =
          body.questionImageUrl !==
          undefined
            ? nullableText(
                body.questionImageUrl
              )
            : existing.question_image_url ||
              null;

        const explanation =
          body.explanation !==
          undefined
            ? nullableText(
                body.explanation
              )
            : existing.explanation ||
              null;

        const questionType =
          body.questionType !==
          undefined
            ? text(
                body.questionType
              ).toLowerCase()
            : String(
                existing.question_type ||
                  "mcq"
              )
                .trim()
                .toLowerCase();

        const marks =
          body.marks !==
          undefined
            ? number(
                body.marks
              )
            : Number(
                existing.marks ||
                  0
              );

        const negativeMarks =
          body.negativeMarks !==
          undefined
            ? number(
                body.negativeMarks
              )
            : Number(
                existing.negative_marks ||
                  0
              );

        const sectionId =
          body.sectionId !==
          undefined
            ? (
                body.sectionId ===
                  null ||
                body.sectionId ===
                  ""
              )
              ? null
              : integer(
                  body.sectionId
                )
            : existing.section_id ===
                null
              ? null
              : Number(
                  existing.section_id
                );

        const questionOrder =
          body.questionOrder !==
          undefined
            ? integer(
                body.questionOrder
              )
            : Number(
                existing.question_order
              );

        /* ---------------------------------------------------
           VALIDATION
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

        if (
          !questionText &&
          !questionImageUrl
        ) {
          return adminBadRequestResponse(
            "Provide either question text or a question image."
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

        if (
          !Number.isInteger(
            questionOrder
          ) ||
          questionOrder <=
            0
        ) {
          return adminBadRequestResponse(
            "Question order must be a positive integer."
          );
        }

        /* ---------------------------------------------------
           SECTION
        --------------------------------------------------- */

        if (
          sectionId !== null
        ) {
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
            !sectionResult.rows?.length
          ) {
            return adminBadRequestResponse(
              "Selected section does not belong to this test."
            );
          }
        }

        /* ---------------------------------------------------
           OPTIONS
        --------------------------------------------------- */

        let options;

        if (
          body.options !==
          undefined
        ) {
          options =
            normalizeOptions(
              body.options
            );

          const validation =
            validateOptions({
              questionType,

              options,
            });

          if (
            !validation.ok
          ) {
            return validation.response;
          }

          options =
            validation.options;
        } else {
          const existingOptions =
            await db.execute({
              sql: `
                SELECT
                  id,
                  option_label,
                  option_text,
                  is_correct,
                  option_order

                FROM ${config.optionTable}

                WHERE
                  question_id = ?

                ORDER BY
                  option_order ASC,
                  id ASC
              `,

              args: [
                questionId,
              ],
            });

          options =
            (
              existingOptions.rows ||
              []
            ).map(
              (
                option,
                index
              ) => ({
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
                    option.option_order ||
                      index + 1
                  ),
              })
            );
        }

        /* ---------------------------------------------------
           ORDER COLLISION
        --------------------------------------------------- */

        const orderResult =
          await db.execute({
            sql: `
              SELECT
                id

              FROM ${config.questionTable}

              WHERE
                test_id = ?
                AND question_order = ?
                AND id != ?

              LIMIT 1
            `,

            args: [
              testId,
              questionOrder,
              questionId,
            ],
          });

        if (
          orderResult.rows?.length
        ) {
          return adminConflictResponse(
            `Question order ${questionOrder} is already used by another question.`
          );
        }

        /* ---------------------------------------------------
           UPDATE QUESTION
        --------------------------------------------------- */

        const result =
          await db.execute({
            sql: `
              UPDATE ${config.questionTable}

              SET
                section_id = ?,

                question_text = ?,

                question_image_url = ?,

                explanation = ?,

                question_type = ?,

                marks = ?,

                negative_marks = ?,

                question_order = ?,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                id = ?
                AND test_id = ?

              RETURNING
                id,
                test_id,
                section_id,
                question_text,
                question_image_url,
                explanation,
                question_type,
                marks,
                negative_marks,
                question_order,
                updated_at
            `,

            args: [
              sectionId,

              questionText,

              questionImageUrl,

              explanation,

              questionType,

              marks,

              negativeMarks,

              questionOrder,

              questionId,

              testId,
            ],
          });

        const updated =
          result.rows?.[0];

        if (!updated) {
          return adminNotFoundResponse(
            "Question could not be updated."
          );
        }

        /* ---------------------------------------------------
           REPLACE OPTIONS
        --------------------------------------------------- */

        if (
          body.options !==
          undefined
        ) {
          await db.execute({
            sql: `
              DELETE FROM ${config.optionTable}

              WHERE
                question_id = ?
            `,

            args: [
              questionId,
            ],
          });

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
                questionId,

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
        }

        /* ---------------------------------------------------
           RECALCULATE TEST TOTALS
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

        return adminSuccess({
          message:
            "Question updated successfully.",

          question: {
            id:
              Number(
                updated.id
              ),

            testId:
              Number(
                updated.test_id
              ),

            sectionId:
              updated.section_id ===
                null
                ? null
                : Number(
                    updated.section_id
                  ),

            questionText:
              updated.question_text ||
              "",

            questionImageUrl:
              updated.question_image_url ||
              null,

            explanation:
              updated.explanation ||
              "",

            questionType:
              updated.question_type,

            marks:
              Number(
                updated.marks
              ),

            negativeMarks:
              Number(
                updated.negative_marks
              ),

            questionOrder:
              Number(
                updated.question_order
              ),

            options,
          },

          cacheInvalidation: {
            type:
              "series",

            series,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[PATCH question]"
        );
      }
    },

    {
      logContext:
        "[PATCH question]",
    }
  );

/* =========================================================
   DELETE QUESTION
========================================================= */

export const DELETE =
  withAdminAction(
    ADMIN_ACTIONS.QUESTION_DELETE,

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
          questionId:
            rawQuestionId,
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

        const questionId =
          normalizeId(
            rawQuestionId
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

        if (!questionId) {
          return adminBadRequestResponse(
            "Invalid question ID."
          );
        }

        const body =
          await request
            .json()
            .catch(
              () => ({})
            );

        if (
          body?.confirm !==
          true
        ) {
          return adminBadRequestResponse(
            "Delete confirmation is required."
          );
        }

        /* ---------------------------------------------------
           CHECK QUESTION
        --------------------------------------------------- */

        const questionResult =
          await db.execute({
            sql: `
              SELECT
                id,
                question_text,
                question_image_url
              FROM ${config.questionTable}

              WHERE
                id = ?
                AND test_id = ?

              LIMIT 1
            `,

            args: [
              questionId,
              testId,
            ],
          });

        const question =
          questionResult.rows?.[0];

        if (!question) {
          return adminNotFoundResponse(
            "Question not found."
          );
        }

        /* ---------------------------------------------------
           CHECK ATTEMPT ANSWERS
           
           Because deleting a question that has already been
           used in an attempt can destroy historical answer
           context, block permanent deletion.
        --------------------------------------------------- */

        const answerResult =
          await db.execute({
            sql: `
              SELECT
                COUNT(*) AS count

              FROM ${config.answerTable} aa

              WHERE
                aa.question_id = ?
            `,

            args: [
              questionId,
            ],
          });

        const answerCount =
          Number(
            answerResult
              .rows?.[0]
              ?.count || 0
          );

        if (
          answerCount >
          0
        ) {
          return adminConflictResponse(
            `This question cannot be deleted because it has ${answerCount} historical answer record${
              answerCount ===
              1
                ? ""
                : "s"
            }.`
          );
        }

        /* ---------------------------------------------------
           DELETE
        --------------------------------------------------- */

        const deleteResult =
          await db.execute({
            sql: `
              DELETE FROM ${config.questionTable}

              WHERE
                id = ?
                AND test_id = ?
                AND NOT EXISTS (
                  SELECT
                    1
                  FROM ${config.answerTable} aa
                  WHERE
                    aa.question_id = ?
                )
            `,

            args: [
              questionId,
              testId,
              questionId,
            ],
          });

        const affected =
          Number(
            deleteResult.rowsAffected ||
              0
          );

        if (
          affected !== 1
        ) {
          return adminConflictResponse(
            "Question could not be deleted because it now has dependent records."
          );
        }

        /* ---------------------------------------------------
           RECALCULATE TEST TOTALS
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

        return adminSuccess({
          message:
            "Question deleted successfully.",

          deleted: true,

          question: {
            id:
              questionId,

            testId,

            series,
          },

          cacheInvalidation: {
            type:
              "series",

            series,
          },
        });
      } catch (
        error
      ) {
        return adminInternalError(
          error,
          "[DELETE question]"
        );
      }
    },

    {
      logContext:
        "[DELETE question]",
    }
  );