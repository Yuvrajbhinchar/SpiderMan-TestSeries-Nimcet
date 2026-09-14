import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG = Object.freeze({
  free: { id: 1, name: "Free", eventsTable: "free_test_events" },
  asspire: { id: 2, name: "Asspire", eventsTable: "asspire_test_events" },
  imppetus: { id: 3, name: "Imppetus", eventsTable: "imppetus_test_events" },
  spiderman: {
    id: 4,
    name: "SpiderMan",
    eventsTable: "spiderman_test_events",
  },
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function getAction(value) {
  const action = normalize(value);
  return ["publish", "unpublish"].includes(action) ? action : null;
}

/* =========================================================
   POST
   /api/admin/events/[series]/[id]/status
   Body: { action: "publish" | "unpublish" }
========================================================= */

async function handler({ request, context, userId }) {
  const { series: rawSeries, id: rawId } = await context.params;
  const series = normalize(rawSeries);
  const eventId = normalizeId(rawId);
  const config = SERIES_CONFIG[series];

  if (!config) return adminBadRequestResponse("Invalid test series.");
  if (!eventId) return adminBadRequestResponse("Invalid event ID.");

  const body = await request.json().catch(() => null);
  const action = getAction(body?.action);

  if (!action) {
    return adminBadRequestResponse(
      "action must be either \"publish\" or \"unpublish\"."
    );
  }

  const nextPublished = action === "publish" ? 1 : 0;

  try {
    const existingResult = await db.execute({
      sql: `
        SELECT id, event_name, start_at, start_window_end, is_published
        FROM ${config.eventsTable}
        WHERE id = ?
        LIMIT 1
      `,
      args: [eventId],
    });

    const existing = existingResult.rows?.[0];

    if (!existing) return adminNotFoundResponse("Event not found.");

    const currentPublished = Number(existing.is_published) === 1;

    if (currentPublished === Boolean(nextPublished)) {
      return adminSuccess({
        message: "Event status is already up to date.",
        changed: false,
        event: {
          id: Number(existing.id),
          isPublished: currentPublished,
        },
      });
    }

    const result = await db.execute({
      sql: `
        UPDATE ${config.eventsTable}
        SET is_published = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        RETURNING id, event_name, start_at, start_window_end, is_published, updated_at
      `,
      args: [nextPublished, eventId],
    });

    const updated = result.rows?.[0];

    if (!updated) return adminNotFoundResponse("Event could not be updated.");

    return adminSuccess({
      message:
        action === "publish"
          ? "Event published. It is now visible to registered students."
          : "Event unpublished. Students can no longer see or join it.",
      changed: true,
      changedBy: Number(userId),
      event: {
        id: Number(updated.id),
        series,
        seriesId: config.id,
        eventName: updated.event_name || null,
        startAt: updated.start_at,
        startWindowEnd: updated.start_window_end,
        isPublished: Number(updated.is_published) === 1,
        updatedAt: updated.updated_at,
      },
    });
  } catch (error) {
    return adminInternalError(
      error,
      "[POST /api/admin/events/[series]/[id]/status]"
    );
  }
}

export async function POST(request, context) {
  const body = await request.clone().json().catch(() => null);

  const action =
    body?.action === "publish"
      ? ADMIN_ACTIONS.EVENT_PUBLISH
      : ADMIN_ACTIONS.EVENT_UNPUBLISH;

  return withAdminAction(action, handler, {
    logContext: "[POST /api/admin/events/[series]/[id]/status]",
  })(request, context);
}