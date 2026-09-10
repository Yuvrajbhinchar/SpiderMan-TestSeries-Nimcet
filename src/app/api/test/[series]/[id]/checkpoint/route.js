import { NextResponse } from "next/server";
import { db } from "@/lib/turso";
import { getAccessibleTest, requireRuntimeUser } from "@/lib/testRuntime";

function normalizeAnswers(input) {
  const map = new Map();

  for (const item of Array.isArray(input) ? input : []) {
    if (!item || typeof item !== "object") continue;

    const questionId = Number(item.questionId);
    if (!Number.isInteger(questionId) || questionId <= 0) continue;

    let selectedOptionId = null;
    if (
      item.selectedOptionId !== null &&
      item.selectedOptionId !== undefined &&
      item.selectedOptionId !== ""
    ) {
      const parsed = Number(item.selectedOptionId);
      if (Number.isInteger(parsed) && parsed > 0) {
        selectedOptionId = parsed;
      }
    }

    const rawTime = Number(item.timeSpentSeconds || 0);
    const timeSpentSeconds =
      Number.isFinite(rawTime) && rawTime >= 0
        ? Math.floor(rawTime)
        : 0;

    map.set(questionId, {
      selectedOptionId,
      timeSpentSeconds,
      visited: item.visited ? 1 : 0,
      markedForReview: item.markedForReview ? 1 : 0,
    });
  }

  return Array.from(map.entries());
}

export async function POST(request, { params }) {
  try {
    const { series, id } = await params;

    const auth = await requireRuntimeUser();
    if (!auth.ok) {
      return NextResponse.json(
        { error: auth.error, ...(auth.code ? { code: auth.code } : {}) },
        { status: auth.status }
      );
    }

    const access = await getAccessibleTest(series, id, auth.userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { config, test } = access;
    const body = await request.json().catch(() => ({}));
    const attemptId = Number(body?.attemptId || 0);
    const answers = normalizeAnswers(body?.answers);

    if (!Number.isInteger(attemptId) || attemptId <= 0) {
      return NextResponse.json({ error: "Valid attempt id is required." }, { status: 400 });
    }

    if (answers.length === 0) {
      return NextResponse.json({ success: true, saved: 0 });
    }

    if (answers.length > 200) {
      return NextResponse.json({ error: "Too many answers in one checkpoint." }, { status: 400 });
    }

    const attemptResult = await db.execute({
      sql: `
        SELECT id, status, started_at, deadline_at
        FROM ${config.attempts}
        WHERE id = ? AND user_id = ? AND test_id = ?
        LIMIT 1
      `,
      args: [attemptId, auth.userId, test.id],
    });

    const attempt = attemptResult.rows?.[0];
    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (String(attempt.status) !== "in_progress") {
      return NextResponse.json({ error: "Attempt is no longer active." }, { status: 409 });
    }

    if (
      attempt.deadline_at &&
      new Date(`${String(attempt.deadline_at).replace(" ", "T")}Z`).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        { error: "Attempt time has expired.", code: "ATTEMPT_EXPIRED" },
        { status: 410 }
      );
    }

    const statements = answers.map(([questionId, answer]) => ({
      sql: `
        INSERT INTO ${config.answers} (
          attempt_id,
          question_id,
          selected_option_id,
          is_correct,
          marks_obtained,
          time_spent_seconds,
          answered_at,
          visited,
          marked_for_review
        )
        SELECT
          ?,
          q.id,
          ?,
          NULL,
          0,
          ?,
          CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END,
          ?,
          ?
        FROM ${config.questions} q
        WHERE
          q.id = ?
          AND q.test_id = ?
          AND (
            ? IS NULL
            OR EXISTS (
              SELECT 1
              FROM ${config.options} qo
              WHERE qo.id = ?
                AND qo.question_id = q.id
            )
          )
        ON CONFLICT(attempt_id, question_id)
        DO UPDATE SET
          selected_option_id = excluded.selected_option_id,
          time_spent_seconds = excluded.time_spent_seconds,
          answered_at = excluded.answered_at,
          visited = excluded.visited,
          marked_for_review = excluded.marked_for_review
      `,
      args: [
        attemptId,
        answer.selectedOptionId,
        answer.timeSpentSeconds,
        answer.selectedOptionId,
        answer.visited,
        answer.markedForReview,
        questionId,
        test.id,
        answer.selectedOptionId,
        answer.selectedOptionId,
      ],
    }));

    await db.batch(statements, "write");

    return NextResponse.json({
      success: true,
      saved: answers.length,
    });
  } catch (error) {
    console.error("Checkpoint error:", error);
    return NextResponse.json(
      { error: "Unable to save attempt progress." },
      { status: 500 }
    );
  }
}
