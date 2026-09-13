"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Plus,
} from "lucide-react";

import {
  motion,
} from "motion/react";

import {
  useRouter,
} from "next/navigation";

/* =========================================================
   SERIES
========================================================= */

const SERIES = [
  {
    value: "all",
    label: "All Series",
  },
  {
    value: "free",
    label: "Free",
  },
  {
    value: "asspire",
    label: "Asspire",
  },
  {
    value: "imppetus",
    label: "Imppetus",
  },
  {
    value: "spiderman",
    label: "SpiderMan",
  },
];

/* =========================================================
   STATUS
========================================================= */

const STATUS_OPTIONS = [
  {
    value: "all",
    label: "All Status",
  },
  {
    value: "active",
    label: "Active",
  },
  {
    value: "inactive",
    label: "Inactive",
  },
  {
    value: "published",
    label: "Published",
  },
  {
    value: "unpublished",
    label: "Unpublished",
  },
];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDuration(
  minutes
) {
  const value =
    Number(
      minutes || 0
    );

  if (
    value <= 0
  ) {
    return "—";
  }

  if (
    value < 60
  ) {
    return `${value} min`;
  }

  const hours =
    Math.floor(
      value / 60
    );

  const remaining =
    value % 60;

  if (
    remaining === 0
  ) {
    return `${hours} hr`;
  }

  return `${hours}h ${remaining}m`;
}

/* =========================================================
   STATUS PILL
========================================================= */

