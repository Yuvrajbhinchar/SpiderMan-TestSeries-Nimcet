import { db } from "@/lib/turso";

import {
  ADMIN_ACTIONS,
  adminBadRequestResponse,
  adminConflictResponse,
  adminInternalError,
  adminNotFoundResponse,
  adminSuccess,
} from "@/lib/adminSecurity";

import { withAdminAction } from "@/lib/adminApi";

/* =========================================================
   SERIES CONFIG
========================================================= */

const SERIES_CONFIG = Object.freeze({
  free: {
    id: 1,
    name: "Free",
    testTable: "free_tests",
    eventsTable: "free_test_events",
    attemptsTable: "free_test_attempts",
  },
  asspire: {
    id: 2,
    name: "Asspire",
    testTable: "asspire_tests",
    eventsTable: "asspire_test_events",
    attemptsTable: "asspire_test_attempts",
  },
  imppetus: {
    id: 3,
    name: "Imppetus",
    testTable: "imppetus_tests",
    eventsTable: "imppetus_test_events",
    attemptsTable: "imppetus_test_attempts",
  },
  spiderman: {
    id: 4,
    name: "SpiderMan",
    testTable: "spiderman_tests",
    eventsTable: "spiderman_test_events",
    attemptsTable: "spiderman_test_attempts",
  },
});

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function toIsoDate(value) {
  if (!value) return null;
  const date = new Date(String(value).trim());
  return Number.isNaN(date.getTime()) ? null : date;
}

function parsePositiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

async function getEvent({ eventsTable, testTable, id }) {
  const result = await db.execute({
    sql: `
      SELECT
        e.id, e.test_id, e.event_name, e.start_at, e.start_window_end,
        e.duration_minutes, e.auto_submit, e.is_published,
        e.created_at, e.updated_at,
        t.title AS test_title, t.slug AS test_slug
      FROM ${eventsTable} e
      INNER JOIN ${testTable} t ON t.id = e.test_id
      WHERE e.id = ?
      LIMIT 1
    `,
    args: [id],
  });

  return result.rows?.[0] || null;
}

function mapEvent(row, { series, seriesId }) {
  return {
    id: Number(row.id),
    series,
    seriesId,
    testId: Number(row.test_id),
    testTitle: row.test_title,
    testSlug: row.test_slug,
    eventName: row.event_name || null,
    startAt: row.start_at,
    startWindowEnd: row.start_window_end,
    durationMinutes: Number(row.duration_minutes),
    autoSubmit: Number(row.auto_submit) === 1,
    isPublished: Number(row.is_published) === 1,
    createdAt: row.created_at || null,
    updatedAt: row.updated_at || null,
  };
}

/* =========================================================
   GET
   /api/admin/events/[series]/[id]
========================================================= */

export const GET = withAdminAction(
  ADMIN_ACTIONS.EVENT_READ,

  async ({ context }) => {
    const { series: rawSeries, id: rawId } = await context.params;
    const series = normalize(rawSeries);
    const eventId = normalizeId(rawId);
    const config = SERIES_CONFIG[series];

    if (!config) return adminBadRequestResponse("Invalid test series.");
    if (!eventId) return adminBadRequestResponse("Invalid event ID.");

    try {
      const event = await getEvent({
        eventsTable: config.eventsTable,
        testTable: config.testTable,
        id: eventId,
      });

      if (!event) return adminNotFoundResponse("Event not found.");

      return adminSuccess({
        event: mapEvent(event, { series, seriesId: config.id }),
      });
    } catch (error) {
      return adminInternalError(
        error,
        "[GET /api/admin/events/[series]/[id]]"
      );
    }
  },

  { logContext: "[GET /api/admin/events/[series]/[id]]" }
);

/* =========================================================
   PATCH
   /api/admin/events/[series]/[id]
   Body: { eventName?, startAt?, startWindowEnd?, durationMinutes?, autoSubmit? }
   Only provided fields are updated. Schedule fields (startAt,
   startWindowEnd, durationMinutes) are locked once any attempt
   exists against the event, to protect attempt/report integrity.
========================================================= */

