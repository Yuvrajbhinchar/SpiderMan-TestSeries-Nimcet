import { db, batchWrite } from "@/lib/turso";

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
  adminError,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   CONSTANTS
========================================================= */

const QUESTION_TYPES = new Set(["mcq", "msq", "numeric", "true_false"]);

const MAX_QUESTIONS_PER_REQUEST = 300;
const MAX_STATEMENTS_PER_CHUNK = 40; // batchWrite() caps at 50/statement; stay well under it.

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeImageUrl(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeInteger(value, fallback = null) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function normalizeNumber(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

// NOTE: the sibling single-question POST route (../route.js) had a
// pre-existing bug where it called an undefined `normalize()` helper
// for questionType, which threw on every request. This bulk route
// defines its own, correctly, so it isn't affected by that bug.
function normalizeQuestionType(value) {
  return String(value || "mcq").trim().toLowerCase();
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];

  return rawOptions.map((option, index) => ({
    label: normalizeText(
      firstDefined(
        option?.label,
        option?.optionLabel,
        option?.option_label,
        String.fromCharCode(65 + index)
      )
    ).toUpperCase(),

    text: normalizeText(
      firstDefined(option?.text, option?.optionText, option?.option_text, "")
    ),

    isCorrect: toBoolean(
      firstDefined(option?.isCorrect, option?.is_correct, 0)
    ),
  }));
}

function validateOptions({ questionType, options }) {
  if (questionType === "numeric") {
    return { ok: true, options: [] };
  }

  if (options.length < 2) {
    return { ok: false, reason: "at least 2 options are required" };
  }

  const seenLabels = new Set();

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index];
    const label = String(option.label || "").trim().toUpperCase();

    if (!label) {
      return { ok: false, reason: `option ${index + 1} needs a label` };
    }

    if (seenLabels.has(label)) {
      return { ok: false, reason: `duplicate option label "${label}"` };
    }

    seenLabels.add(label);

    if (!option.text) {
      return { ok: false, reason: `option ${label} needs option text` };
    }
  }

  const correctCount = options.filter((option) => option.isCorrect).length;

  if ((questionType === "mcq" || questionType === "true_false") && correctCount !== 1) {
    return {
      ok: false,
      reason: `${questionType} must have exactly one correct option`,
    };
  }

  if (questionType === "msq" && correctCount < 1) {
    return { ok: false, reason: "msq needs at least one correct option" };
  }

  return { ok: true, options };
}

