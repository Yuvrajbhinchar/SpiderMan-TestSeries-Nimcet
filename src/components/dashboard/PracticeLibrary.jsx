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

import { motion, AnimatePresence } from "motion/react";

import TestGrid from "./TestGrid";

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
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] =
    useState(false);
  const [error, setError] = useState("");
  const [nextCursor, setNextCursor] =
    useState(null);

  const observerRef = useRef(null);
  const requestIdRef = useRef(0);

  const currentSubject =
    SUBJECT_NAMES[activeSubject] || "Maths";

  const currentMode =
    MODE_NAMES[activeMode] || "DPP";

  const fetchTests = useCallback(
    async ({
      cursor = null,
      append = false,
    } = {}) => {
      const requestId =
        ++requestIdRef.current;

      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
          setError("");
        }

        const params =
          new URLSearchParams();

        params.set(
          "series",
          activeSeries || "free"
        );

        params.set(
          "mode",
          activeMode || "dpp"
        );

        params.set("limit", "12");

        /*
         * Subject filter is only valid for DPP.
         */
        if (
          activeMode === "dpp" &&
          activeSubject
        ) {
          params.set(
            "subject",
            activeSubject
          );
        }

        if (cursor !== null) {
          params.set(
            "cursor",
            String(cursor)
          );
        }

        const response = await fetch(
          `/api/dashboard/tests?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
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

        /*
         * Prevent an older request from
         * overwriting a newer selection.
         */
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        const newTests =
          Array.isArray(data?.tests)
            ? data.tests
            : [];

        if (append) {
          setTests((previous) => {
            const existingIds =
              new Set(
                previous.map(
                  (test) => test.id
                )
              );

            const uniqueTests =
              newTests.filter(
                (test) =>
                  !existingIds.has(
                    test.id
                  )
              );

            return [
              ...previous,
              ...uniqueTests,
            ];
          });
        } else {
          setTests(newTests);
        }

        setNextCursor(
          data?.nextCursor ?? null
        );
      } catch (fetchError) {
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

        setError(
          fetchError?.message ||
            "Unable to load practice tests."
        );
      } finally {
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setLoading(false);
        setLoadingMore(false);
      }
    },
    [
      activeSeries,
      activeMode,
      activeSubject,
    ]
  );

  /*
   * Reset list whenever the selected
   * series, mode, or subject changes.
   */
  useEffect(() => {
    setTests([]);
    setNextCursor(null);
    setError("");

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

  const hasMore = Boolean(nextCursor);

  const loadMore = useCallback(() => {
    if (
      loading ||
      loadingMore ||
      !hasMore ||
      nextCursor === null
    ) {
      return;
    }

    fetchTests({
      cursor: nextCursor,
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
   * Infinite scroll.
   */
  const setObserverTarget =
    useCallback(
      (node) => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }

        if (!node) {
          return;
        }

        observerRef.current =
          new IntersectionObserver(
            (entries) => {
              if (
                entries[0]?.isIntersecting
              ) {
                loadMore();
              }
            },
            {
              rootMargin: "500px",
            }
          );

        observerRef.current.observe(node);
      },
      [loadMore]
    );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      requestIdRef.current += 1;
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

        {activeMode === "dpp" ? (
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
      </div>

      <AnimatePresence mode="wait">
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

          {error && !loading ? (
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
                onStartTest={onStartTest}
              />

              <div
                ref={setObserverTarget}
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
                {activeMode === "dpp"
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