export const PATCH = withAdminAction(
  ADMIN_ACTIONS.EVENT_UPDATE,

  async ({ request, context, userId }) => {
    const { series: rawSeries, id: rawId } = await context.params;
    const series = normalize(rawSeries);
    const eventId = normalizeId(rawId);
    const config = SERIES_CONFIG[series];

    if (!config) return adminBadRequestResponse("Invalid test series.");
    if (!eventId) return adminBadRequestResponse("Invalid event ID.");

    const body = await request.json().catch(() => null);
    if (!body) return adminBadRequestResponse("Invalid JSON request.");

    try {
      const existing = await getEvent({
        eventsTable: config.eventsTable,
        testTable: config.testTable,
        id: eventId,
      });

      if (!existing) return adminNotFoundResponse("Event not found.");

      const touchesSchedule =
        body.startAt !== undefined ||
        body.startWindowEnd !== undefined ||
        body.durationMinutes !== undefined;

      if (touchesSchedule) {
        const attemptResult = await db.execute({
          sql: `SELECT COUNT(*) AS count FROM ${config.attemptsTable} WHERE event_id = ?`,
          args: [eventId],
        });

        const attemptCount = Number(attemptResult.rows?.[0]?.count || 0);

        if (attemptCount > 0) {
          return adminConflictResponse(
            `This event's schedule cannot be changed because it already has ${attemptCount} attempt${
              attemptCount === 1 ? "" : "s"
            }. Only the event name can still be edited.`
          );
        }
      }

      const nextStartAt =
        body.startAt !== undefined
          ? toIsoDate(body.startAt)
          : new Date(existing.start_at);

      const nextStartWindowEnd =
        body.startWindowEnd !== undefined
          ? toIsoDate(body.startWindowEnd)
          : new Date(existing.start_window_end);

      if (body.startAt !== undefined && !nextStartAt) {
        return adminBadRequestResponse("Invalid startAt date/time.");
      }

      if (body.startWindowEnd !== undefined && !nextStartWindowEnd) {
        return adminBadRequestResponse("Invalid startWindowEnd date/time.");
      }

      if (nextStartWindowEnd.getTime() <= nextStartAt.getTime()) {
        return adminBadRequestResponse(
          "startWindowEnd must be later than startAt."
        );
      }

      let nextDuration = Number(existing.duration_minutes);

      if (body.durationMinutes !== undefined) {
        const parsed = parsePositiveInt(body.durationMinutes);
        if (!parsed) {
          return adminBadRequestResponse(
            "durationMinutes must be a positive integer."
          );
        }
        nextDuration = parsed;
      }

      const nextEventName =
        body.eventName !== undefined
          ? normalizeText(body.eventName)
          : existing.event_name;

      const nextAutoSubmit =
        body.autoSubmit !== undefined
          ? body.autoSubmit === true
            ? 1
            : 0
          : Number(existing.auto_submit);

      const result = await db.execute({
        sql: `
          UPDATE ${config.eventsTable}
          SET event_name = ?, start_at = ?, start_window_end = ?,
              duration_minutes = ?, auto_submit = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
          RETURNING
            id, test_id, event_name, start_at, start_window_end,
            duration_minutes, auto_submit, is_published,
            created_at, updated_at
        `,
        args: [
          nextEventName,
          nextStartAt.toISOString(),
          nextStartWindowEnd.toISOString(),
          nextDuration,
          nextAutoSubmit,
          eventId,
        ],
      });

      const updated = result.rows?.[0];

      if (!updated) return adminNotFoundResponse("Event could not be updated.");

      return adminSuccess({
        message: "Event updated successfully.",
        changedBy: Number(userId),
        event: mapEvent(
          { ...updated, test_title: existing.test_title, test_slug: existing.test_slug },
          { series, seriesId: config.id }
        ),
      });
    } catch (error) {
      return adminInternalError(
        error,
        "[PATCH /api/admin/events/[series]/[id]]"
      );
    }
  },

  { logContext: "[PATCH /api/admin/events/[series]/[id]]" }
);

/* =========================================================
   DELETE
   /api/admin/events/[series]/[id]
   Body: { confirm: true }
   Blocked if any attempt already references this event.
========================================================= */

export const DELETE = withAdminAction(
  ADMIN_ACTIONS.EVENT_DELETE,

  async ({ request, context, userId }) => {
    const { series: rawSeries, id: rawId } = await context.params;
    const series = normalize(rawSeries);
    const eventId = normalizeId(rawId);
    const config = SERIES_CONFIG[series];

    if (!config) return adminBadRequestResponse("Invalid test series.");
    if (!eventId) return adminBadRequestResponse("Invalid event ID.");

    const body = await request.json().catch(() => ({}));

    if (body?.confirm !== true) {
      return adminBadRequestResponse("Delete confirmation is required.");
    }

    try {
      const existing = await getEvent({
        eventsTable: config.eventsTable,
        testTable: config.testTable,
        id: eventId,
      });

      if (!existing) return adminNotFoundResponse("Event not found.");

      const attemptResult = await db.execute({
        sql: `SELECT COUNT(*) AS count FROM ${config.attemptsTable} WHERE event_id = ?`,
        args: [eventId],
      });

      const attemptCount = Number(attemptResult.rows?.[0]?.count || 0);

      if (attemptCount > 0) {
        return adminConflictResponse(
          `This event cannot be deleted because it has ${attemptCount} existing attempt${
            attemptCount === 1 ? "" : "s"
          }. Unpublish it instead.`
        );
      }

      const deleteResult = await db.execute({
        sql: `
          DELETE FROM ${config.eventsTable}
          WHERE id = ?
            AND NOT EXISTS (
              SELECT 1 FROM ${config.attemptsTable} a WHERE a.event_id = ?
            )
        `,
        args: [eventId, eventId],
      });

      if (Number(deleteResult.rowsAffected || 0) !== 1) {
        return adminConflictResponse(
          "The event now has attempts and cannot be deleted."
        );
      }

      return adminSuccess({
        message: "Event deleted successfully.",
        deleted: true,
        deletedBy: Number(userId),
        event: {
          id: eventId,
          series,
          seriesId: config.id,
          testTitle: existing.test_title,
        },
      });
    } catch (error) {
      return adminInternalError(
        error,
        "[DELETE /api/admin/events/[series]/[id]]"
      );
    }
  },

  { logContext: "[DELETE /api/admin/events/[series]/[id]]" }
);