import { createSlice } from "@reduxjs/toolkit";

/* =========================================================
   CACHE CONFIG
========================================================= */

export const CACHE_TTL_MS =
  30 * 1000;

const MAX_CACHE_ENTRIES =
  40;

/* =========================================================
   INITIAL STATE
========================================================= */

const initialState = {
  entries: {},
};

/* =========================================================
   HELPERS
========================================================= */

/**
 * Remove all cache entries whose key starts with prefix.
 *
 * Current key format:
 *
 * series::mode::subject::cursor
 *
 * Examples:
 *
 * free::dpp::maths::first
 * free::mock::::first
 * spiderman::dpp::maths::first
 */
function deleteByPrefix(
  entries,
  prefix
) {
  if (!prefix) {
    return;
  }

  for (
    const key of Object.keys(
      entries
    )
  ) {
    if (
      key.startsWith(prefix)
    ) {
      delete entries[key];
    }
  }
}

/* =========================================================
   SLICE
========================================================= */

const testLibrarySlice =
  createSlice({
    name: "testLibrary",

    initialState,

    reducers: {
      /* =====================================================
         SET CACHE PAGE
      ===================================================== */

      setCachedPage(
        state,
        action
      ) {
        const {
          key,
          tests = [],
          nextCursor = null,
          timestamp,
        } =
          action.payload || {};

        if (!key) {
          return;
        }

        state.entries[key] = {
          tests:
            Array.isArray(
              tests
            )
              ? tests
              : [],

          nextCursor:
            nextCursor ??
            null,

          /*
           * Timestamp is supplied by the caller.
           *
           * This keeps cache age deterministic and avoids
           * depending on reducer execution timing.
           */
          timestamp:
            Number.isFinite(
              Number(timestamp)
            )
              ? Number(
                  timestamp
                )
              : Date.now(),
        };

        /* -----------------------------------------------
           LRU-LIKE MEMORY BOUND
        ------------------------------------------------ */

        const keys =
          Object.keys(
            state.entries
          );

        if (
          keys.length >
          MAX_CACHE_ENTRIES
        ) {
          keys.sort(
            (
              a,
              b
            ) =>
              Number(
                state
                  .entries[a]
                  ?.timestamp ||
                  0
              ) -
              Number(
                state
                  .entries[b]
                  ?.timestamp ||
                  0
              )
          );

          const removeCount =
            keys.length -
            MAX_CACHE_ENTRIES;

          for (
            let index = 0;
            index <
            removeCount;
            index += 1
          ) {
            delete state.entries[
              keys[index]
            ];
          }
        }
      },

      /* =====================================================
         REMOVE ONE EXACT PAGE
      ===================================================== */

      removeCachedPage(
        state,
        action
      ) {
        const key =
          action.payload;

        if (key) {
          delete state.entries[
            key
          ];
        }
      },

      /* =====================================================
         INVALIDATE WHOLE SERIES
         
         Example:
         
         invalidateTestLibrarySeries("spiderman")
         
         removes:
         
         spiderman::dpp::...
         spiderman::mini::...
         spiderman::mock::...
         spiderman::live::...
      ===================================================== */

      invalidateTestLibrarySeries(
        state,
        action
      ) {
        const series =
          String(
            action.payload ||
              ""
          )
            .trim()
            .toLowerCase();

        if (!series) {
          return;
        }

        deleteByPrefix(
          state.entries,
          `${series}::`
        );
      },

      /* =====================================================
         INVALIDATE ONE MODE
         
         Example:
         
         free + dpp
         
         removes every DPP page for Free series.
      ===================================================== */

      invalidateTestLibraryMode(
        state,
        action
      ) {
        const {
          series,
          mode,
        } =
          action.payload || {};

        const normalizedSeries =
          String(
            series || ""
          )
            .trim()
            .toLowerCase();

        const normalizedMode =
          String(
            mode || ""
          )
            .trim()
            .toLowerCase();

        if (
          !normalizedSeries ||
          !normalizedMode
        ) {
          return;
        }

        deleteByPrefix(
          state.entries,
          `${normalizedSeries}::${normalizedMode}::`
        );
      },

      /* =====================================================
         INVALIDATE ONE SUBJECT
         
         Useful for DPP subject changes.
      ===================================================== */

      invalidateTestLibrarySubject(
        state,
        action
      ) {
        const {
          series,
          mode,
          subject,
        } =
          action.payload || {};

        const normalizedSeries =
          String(
            series || ""
          )
            .trim()
            .toLowerCase();

        const normalizedMode =
          String(
            mode || ""
          )
            .trim()
            .toLowerCase();

        const normalizedSubject =
          String(
            subject || ""
          )
            .trim()
            .toLowerCase();

        if (
          !normalizedSeries ||
          !normalizedMode ||
          !normalizedSubject
        ) {
          return;
        }

        deleteByPrefix(
          state.entries,
          `${normalizedSeries}::${normalizedMode}::${normalizedSubject}::`
        );
      },

      /* =====================================================
         INVALIDATE EVERYTHING
      ===================================================== */

      clearTestLibraryCache(
        state
      ) {
        state.entries =
          {};
      },
    },
  });

/* =========================================================
   ACTIONS
========================================================= */

export const {
  setCachedPage,
  removeCachedPage,
  invalidateTestLibrarySeries,
  invalidateTestLibraryMode,
  invalidateTestLibrarySubject,
  clearTestLibraryCache,
} =
  testLibrarySlice.actions;

/* =========================================================
   SELECTOR
========================================================= */

/**
 * Returns only a FRESH cache page.
 *
 * Stale entries intentionally return null so callers can
 * decide whether to:
 *
 * 1. ignore stale data, or
 * 2. show stale data and revalidate in background.
 */

export function selectCachedPage(
  state,
  key
) {
  const entry =
    state.testLibrary
      ?.entries?.[
      key
    ];

  if (!entry) {
    return null;
  }

  const timestamp =
    Number(
      entry.timestamp || 0
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  if (
    Date.now() -
      timestamp >
    CACHE_TTL_MS
  ) {
    return null;
  }

  return entry;
}

/* =========================================================
   OPTIONAL RAW SELECTOR
========================================================= */

/**
 * Returns the cached page even when it is stale.
 *
 * This is useful for stale-while-revalidate UIs.
 */

export function selectRawCachedPage(
  state,
  key
) {
  return (
    state.testLibrary
      ?.entries?.[
      key
    ] || null
  );
}

/* =========================================================
   CACHE AGE
========================================================= */

export function selectCachedPageAge(
  state,
  key
) {
  const entry =
    selectRawCachedPage(
      state,
      key
    );

  if (!entry) {
    return null;
  }

  const timestamp =
    Number(
      entry.timestamp || 0
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Date.now() -
      timestamp
  );
}

/* =========================================================
   CACHE STATUS
========================================================= */

export function selectCachedPageStatus(
  state,
  key
) {
  const entry =
    selectRawCachedPage(
      state,
      key
    );

  if (!entry) {
    return "miss";
  }

  const timestamp =
    Number(
      entry.timestamp || 0
    );

  if (
    !Number.isFinite(
      timestamp
    )
  ) {
    return "invalid";
  }

  return Date.now() -
      timestamp <=
    CACHE_TTL_MS
    ? "fresh"
    : "stale";
}

export default
  testLibrarySlice.reducer;