function validateQuestionItem(raw, index) {
  const errors = [];

  const questionText = normalizeText(raw?.questionText);
  const questionImageUrl = normalizeImageUrl(raw?.questionImageUrl);
  const questionType = normalizeQuestionType(raw?.questionType);
  const explanation = normalizeText(raw?.explanation);
  const marks = normalizeNumber(raw?.marks, 0);
  const negativeMarks = normalizeNumber(raw?.negativeMarks, 0);

  const hasSectionId =
    raw?.sectionId !== undefined && raw?.sectionId !== null && raw?.sectionId !== "";
  const sectionId = hasSectionId ? normalizeInteger(raw.sectionId) : null;

  if (!QUESTION_TYPES.has(questionType)) {
    errors.push(`Row ${index + 1}: invalid question type "${raw?.questionType}".`);
  }

  if (!questionText && !questionImageUrl) {
    errors.push(`Row ${index + 1}: needs question text or a question image.`);
  }

  if (questionText.length > 100000) {
    errors.push(`Row ${index + 1}: question text is too large.`);
  }

  if (explanation.length > 100000) {
    errors.push(`Row ${index + 1}: explanation is too large.`);
  }

  if (!Number.isFinite(marks) || marks < 0) {
    errors.push(`Row ${index + 1}: marks must be 0 or greater.`);
  }

  if (!Number.isFinite(negativeMarks) || negativeMarks < 0) {
    errors.push(`Row ${index + 1}: negative marks must be 0 or greater.`);
  }

  if (hasSectionId && !sectionId) {
    errors.push(`Row ${index + 1}: invalid section ID.`);
  }

  const options = normalizeOptions(raw?.options);
  const optionValidation = validateOptions({ questionType, options });

  if (!optionValidation.ok) {
    errors.push(`Row ${index + 1}: ${optionValidation.reason}.`);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    item: {
      questionText,
      questionImageUrl,
      questionType,
      explanation,
      marks,
      negativeMarks,
      sectionId,
      options: optionValidation.options,
    },
  };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/* =========================================================
   POST
   /api/admin/tests/[series]/[id]/questions/bulk
   Body: { questions: [ { questionText, questionType?, marks,
           negativeMarks, sectionId?, explanation?,
           questionImageUrl?, options: [{label?, text, isCorrect}] } ] }
   ---------------------------------------------------------
   Every question is validated up front. If any row fails,
   nothing is written and every error is returned together.
   Inserts then run in db.batch() chunks (question insert +
   its option inserts together, addressed by the unique
   (test_id, question_order) pair so no round trip is needed
   between the question insert and its options).
========================================================= */

export const POST = withAdminAction(
  ADMIN_ACTIONS.QUESTION_CREATE,

  async ({ request, context }) => {
    const { series: rawSeries, id: rawId } = await context.params;
    const series = normalizeSeries(rawSeries);
    const testId = normalizeId(rawId);
    const config = SERIES_CONFIG[series];

    if (!config) return adminBadRequestResponse("Invalid test series.");
    if (!testId) return adminBadRequestResponse("Invalid test ID.");

    try {
      const testResult = await db.execute({
        sql: `SELECT id, title FROM ${config.testTable} WHERE id = ? LIMIT 1`,
        args: [testId],
      });

      const test = testResult.rows?.[0];
      if (!test) return adminNotFoundResponse("Test not found.");

      const body = await request.json().catch(() => null);
      if (!body) return adminBadRequestResponse("Invalid JSON request.");

      const rawQuestions = Array.isArray(body.questions) ? body.questions : null;

      if (!rawQuestions || rawQuestions.length === 0) {
        return adminBadRequestResponse('Provide a non-empty "questions" array.');
      }

      if (rawQuestions.length > MAX_QUESTIONS_PER_REQUEST) {
        return adminBadRequestResponse(
          `A single import is limited to ${MAX_QUESTIONS_PER_REQUEST} questions. Split into multiple requests.`
        );
      }

      /* -----------------------------------------------------
         VALIDATE EVERY ROW UP FRONT
      ----------------------------------------------------- */

      const errors = [];
      const validItems = [];

      rawQuestions.forEach((raw, index) => {
        const result = validateQuestionItem(raw, index);
        if (!result.ok) errors.push(...result.errors);
        else validItems.push(result.item);
      });

      if (errors.length > 0) {
        return adminBadRequestResponse(
          `${errors.length} row(s) failed validation. First issues: ${errors
            .slice(0, 8)
            .join(" | ")}${errors.length > 8 ? " …and more" : ""}`
        );
      }

      /* -----------------------------------------------------
         SECTION VALIDATION (one batched check, not per-row)
      ----------------------------------------------------- */

      const distinctSectionIds = [
        ...new Set(validItems.map((item) => item.sectionId).filter((id) => id !== null)),
      ];

      if (distinctSectionIds.length > 0) {
        const placeholders = distinctSectionIds.map(() => "?").join(", ");

        const sectionResult = await db.execute({
          sql: `SELECT id FROM ${config.sectionTable} WHERE test_id = ? AND id IN (${placeholders})`,
          args: [testId, ...distinctSectionIds],
        });

        const foundIds = new Set((sectionResult.rows || []).map((row) => Number(row.id)));
        const missing = distinctSectionIds.filter((id) => !foundIds.has(id));

        if (missing.length > 0) {
          return adminBadRequestResponse(
            `Section ID(s) ${missing.join(", ")} do not belong to this test.`
          );
        }
      }

      /* -----------------------------------------------------
         ASSIGN ORDER (bulk import always appends at the end,
         to avoid order-collision bookkeeping across rows)
      ----------------------------------------------------- */

      const startOrderResult = await db.execute({
        sql: `SELECT COALESCE(MAX(question_order), 0) AS max_order FROM ${config.questionTable} WHERE test_id = ?`,
        args: [testId],
      });

      let nextOrder = Number(startOrderResult.rows?.[0]?.max_order || 0) + 1;

      /* -----------------------------------------------------
         BUILD STATEMENTS
      ----------------------------------------------------- */

      const statements = [];

      for (const item of validItems) {
        const questionOrder = nextOrder;
        nextOrder += 1;

        statements.push({
          sql: `
            INSERT INTO ${config.questionTable} (
              test_id, section_id, question_text, explanation, question_type,
              marks, negative_marks, question_order, question_image_url,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          args: [
            testId,
            item.sectionId,
            item.questionText,
            item.explanation || null,
            item.questionType,
            item.marks,
            item.negativeMarks,
            questionOrder,
            item.questionImageUrl,
          ],
          __kind: "question",
        });

        item.options.forEach((option, optIndex) => {
          statements.push({
            sql: `
              INSERT INTO ${config.optionTable} (
                question_id, option_label, option_text, is_correct, option_order
              ) VALUES (
                (SELECT id FROM ${config.questionTable} WHERE test_id = ? AND question_order = ?),
                ?, ?, ?, ?
              )
            `,
            args: [testId, questionOrder, option.label, option.text, option.isCorrect ? 1 : 0, optIndex + 1],
            __kind: "option",
          });
        });
      }

      /* -----------------------------------------------------
         RUN IN CHUNKS
      ----------------------------------------------------- */

      const chunks = chunkArray(statements, MAX_STATEMENTS_PER_CHUNK);

      let insertedQuestions = 0;
      let insertedOptions = 0;
      let failedAtChunk = null;

      for (let c = 0; c < chunks.length; c += 1) {
        const chunk = chunks[c];

        try {
          // strip the internal __kind marker before sending to Turso
          await batchWrite(
            chunk.map(({ sql, args }) => ({ sql, args })),
            "write"
          );
        } catch (chunkError) {
          console.error(
            `[POST /api/admin/tests/[series]/[id]/questions/bulk] chunk ${c} failed:`,
            chunkError
          );
          failedAtChunk = c;
          break;
        }

        chunk.forEach((statement) => {
          if (statement.__kind === "question") insertedQuestions += 1;
          else insertedOptions += 1;
        });
      }

      /* -----------------------------------------------------
         RECOMPUTE TEST TOTALS
         (best-effort even on a partial failure, so counts
         always reflect what's actually in the DB)
      ----------------------------------------------------- */

      await db.execute({
        sql: `
          UPDATE ${config.testTable}
          SET
            total_questions = (SELECT COUNT(*) FROM ${config.questionTable} WHERE test_id = ?),
            total_marks = (SELECT COALESCE(SUM(marks), 0) FROM ${config.questionTable} WHERE test_id = ?),
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [testId, testId, testId],
      });

      if (failedAtChunk !== null) {
        return adminError(
          `Import stopped partway through: ${insertedQuestions} of ${validItems.length} question(s) were saved before a database error occurred. The saved ones are kept — re-run the import with only the remaining rows.`,
          500,
          "PARTIAL_BULK_IMPORT_FAILURE"
        );
      }

      return adminSuccess(
        {
          message: `${insertedQuestions} question(s) imported successfully.`,
          series,
          testId,
          testTitle: test.title,
          insertedQuestions,
          insertedOptions,
          nextQuestionOrder: nextOrder,
          cacheInvalidation: { type: "series", series },
        },
        201
      );
    } catch (error) {
      return adminInternalError(
        error,
        "[POST /api/admin/tests/[series]/[id]/questions/bulk]"
      );
    }
  },

  { logContext: "[POST /api/admin/tests/[series]/[id]/questions/bulk]" }
);