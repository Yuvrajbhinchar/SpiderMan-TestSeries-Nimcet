import { createSlice } from "@reduxjs/toolkit";

export const CACHE_TTL_MS =
  30 * 1000;

const MAX_CACHE_ENTRIES = 40;

const initialState = {
  entries: {},
};

const testLibrarySlice = createSlice({
  name: "testLibrary",

  initialState,

  reducers: {
    setCachedPage(state, action) {
      const {
        key,
        tests = [],
        nextCursor = null,
        timestamp,
      } = action.payload || {};

      if (!key) {
        return;
      }

      state.entries[key] = {
        tests: Array.isArray(tests)
          ? tests
          : [],

        nextCursor:
          nextCursor ?? null,

        timestamp:
          Number.isFinite(
            Number(timestamp)
          )
            ? Number(timestamp)
            : 0,
      };

      /*
       * Keep the Redux cache bounded.
       */
      const keys = Object.keys(
        state.entries
      );

      if (
        keys.length >
        MAX_CACHE_ENTRIES
      ) {
        keys.sort(
          (a, b) =>
            Number(
              state.entries[a]
                ?.timestamp || 0
            ) -
            Number(
              state.entries[b]
                ?.timestamp || 0
            )
        );

        const removeCount =
          keys.length -
          MAX_CACHE_ENTRIES;

        for (
          let index = 0;
          index < removeCount;
          index++
        ) {
          delete state.entries[
            keys[index]
          ];
        }
      }
    },

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

    clearTestLibraryCache(
      state
    ) {
      state.entries = {};
    },
  },
});

export const {
  setCachedPage,
  removeCachedPage,
  clearTestLibraryCache,
} =
  testLibrarySlice.actions;

export function selectCachedPage(
  state,
  key
) {
  const entry =
    state.testLibrary?.entries?.[
      key
    ];

  if (!entry) {
    return null;
  }

  const timestamp =
    Number(
      entry.timestamp || 0
    );

  /*
   * Invalid/missing timestamp = cache miss.
   */
  if (
    !Number.isFinite(
      timestamp
    ) ||
    timestamp <= 0
  ) {
    return null;
  }

  /*
   * Expired = cache miss.
   */
  if (
    Date.now() -
      timestamp >
    CACHE_TTL_MS
  ) {
    return null;
  }

  return entry;
}

export default testLibrarySlice.reducer;