/* =========================================================
   PAID SERIES CONFIG (shared)
========================================================= */

export const PAID_SERIES = new Map([
  [2, { id: 2, slug: "asspire", name: "Asspire" }],
  [3, { id: 3, slug: "imppetus", name: "Imppetus" }],
  [4, { id: 4, slug: "spiderman", name: "SpiderMan" }],
]);

export function isValidPaidSeriesId(seriesId) {
  return PAID_SERIES.has(Number(seriesId));
}

export function getPaidSeries(seriesId) {
  return PAID_SERIES.get(Number(seriesId)) || null;
}

/* =========================================================
   EXPIRY PARSING
   Returns:
     { valid: true,  value: isoString|null }
     { valid: false }
========================================================= */

export function parseExpiry(value) {
  if (value === null || value === undefined || value === "") {
    return { valid: true, value: null };
  }

  const date = new Date(String(value).trim());

  if (Number.isNaN(date.getTime())) {
    return { valid: false };
  }

  if (date.getTime() <= Date.now()) {
    return { valid: false };
  }

  return { valid: true, value: date.toISOString() };
}

/* =========================================================
   ID LIST HELPERS
   Used by bulk routes to sanitize incoming userId arrays.
========================================================= */

export const MAX_BULK_IDS = 200;

export function normalizeIdList(rawList, { excludeId = null } = {}) {
  if (!Array.isArray(rawList)) {
    return { ok: false, reason: "userIds must be an array." };
  }

  const seen = new Set();
  const ids = [];

  for (const raw of rawList) {
    const id = Number(raw);

    if (!Number.isInteger(id) || id <= 0) {
      continue;
    }

    if (excludeId !== null && id === Number(excludeId)) {
      continue;
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    ids.push(id);
  }

  if (ids.length === 0) {
    return { ok: false, reason: "No valid user IDs provided." };
  }

  if (ids.length > MAX_BULK_IDS) {
    return {
      ok: false,
      reason: `A maximum of ${MAX_BULK_IDS} users can be updated in a single request.`,
    };
  }

  return { ok: true, ids };
}