function StatusPill({
  active,
  children,
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-500"
      }`}
    >
      {active ? (
        <CheckCircle2 className="h-3 w-3" />
      ) : (
        <XCircle className="h-3 w-3" />
      )}

      {children}
    </span>
  );
}

/* =========================================================
   PAGE
========================================================= */

export default function AdminTestsPage() {
  const router =
    useRouter();

  /* -------------------------------------------------------
     DATA
  ------------------------------------------------------- */

  const [
    tests,
    setTests,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    loadingMore,
    setLoadingMore,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* -------------------------------------------------------
     FILTERS
  ------------------------------------------------------- */

  const [
    series,
    setSeries,
  ] = useState("all");

  const [
    status,
    setStatus,
  ] = useState("all");

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  /* -------------------------------------------------------
     PAGINATION
  ------------------------------------------------------- */

  const [
    nextCursor,
    setNextCursor,
  ] = useState(null);

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  /* -------------------------------------------------------
     REFS
  ------------------------------------------------------- */

  const requestIdRef =
    useRef(0);

  const observerRef =
    useRef(null);

  /* =========================================================
     LOAD TESTS
  ========================================================= */

  const loadTests =
    useCallback(
      async ({
        cursor = 0,
        append = false,
        background = false,
      } = {}) => {
        const requestId =
          ++requestIdRef.current;

        /*
         * Loading state
         */

        if (append) {
          setLoadingMore(
            true
          );
        } else if (
          background
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");

        try {
          const params =
            new URLSearchParams();

          params.set(
            "series",
            series
          );

          params.set(
            "status",
            status
          );

          params.set(
            "limit",
            "20"
          );

          params.set(
            "cursor",
            String(
              cursor
            )
          );

          if (
            search
          ) {
            params.set(
              "search",
              search
            );
          }

          const response =
            await fetch(
              `/api/admin/tests?${params.toString()}`,
              {
                method: "GET",

                credentials:
                  "include",

                cache:
                  "no-store",
              }
            );

          const data =
            await response
              .json()
              .catch(
                () => ({})
              );

          /*
           * Ignore stale requests.
           */

          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          /*
           * Authentication / authorization.
           */

          if (
            response.status ===
              401 ||
            response.status ===
              403
          ) {
            throw new Error(
              data?.error ||
                "Admin access denied."
            );
          }

          if (
            !response.ok
          ) {
            throw new Error(
              data?.error ||
                "Unable to load tests."
            );
          }

          const incoming =
            Array.isArray(
              data?.tests
            )
              ? data.tests
              : [];

          /*
           * Replace or append.
           */

          if (
            append
          ) {
            setTests(
              (
                previous
              ) => {
                const existingKeys =
                  new Set(
                    previous.map(
                      (
                        test
                      ) =>
                        `${test.seriesSlug}:${test.id}`
                    )
                  );

                const uniqueTests =
                  incoming.filter(
                    (
                      test
                    ) =>
                      !existingKeys.has(
                        `${test.seriesSlug}:${test.id}`
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
              incoming
            );
          }

          setNextCursor(
            data?.pagination
              ?.nextCursor ??
              null
          );

          setHasMore(
            Boolean(
              data?.pagination
                ?.hasMore
            )
          );
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
            "Admin tests load error:",
            fetchError
          );

          setError(
            fetchError?.message ||
              "Unable to load tests."
          );
        } finally {
          if (
            requestId !==
            requestIdRef.current
          ) {
            return;
          }

          setLoading(
            false
          );

          setLoadingMore(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        search,
        series,
        status,
      ]
    );

  /* =========================================================
     FILTER CHANGE
  ========================================================= */

  useEffect(() => {
    setTests([]);

    setNextCursor(
      null
    );

    setHasMore(
      false
    );

    loadTests({
      cursor: 0,
      append: false,
    });
  }, [
    series,
    status,
    search,
    loadTests,
  ]);

  /* =========================================================
     SEARCH DEBOUNCE
  ========================================================= */

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          setSearch(
            searchInput.trim()
          );
        },
        350
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    searchInput,
  ]);

  /* =========================================================
     LOAD MORE
  ========================================================= */

  const loadMore =
    useCallback(() => {
      if (
        loading ||
        loadingMore ||
        !hasMore ||
        nextCursor ===
          null
      ) {
        return;
      }

      loadTests({
        cursor:
          nextCursor,

        append: true,
      });
    }, [
      hasMore,
      loadTests,
      loading,
      loadingMore,
      nextCursor,
    ]);

  /* =========================================================
     OBSERVER
  ========================================================= */

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
            (
              entries
            ) => {
              if (
                entries[0]
                  ?.isIntersecting
              ) {
                loadMore();
              }
            },
            {
              rootMargin:
                "400px",
            }
          );

        observerRef.current.observe(
          node
        );
      },
      [loadMore]
    );

  /* =========================================================
     CLEANUP
  ========================================================= */

  useEffect(() => {
    return () => {
      requestIdRef.current +=
        1;

      observerRef.current?.disconnect();
    };
  }, []);

  /* =========================================================
     REFRESH
  ========================================================= */

  const refresh =
    useCallback(() => {
      loadTests({
        cursor: 0,

        append: false,

        background:
          tests.length >
          0,
      });
    }, [
      loadTests,
      tests.length,
    ]);

  /* =========================================================
     NAVIGATION
  ========================================================= */

  const openCreate =
    () => {
      router.push(
        "/admin/tests/new"
      );
    };

  const openManage =
    (
      test
    ) => {
      router.push(
        `/admin/tests/${encodeURIComponent(
          String(
            test.seriesSlug
          )
        )}/${encodeURIComponent(
          String(
            test.id
          )
        )}`
      );
    };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
            Content
          </p>

          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              Test Management
            </h1>

            {refreshing ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-500">
                <RefreshCw className="h-3 w-3 animate-spin" />

                Updating
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm text-slate-500">
            View and manage all tests across
            your test series.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Loaded
            </p>

            <p className="mt-1 text-xl font-black text-slate-950">
              {tests.length}
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreate
            }
            className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-4 text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15]"
          >
            <Plus className="h-4.5 w-4.5" />

            Create Test
          </button>
        </div>
      </div>

      {/* =====================================================
          FILTER BAR
      ====================================================== */}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_180px_auto]">
          {/* SEARCH */}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={
                searchInput
              }
              onChange={(
                event
              ) =>
                setSearchInput(
                  event.target
                    .value
                )
              }
              placeholder="Search title, slug or description..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-50"
            />
          </div>

          {/* SERIES */}

          <div className="relative">
            <select
              value={
                series
              }
              onChange={(
                event
              ) =>
                setSeries(
                  event.target
                    .value
                )
              }
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
            >
              {SERIES.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          {/* STATUS */}

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

            <select
              value={
                status
              }
              onChange={(
                event
              ) =>
                setStatus(
                  event.target
                    .value
                )
              }
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
            >
              {STATUS_OPTIONS.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {item.label}
                  </option>
                )
              )}
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          {/* REFRESH */}

          <button
            type="button"
            onClick={
              refresh
            }
            disabled={
              loading ||
              refreshing
            }
            className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>
        </div>
      </section>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error ? (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium text-red-600">
            {error}
          </p>

          <button
            type="button"
            onClick={
              refresh
            }
            className="w-fit cursor-pointer rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-600 shadow-sm"
          >
            Retry
          </button>
        </div>
      ) : null}

      {/* =====================================================
          TABLE
      ====================================================== */}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* ===================================================
            DESKTOP
        ==================================================== */}

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1080px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Test
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Series
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Category
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Stats
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Status
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Updated
                </th>

                <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* LOADING */}

              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-20 text-center"
                  >
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin" />

                      Loading tests...
                    </div>
                  </td>
                </tr>
              ) : null}

              {/* EMPTY */}

              {!loading &&
              tests.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-20 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                      <ClipboardList className="h-6 w-6" />
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900">
                      No tests found
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your filters
                      or create a new test.
                    </p>

                    <button
                      type="button"
                      onClick={
                        openCreate
                      }
                      className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-4 py-2.5 text-xs font-black text-white"
                    >
                      <Plus className="h-3.5 w-3.5" />

                      Create Test
                    </button>
                  </td>
                </tr>
              ) : null}

              {/* ROWS */}

              {!loading
                ? tests.map(
                    (
                      test,
                      index
                    ) => (
                      <motion.tr
                        key={`${test.seriesSlug}-${test.id}`}
                        initial={{
                          opacity: 0,
                        }}
                        animate={{
                          opacity: 1,
                        }}
                        transition={{
                          duration:
                            0.2,
                          delay:
                            Math.min(
                              index *
                                0.02,
                              0.2
                            ),
                        }}
                        className="transition hover:bg-slate-50/70"
                      >
                        {/* TEST */}

                        <td className="px-5 py-4">
                          <div className="max-w-[330px]">
                            <p className="truncate text-sm font-black text-slate-900">
                              {test.title}
                            </p>

                            <p className="mt-1 truncate text-[11px] font-medium text-slate-400">
                              {test.slug ||
                                "no-slug"}
                            </p>
                          </div>
                        </td>

                        {/* SERIES */}

                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                            {test.seriesName}
                          </span>
                        </td>

                        {/* CATEGORY */}

                        <td className="px-4 py-4">
                          <p className="text-xs font-bold text-slate-700">
                            {test.categoryName ||
                              "—"}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {test.categorySlug ||
                              "—"}
                          </p>
                        </td>

                        {/* STATS */}

                        <td className="px-4 py-4">
                          <div className="space-y-1 text-[11px] text-slate-500">
                            <p>
                              <span className="font-black text-slate-800">
                                {
                                  test.totalQuestions
                                }
                              </span>{" "}
                              questions
                            </p>

                            <p>
                              <span className="font-black text-slate-800">
                                {
                                  test.totalMarks
                                }
                              </span>{" "}
                              marks
                              {" · "}
                              {formatDuration(
                                test.durationMinutes
                              )}
                            </p>
                          </div>
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            <StatusPill
                              active={
                                test.isActive
                              }
                            >
                              {test.isActive
                                ? "Active"
                                : "Inactive"}
                            </StatusPill>

                            <StatusPill
                              active={
                                test.isPublished
                              }
                            >
                              {test.isPublished
                                ? "Published"
                                : "Unpublished"}
                            </StatusPill>
                          </div>
                        </td>

                        {/* UPDATED */}

                        <td className="px-4 py-4">
                          <p className="text-xs font-semibold text-slate-600">
                            {formatDate(
                              test.updatedAt
                            )}
                          </p>
                        </td>

                        {/* ACTION */}

                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              openManage(
                                test
                              )
                            }
                            className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Manage

                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </motion.tr>
                    )
                  )
                : null}
            </tbody>
          </table>
        </div>

        {/* ===================================================
            MOBILE
        ==================================================== */}

        <div className="divide-y divide-slate-100 lg:hidden">
          {/* LOADING */}

          {loading ? (
            <div className="flex min-h-52 items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />

                Loading tests...
              </div>
            </div>
          ) : null}

          {/* EMPTY */}

          {!loading &&
          tests.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                <ClipboardList className="h-6 w-6" />
              </div>

              <h3 className="mt-4 text-base font-black text-slate-900">
                No tests found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters.
              </p>

              <button
                type="button"
                onClick={
                  openCreate
                }
                className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#ef1118] px-4 py-2.5 text-xs font-black text-white"
              >
                <Plus className="h-3.5 w-3.5" />

                Create Test
              </button>
            </div>
          ) : null}

          {/* CARDS */}

          {!loading
            ? tests.map(
                (
                  test,
                  index
                ) => (
                  <motion.article
                    key={`${test.seriesSlug}-${test.id}`}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      duration:
                        0.2,
                      delay:
                        Math.min(
                          index *
                            0.03,
                          0.2
                        ),
                    }}
                    className="p-4"
                  >
                    {/* HEADER */}

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {test.title}
                        </p>

                        <p className="mt-1 truncate text-[10px] font-medium text-slate-400">
                          {test.slug ||
                            "no-slug"}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black text-slate-600">
                        {test.seriesName}
                      </span>
                    </div>

                    {/* INFO */}

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Category
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {test.categoryName ||
                            "—"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Questions
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {
                            test.totalQuestions
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Marks
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {
                            test.totalMarks
                          }
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                          Duration
                        </p>

                        <p className="mt-1 text-xs font-bold text-slate-700">
                          {formatDuration(
                            test.durationMinutes
                          )}
                        </p>
                      </div>
                    </div>

                    {/* FOOTER */}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex gap-1.5">
                        <StatusPill
                          active={
                            test.isActive
                          }
                        >
                          {test.isActive
                            ? "Active"
                            : "Inactive"}
                        </StatusPill>

                        <StatusPill
                          active={
                            test.isPublished
                          }
                        >
                          {test.isPublished
                            ? "Published"
                            : "Unpublished"}
                        </StatusPill>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          openManage(
                            test
                          )
                        }
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 shadow-sm transition hover:bg-slate-50"
                      >
                        Manage

                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.article>
                )
              )
            : null}
        </div>

        {/* ===================================================
            PAGINATION
        ==================================================== */}

        {!loading &&
        tests.length > 0 ? (
          <div
            ref={
              setObserverTarget
            }
            className="flex min-h-20 items-center justify-center border-t border-slate-100"
          >
            {loadingMore ? (
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />

                Loading more...
              </div>
            ) : hasMore ? (
              <span className="text-[11px] font-semibold text-slate-400">
                Loading more when visible...
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-slate-400">
                You&apos;ve reached the end.
              </span>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}