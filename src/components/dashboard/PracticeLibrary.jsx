"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  BookOpen,
  ChevronRight,
  Loader2,
} from "lucide-react";

import {
  motion,
  AnimatePresence,
} from "motion/react";

import {
  useDispatch,
  useSelector,
} from "react-redux";

import TestGrid from "./TestGrid";

import {
  CACHE_TTL_MS,
  setCachedPage,
  selectCachedPage,
} from "@/store/testLibrarySlice";

const SUBJECT_NAMES = {
  maths: "Maths",
  reasoning: "Reasoning",
  cs: "Computer Science",
  english: "English",
};

const MODE_NAMES = {
  dpp: "DPP",
  mini: "Mini Tests",
  mock: "Mock Tests",
  live: "Live Tests",
};

export default function PracticeLibrary({
  activeSeries = "free",
  activeMode = "dpp",
  activeSubject = "maths",
  onStartTest,
}) {
  const dispatch = useDispatch();

  const cachedEntries = useSelector(
    (state) =>
      state.testLibrary?.entries || {}
  );

  const [tests, setTests] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [loadingMore, setLoadingMore] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const [nextCursor, setNextCursor] =
    useState(null);

  const observerRef =
    useRef(null);

  const requestIdRef =
    useRef(0);

  /*
  |--------------------------------------------------------------------------
  | Keep latest Redux cache in a ref.
  |--------------------------------------------------------------------------
  */

  const cachedEntriesRef =
    useRef(cachedEntries);

  useEffect(() => {
    cachedEntriesRef.current =
      cachedEntries;
  }, [cachedEntries]);

  /*
  |--------------------------------------------------------------------------
  | Prevent duplicate in-flight requests.
  |--------------------------------------------------------------------------
  */

  const inFlightRef =
    useRef(new Map());

  const currentSubject =
    SUBJECT_NAMES[activeSubject] ||
    "Maths";

  const currentMode =
    MODE_NAMES[activeMode] ||
    "DPP";

  /*
  |--------------------------------------------------------------------------
  | CACHE KEY
  |--------------------------------------------------------------------------
  */

  const getCacheKey =
    useCallback(
      ({
        cursor = null,
      } = {}) => {
        const subjectKey =
          activeMode === "dpp"
            ? activeSubject || ""
            : "";

        return [
          activeSeries || "free",
          activeMode || "dpp",
          subjectKey,
          cursor === null
            ? "first"
            : String(cursor),
        ].join("::");
      },
      [
        activeSeries,
        activeMode,
        activeSubject,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | RAW REDUX CACHE ENTRY
  |--------------------------------------------------------------------------
  |
  | Unlike selectCachedPage(), this function deliberately returns stale
  | entries too.
  |
  | That's required for stale-while-revalidate:
  |
  | stale cache → immediately show old data → refresh in background.
  |--------------------------------------------------------------------------
  */

  const readReduxCacheEntry =
    useCallback(
      (key) => {
        const entry =
          cachedEntriesRef.current?.[
            key
          ];

        if (!entry) {
          return null;
        }

        const timestamp =
          Number(
            entry.timestamp || 0
          );

        const age =
          Date.now() -
          timestamp;

        const stale =
          age > CACHE_TTL_MS;

        return {
          entry,

          stale,
        };
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | NORMAL FRESH-CACHE READ
  |--------------------------------------------------------------------------
  |
  | Keep selectCachedPage() available and use it for the strict fresh
  | cache path.
  |--------------------------------------------------------------------------
  */

  const readFreshReduxCache =
    useCallback(
      (key) => {
        return selectCachedPage(
          {
            testLibrary: {
              entries:
                cachedEntriesRef.current,
            },
          },
          key
        );
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | APPLY PAGE TO UI
  |--------------------------------------------------------------------------
  */

  const applyCachedPage =
    useCallback(
      (
        cachedPage,
        {
          append = false,
        } = {}
      ) => {
        if (!cachedPage) {
          return;
        }

        const cachedTests =
          Array.isArray(
            cachedPage.tests
          )
            ? cachedPage.tests
            : [];

        if (append) {
          setTests(
            (previous) => {
              const existingIds =
                new Set(
                  previous.map(
                    (test) =>
                      test.id
                  )
                );

              const uniqueTests =
                cachedTests.filter(
                  (test) =>
                    !existingIds.has(
                      test.id
                    )
                );

              return [
                ...previous,
                ...uniqueTests,
              ];
            }
          );
        } else {
          setTests(
            cachedTests
          );
        }

        setNextCursor(
          cachedPage.nextCursor ??
            null
        );

        setLoading(false);

        setLoadingMore(false);
      },
      []
    );

  /*
  |--------------------------------------------------------------------------
  | FETCH TESTS
  |--------------------------------------------------------------------------
  */

  const fetchTests =
    useCallback(
      async ({
        cursor = null,
        append = false,
      } = {}) => {
        const requestId =
          ++requestIdRef.current;

        const cacheKey =
          getCacheKey({
            cursor,
          });

        /*
        |--------------------------------------------------------------------------
        | 1. FRESH REDUX CACHE
        |--------------------------------------------------------------------------
        */

        const freshCachedPage =
          readFreshReduxCache(
            cacheKey
          );

        if (freshCachedPage) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          applyCachedPage(
            freshCachedPage,
            {
              append,
            }
          );

          return;
        }

        /*
        |--------------------------------------------------------------------------
        | 2. STALE CACHE
        |--------------------------------------------------------------------------
        |
        | This is the important Phase 6B change.
        |
        | We DON'T treat stale cache as useless.
        |
        | We display it immediately and then continue to the API request.
        |--------------------------------------------------------------------------
        */

        const cacheState =
          readReduxCacheEntry(
            cacheKey
          );

        const hasStaleCache =
          Boolean(
            cacheState?.entry &&
            cacheState.stale
          );

        if (
          hasStaleCache
        ) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          const stalePage =
            cacheState.entry;

          /*
           * Show stale data immediately.
           *
           * For pagination, append it exactly like a normal cache hit.
           */

          applyCachedPage(
            stalePage,
            {
              append,
            }
          );

          /*
           * Existing content stays visible while the background
           * refresh runs.
           */

          setError("");

          if (append) {
            setLoadingMore(
              true
            );
          } else {
            setRefreshing(
              true
            );

            /*
             * IMPORTANT:
             *
             * Don't set loading=true.
             *
             * Otherwise the UI would replace the useful stale
             * data with the loading screen.
             */
          }
        } else {
          /*
           * No cache at all.
           *
           * This is the normal cold-load path.
           */

          if (append) {
            setLoadingMore(
              true
            );
          } else {
            setLoading(true);
            setRefreshing(false);
            setError("");
          }
        }

        /*
        |--------------------------------------------------------------------------
        | 3. DUPLICATE REQUEST CHECK
        |--------------------------------------------------------------------------
        */

        const existingRequest =
          inFlightRef.current.get(
            cacheKey
          );

        if (existingRequest) {
          try {
            const result =
              await existingRequest;

            if (
              requestId !==
              requestIdRef.current
            ) {
              return;
            }

            if (result) {
              applyCachedPage(
                result,
                {
                  append,
                }
              );
            }
          } catch {
            /*
             * Original request handles the error.
             */
          }

          return;
        }

        /*
        |--------------------------------------------------------------------------
        | 4. BUILD API REQUEST
        |--------------------------------------------------------------------------
        */

        const requestPromise =
          (async () => {
            const params =
              new URLSearchParams();

            params.set(
              "series",
              activeSeries ||
                "free"
            );

            params.set(
              "mode",
              activeMode ||
                "dpp"
            );

            params.set(
              "limit",
              "12"
            );

            /*
             * Subject filter is only used for DPP.
             */

            if (
              activeMode ===
                "dpp" &&
              activeSubject
            ) {
              params.set(
                "subject",
                activeSubject
              );
            }

            if (
              cursor !== null
            ) {
              params.set(
                "cursor",
                String(cursor)
              );
            }

            /*
             * No browser HTTP cache.
             *
             * Redux is the deliberate application cache.
             */

            const response =
              await fetch(
                `/api/dashboard/tests?${params.toString()}`,
                {
                  method: "GET",

                  cache:
                    "no-store",
                }
              );

            const data =
              await response.json();

            if (!response.ok) {
              throw new Error(
                data?.error ||
                  "Unable to load practice tests."
              );
            }

            const newTests =
              Array.isArray(
                data?.tests
              )
                ? data.tests
                : [];

            const newNextCursor =
              data?.nextCursor ??
              null;

            const page = {
              tests:
                newTests,

              nextCursor:
                newNextCursor,
            };

            /*
             * Write fresh server data into Redux.
             *
             * setCachedPage creates the fresh timestamp.
             */

            dispatch(
              setCachedPage({
                key: cacheKey,

                tests:
                  newTests,

                nextCursor:
                  newNextCursor,

                timestamp:
                  Date.now(),
              })
            );

            return page;
          })();

        /*
        |--------------------------------------------------------------------------
        | 5. REGISTER IN-FLIGHT REQUEST
        |--------------------------------------------------------------------------
        */

        inFlightRef.current.set(
          cacheKey,
          requestPromise
        );

        try {
          const page =
            await requestPromise;

          /*
           * Don't allow an old filter request to overwrite a newer one.
           */

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          applyCachedPage(
            page,
            {
              append,
            }
          );

          setError("");
        } catch (
          fetchError
        ) {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          console.error(
            "Practice tests loading error:",
            fetchError
          );

          /*
           * STALE-WHILE-REVALIDATE BEHAVIOUR:
           *
           * If stale data was already shown, don't wipe it out.
           *
           * Just surface the error state.
           */

          if (
            hasStaleCache
          ) {
            setError(
              "Showing recently cached tests. Refresh failed."
            );
          } else {
            setError(
              fetchError?.message ||
                "Unable to load practice tests."
            );
          }
        } finally {
          /*
           * Only delete this exact promise if it is still
           * the registered request.
           */

          if (
            inFlightRef.current.get(
              cacheKey
            ) ===
            requestPromise
          ) {
            inFlightRef.current.delete(
              cacheKey
            );
          }

          if (
            requestId ===
            requestIdRef.current
          ) {
            setLoading(false);

            setLoadingMore(
              false
            );

            setRefreshing(
              false
            );
          }
        }
      },
      [
        activeSeries,
        activeMode,
        activeSubject,
        applyCachedPage,
        dispatch,
        getCacheKey,
        readFreshReduxCache,
        readReduxCacheEntry,
      ]
    );

  /*
  |--------------------------------------------------------------------------
  | RESET WHEN FILTER CHANGES
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    setTests([]);

    setNextCursor(null);

    setError("");

    setRefreshing(false);

    fetchTests({
      cursor: null,
      append: false,
    });
  }, [
    activeSeries,
    activeMode,
    activeSubject,
    fetchTests,
  ]);

  /*
  |--------------------------------------------------------------------------
  | LOAD MORE
  |--------------------------------------------------------------------------
  */

  const hasMore =
    Boolean(nextCursor);

  const loadMore =
    useCallback(() => {
      if (
        loading ||
        loadingMore ||
        !hasMore ||
        nextCursor === null
      ) {
        return;
      }

      fetchTests({
        cursor:
          nextCursor,

        append: true,
      });
    }, [
      fetchTests,
      hasMore,
      loading,
      loadingMore,
      nextCursor,
    ]);

  /*
  |--------------------------------------------------------------------------
  | INFINITE SCROLL
  |--------------------------------------------------------------------------
  */

  const setObserverTarget =
    useCallback(
      (node) => {
        if (
          observerRef.current
        ) {
          observerRef.current.disconnect();
        }

        if (!node) {
          return;
        }

        observerRef.current =
          new IntersectionObserver(
            (entries) => {
              if (
                entries[0]
                  ?.isIntersecting
              ) {
                loadMore();
              }
            },
            {
              rootMargin:
                "500px",
            }
          );

        observerRef.current.observe(
          node
        );
      },
      [loadMore]
    );

  /*
  |--------------------------------------------------------------------------
  | CLEANUP
  |--------------------------------------------------------------------------
  */

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();

      requestIdRef.current +=
        1;

      inFlightRef.current.clear();
    };
  }, []);

  return (
    <section className="mt-10">
      {/* HEADER */}

      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#ef1118]">
          <BookOpen
            size={13}
            strokeWidth={2.5}
          />

          Practice Library
        </div>

        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          Available Tests
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Start a test and improve one attempt
          at a time.
        </p>
      </div>

      {/* CURRENT FILTER */}

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
          {currentMode}
        </span>

        {activeMode ===
        "dpp" ? (
          <>
            <ChevronRight
              size={14}
              className="text-slate-300"
            />

            <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">
              {currentSubject}
            </span>
          </>
        ) : null}

        {/* Background refresh indicator */}

        {refreshing ? (
          <span className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold text-slate-400">
            <Loader2
              size={11}
              className="animate-spin"
            />

            Updating
          </span>
        ) : null}
      </div>

      <AnimatePresence
        mode="wait"
      >
        <motion.div
          key={`${activeSeries}-${activeMode}-${activeSubject}`}
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          exit={{
            opacity: 0,
            y: -8,
          }}
          transition={{
            duration: 0.22,
          }}
          className="mt-7"
        >
          {/* ERROR */}

          {error &&
          !loading ? (
            <motion.div
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="mb-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {error}
            </motion.div>
          ) : null}

          {/* LOADING */}

          {loading ? (
            <div className="flex min-h-45 items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-400">
                <Loader2
                  size={18}
                  className="animate-spin"
                />

                Loading tests...
              </div>
            </div>
          ) : null}

          {/* TESTS */}

          {!loading &&
          tests.length > 0 ? (
            <>
              <TestGrid
                tests={tests}
                onStartTest={
                  onStartTest
                }
              />

              <div
                ref={
                  setObserverTarget
                }
                className="flex min-h-20 items-center justify-center"
              >
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                    <Loader2
                      size={15}
                      className="animate-spin"
                    />

                    Loading more...
                  </div>
                ) : !hasMore ? (
                  <span className="text-[11px] font-medium text-slate-400">
                    You&apos;ve reached the end.
                  </span>
                ) : null}
              </div>
            </>
          ) : null}

          {/* EMPTY */}

          {!loading &&
          !error &&
          tests.length === 0 ? (
            <motion.div
              initial={{
                opacity: 0,
                y: 8,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center"
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50">
                <BookOpen
                  size={21}
                  className="text-slate-400"
                />
              </div>

              <h4 className="mt-4 text-sm font-bold text-slate-900">
                No tests available
              </h4>

              <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">
                There are no{" "}
                {activeMode ===
                "dpp"
                  ? `${currentSubject} DPP`
                  : currentMode.toLowerCase()}{" "}
                tests available in this
                series yet.
              </p>
            </motion.div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}