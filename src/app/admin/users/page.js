"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Filter,
  KeyRound,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  UserCheck,
  UserX,
} from "lucide-react";

import {
  motion,
} from "motion/react";

import {
  useRouter,
} from "next/navigation";

function formatDate(value) {
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
        <ShieldOff className="h-3 w-3" />
      )}

      {children}
    </span>
  );
}

export default function AdminUsersPage() {
  const router =
    useRouter();

  const [
    users,
    setUsers,
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

  const [
    searchInput,
    setSearchInput,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    status,
    setStatus,
  ] = useState("all");

  const [
    role,
    setRole,
  ] = useState("all");

  const [
    nextCursor,
    setNextCursor,
  ] = useState(null);

  const [
    hasMore,
    setHasMore,
  ] = useState(false);

  const [
    busyUser,
    setBusyUser,
  ] = useState(null);

  const observerRef =
    useRef(null);

  const mountedRef =
    useRef(true);

  const loadUsers =
    useCallback(
      async ({
        cursor = 0,
        append = false,
        background = false,
      } = {}) => {
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
            "search",
            search
          );

          params.set(
            "status",
            status
          );

          params.set(
            "role",
            role
          );

          params.set(
            "limit",
            "25"
          );

          if (cursor) {
            params.set(
              "cursor",
              String(cursor)
            );
          }

          const response =
            await fetch(
              `/api/admin/users?${params.toString()}`,
              {
                method:
                  "GET",

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

          if (!response.ok) {
            throw new Error(
              data?.error ||
                "Unable to load users."
            );
          }

          if (
            !mountedRef.current
          ) {
            return;
          }

          const incoming =
            Array.isArray(
              data?.users
            )
              ? data.users
              : [];

          if (append) {
            setUsers(
              (previous) => {
                const ids =
                  new Set(
                    previous.map(
                      (item) =>
                        Number(
                          item.id
                        )
                    )
                  );

                return [
                  ...previous,
                  ...incoming.filter(
                    (item) =>
                      !ids.has(
                        Number(
                          item.id
                        )
                      )
                  ),
                ];
              }
            );
          } else {
            setUsers(
              incoming
            );
          }

          const pagination =
            data?.pagination;

          setNextCursor(
            pagination?.nextCursor ??
              null
          );

          setHasMore(
            Boolean(
              pagination?.hasMore
            )
          );
        } catch (
          loadError
        ) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          console.error(
            "Admin users load error:",
            loadError
          );

          setError(
            loadError?.message ||
              "Unable to load users."
          );
        } finally {
          if (
            !mountedRef.current
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
        status,
        role,
      ]
    );

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

  useEffect(() => {
    setUsers([]);

    setNextCursor(
      null
    );

    setHasMore(
      false
    );

    loadUsers({
      cursor: 0,
      append: false,
    });
  }, [
    search,
    status,
    role,
  ]);

  const loadMore =
    useCallback(() => {
      if (
        loading ||
        loadingMore ||
        !hasMore ||
        !nextCursor
      ) {
        return;
      }

      loadUsers({
        cursor:
          nextCursor,
        append:
          true,
      });
    }, [
      hasMore,
      loadUsers,
      loading,
      loadingMore,
      nextCursor,
    ]);

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
                "400px",
            }
          );

        observerRef.current.observe(
          node
        );
      },
      [loadMore]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;

      observerRef.current?.disconnect();
    };
  }, []);

  const updateUser =
    async (
      user,
      action
    ) => {
      if (busyUser) {
        return;
      }

      let message =
        "";

      if (
        action ===
        "deactivate"
      ) {
        message =
          `Deactivate ${user.username}?\n\nTheir active session and device will also be revoked.`;
      } else if (
        action ===
        "activate"
      ) {
        message =
          `Activate ${user.username}?`;
      } else {
        message =
          `Revoke ${user.username}'s current session/device?`;
      }

      if (
        !window.confirm(
          message
        )
      ) {
        return;
      }

      setBusyUser(
        `${user.id}:${action}`
      );

      setError("");

      try {
        const response =
          await fetch(
            "/api/admin/users",
            {
              method:
                "PATCH",

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              cache:
                "no-store",

              body:
                JSON.stringify({
                  userId:
                    Number(
                      user.id
                    ),

                  action,
                }),
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

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

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Unable to update user."
          );
        }

        setUsers(
          (previous) =>
            previous.map(
              (item) => {
                if (
                  Number(
                    item.id
                  ) !==
                  Number(
                    user.id
                  )
                ) {
                  return item;
                }

                if (
                  action ===
                  "activate"
                ) {
                  return {
                    ...item,
                    isActive:
                      true,
                  };
                }

                return {
                  ...item,

                  isActive:
                    action ===
                    "deactivate"
                      ? false
                      : item.isActive,

                  hasActiveSession:
                    false,

                  hasActiveDevice:
                    false,
                };
              }
            )
        );
      } catch (
        updateError
      ) {
        console.error(
          "Admin user update error:",
          updateError
        );

        setError(
          updateError?.message ||
            "Unable to update user."
        );
      } finally {
        setBusyUser(
          null
        );
      }
    };

  const refresh =
    () => {
      loadUsers({
        cursor:
          0,

        append:
          false,

        background:
          users.length >
          0,
      });
    };

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Administration
        </p>

        <div className="mt-1.5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              User Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage user accounts and active sessions.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
              Loaded
            </p>

            <p className="mt-1 text-xl font-black text-slate-950">
              {users.length}
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================
          FILTER BAR
      ====================================================== */}

      <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_160px_auto]">
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
              placeholder="Search username, email or name..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white focus:ring-2 focus:ring-red-50"
            />
          </div>

          <div className="relative">
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
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
            >
              <option value="all">
                All Status
              </option>

              <option value="active">
                Active
              </option>

              <option value="inactive">
                Inactive
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <div className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />

            <select
              value={
                role
              }
              onChange={(
                event
              ) =>
                setRole(
                  event.target
                    .value
                )
              }
              className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
            >
              <option value="all">
                All Roles
              </option>

              <option value="user">
                User
              </option>

              <option value="admin">
                Admin
              </option>
            </select>

            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>

          <button
            type="button"
            onClick={
              refresh
            }
            disabled={
              loading ||
              refreshing
            }
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {/* =====================================================
          USERS
      ====================================================== */}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* DESKTOP */}

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1200px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  User
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Role
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Account
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Session
                </th>

                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Created
                </th>

                <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-20 text-center"
                  >
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin" />

                      Loading users...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading &&
              users.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-20 text-center"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
                      <UserCheck className="h-6 w-6" />
                    </div>

                    <h3 className="mt-4 text-base font-black text-slate-900">
                      No users found
                    </h3>

                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your filters.
                    </p>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? users.map(
                    (
                      user,
                      index
                    ) => {
                      const deactivateBusy =
                        busyUser ===
                        `${user.id}:deactivate`;

                      const activateBusy =
                        busyUser ===
                        `${user.id}:activate`;

                      const revokeBusy =
                        busyUser ===
                        `${user.id}:revoke_session`;

                      return (
                        <motion.tr
                          key={
                            user.id
                          }
                          initial={{
                            opacity: 0,
                          }}
                          animate={{
                            opacity: 1,
                          }}
                          transition={{
                            duration:
                              0.18,
                            delay:
                              Math.min(
                                index *
                                  0.015,
                                0.15
                              ),
                          }}
                          className="transition hover:bg-slate-50/60"
                        >
                          <td className="px-5 py-4">
                            <div className="max-w-[300px]">
                              <p className="truncate text-sm font-black text-slate-900">
                                {user.displayName ||
                                  user.username}
                              </p>

                              <p className="mt-1 truncate text-xs text-slate-400">
                                @
                                {
                                  user.username
                                }
                              </p>

                              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                                {
                                  user.email
                                }
                              </p>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-black ${
                                user.role ===
                                "admin"
                                  ? "bg-slate-950 text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {user.role ===
                              "admin" ? (
                                <ShieldCheck className="h-3 w-3" />
                              ) : null}

                              {user.role}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <StatusPill
                              active={
                                user.isActive
                              }
                            >
                              {user.isActive
                                ? "Active"
                                : "Inactive"}
                            </StatusPill>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                <Smartphone className="h-3 w-3" />

                                {user.hasActiveDevice
                                  ? "Device active"
                                  : "No device"}
                              </span>

                              {user.hasActiveSession ? (
                                <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-600">
                                  Session active
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <span className="text-xs font-semibold text-slate-500">
                              {formatDate(
                                user.createdAt
                              )}
                            </span>
                          </td>

                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-2">
                              {user.isActive ? (
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(
                                      busyUser
                                    )
                                  }
                                  onClick={() =>
                                    updateUser(
                                      user,
                                      "deactivate"
                                    )
                                  }
                                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {deactivateBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserX className="h-3.5 w-3.5" />
                                  )}

                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(
                                      busyUser
                                    )
                                  }
                                  onClick={() =>
                                    updateUser(
                                      user,
                                      "activate"
                                    )
                                  }
                                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {activateBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3.5 w-3.5" />
                                  )}

                                  Activate
                                </button>
                              )}

                              {user.hasActiveSession ||
                              user.hasActiveDevice ? (
                                <button
                                  type="button"
                                  disabled={
                                    Boolean(
                                      busyUser
                                    )
                                  }
                                  onClick={() =>
                                    updateUser(
                                      user,
                                      "revoke_session"
                                    )
                                  }
                                  className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {revokeBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <ShieldOff className="h-3.5 w-3.5" />
                                  )}

                                  Revoke
                                </button>
                              ) : null}

                              {/* ACCESS BUTTON */}

                              <button
                                type="button"
                                disabled={
                                  Boolean(
                                    busyUser
                                  )
                                }
                                onClick={() =>
                                  router.push(
                                    `/admin/users/${encodeURIComponent(
                                      String(
                                        user.id
                                      )
                                    )}/access`
                                  )
                                }
                                className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 text-xs font-black text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <KeyRound className="h-3.5 w-3.5" />

                                Access
                              </button>

                              <ChevronRight className="h-4 w-4 text-slate-300" />
                            </div>
                          </td>
                        </motion.tr>
                      );
                    }
                  )
                : null}
            </tbody>
          </table>
        </div>

        {/* ===================================================
            MOBILE
        ==================================================== */}

        <div className="divide-y divide-slate-100 lg:hidden">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />

                Loading users...
              </div>
            </div>
          ) : null}

          {!loading &&
          users.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <UserCheck className="mx-auto h-7 w-7 text-slate-400" />

              <h3 className="mt-4 text-base font-black text-slate-900">
                No users found
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Try changing your filters.
              </p>
            </div>
          ) : null}

          {!loading
            ? users.map(
                (
                  user,
                  index
                ) => {
                  const busy =
                    Boolean(
                      busyUser
                    );

                  return (
                    <motion.article
                      key={
                        user.id
                      }
                      initial={{
                        opacity: 0,
                        y: 6,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        duration:
                          0.18,
                        delay:
                          Math.min(
                            index *
                              0.02,
                            0.15
                          ),
                      }}
                      className="p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">
                            {user.displayName ||
                              user.username}
                          </p>

                          <p className="mt-1 truncate text-xs text-slate-400">
                            @
                            {
                              user.username
                            }
                          </p>

                          <p className="mt-0.5 truncate text-[11px] text-slate-400">
                            {
                              user.email
                            }
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-black ${
                            user.role ===
                            "admin"
                              ? "bg-slate-950 text-white"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {
                            user.role
                          }
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <StatusPill
                          active={
                            user.isActive
                          }
                        >
                          {user.isActive
                            ? "Active"
                            : "Inactive"}
                        </StatusPill>

                        {user.hasActiveSession ? (
                          <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-600">
                            Session active
                          </span>
                        ) : null}

                        {user.hasActiveDevice ? (
                          <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-black text-slate-500">
                            Device active
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-2">
                        {user.isActive ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateUser(
                                user,
                                "deactivate"
                              )
                            }
                            className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 text-xs font-black text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <UserX className="h-3.5 w-3.5" />

                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateUser(
                                user,
                                "activate"
                              )
                            }
                            className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <UserCheck className="h-3.5 w-3.5" />

                            Activate
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={
                            busy ||
                            (!user.hasActiveSession &&
                              !user.hasActiveDevice)
                          }
                          onClick={() =>
                            updateUser(
                              user,
                              "revoke_session"
                            )
                          }
                          className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white text-xs font-black text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ShieldOff className="h-3.5 w-3.5" />

                          Revoke
                        </button>

                        {/* ACCESS BUTTON */}

                        <button
                          type="button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            router.push(
                              `/admin/users/${encodeURIComponent(
                                String(
                                  user.id
                                )
                              )}/access`
                            )
                          }
                          className="inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 text-xs font-black text-blue-600 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <KeyRound className="h-3.5 w-3.5" />

                          Access
                        </button>
                      </div>

                      <p className="mt-3 text-[10px] font-semibold text-slate-400">
                        Joined{" "}
                        {formatDate(
                          user.createdAt
                        )}
                      </p>
                    </motion.article>
                  );
                }
              )
            : null}
        </div>

        {/* ===================================================
            LOAD MORE
        ==================================================== */}

        {!loading &&
        users.length >
          0 ? (
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
                Loading more...
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