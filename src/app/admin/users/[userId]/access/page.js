"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldOff,
  Unlock,
  UserRound,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

function formatDate(
  value
) {
  if (!value) {
    return "Lifetime";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return date.toLocaleString(
    undefined,
    {
      day:
        "2-digit",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function toDateTimeLocal(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const localOffset =
    date.getTimezoneOffset();

  const local =
    new Date(
      date.getTime() -
        localOffset *
          60 *
          1000
    );

  return local
    .toISOString()
    .slice(
      0,
      16
    );
}

function AccessCard({
  series,
  busy,
  onGrant,
  onRevoke,
}) {
  const [
    lifetime,
    setLifetime,
  ] = useState(
    !series.expiresAt
  );

  const [
    expiresAt,
    setExpiresAt,
  ] = useState(
    toDateTimeLocal(
      series.expiresAt
    )
  );

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    setLifetime(
      !series.expiresAt
    );

    setExpiresAt(
      toDateTimeLocal(
        series.expiresAt
      )
    );
  }, [
    series.expiresAt,
    series.isActive,
  ]);

  const grant =
    async () => {
      setError("");

      if (
        !lifetime &&
        !expiresAt
      ) {
        setError(
          "Select an expiry date or choose lifetime access."
        );

        return;
      }

      if (
        !lifetime
      ) {
        const date =
          new Date(
            expiresAt
          );

        if (
          Number.isNaN(
            date.getTime()
          ) ||
          date.getTime() <=
            Date.now()
        ) {
          setError(
            "Expiry must be a future date."
          );

          return;
        }
      }

      await onGrant(
        series.id,
        lifetime
          ? null
          : new Date(
              expiresAt
            ).toISOString()
      );
    };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                series.isActive
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {series.isActive ? (
                <Unlock className="h-5 w-5" />
              ) : (
                <Lock className="h-5 w-5" />
              )}
            </div>

            <div>
              <h2 className="text-lg font-black text-slate-950">
                {series.name}
              </h2>

              <p className="mt-0.5 text-xs text-slate-400">
                Paid Series · ID{" "}
                {series.id}
              </p>
            </div>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[10px] font-black ${
            series.isActive
              ? "bg-emerald-50 text-emerald-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          {series.isActive ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <ShieldOff className="h-3 w-3" />
          )}

          {series.isActive
            ? "ACCESS ACTIVE"
            : "NO ACCESS"}
        </span>
      </div>

      {/* DETAILS */}

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
            Granted
          </p>

          <p className="mt-1 text-xs font-bold text-slate-700">
            {formatDate(
              series.grantedAt
            )}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
            Expires
          </p>

          <p className="mt-1 text-xs font-bold text-slate-700">
            {formatDate(
              series.expiresAt
            )}
          </p>
        </div>
      </div>

      {/* EXPIRY */}

      <div className="mt-5">
        <label className="text-xs font-black text-slate-700">
          Grant Duration
        </label>

        <div className="mt-2 flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
            <input
              type="checkbox"
              checked={
                lifetime
              }
              disabled={
                busy
              }
              onChange={(
                event
              ) =>
                setLifetime(
                  event.target
                    .checked
                )
              }
              className="h-4 w-4 accent-red-600"
            />

            <span className="text-xs font-bold text-slate-700">
              Lifetime
            </span>
          </label>
        </div>

        {!lifetime ? (
          <div className="relative mt-2">
            <CalendarClock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              type="datetime-local"
              value={
                expiresAt
              }
              disabled={
                busy
              }
              onChange={(
                event
              ) =>
                setExpiresAt(
                  event.target
                    .value
                )
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white disabled:opacity-60"
            />
          </div>
        ) : null}

        <p className="mt-2 flex items-center gap-1.5 text-[10px] leading-5 text-slate-400">
          <Clock3 className="h-3 w-3 shrink-0" />

          Changing access will revoke the user's current
          session/device. They will need to log in again.
        </p>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-bold text-red-600">
          {error}
        </div>
      ) : null}

      {/* ACTIONS */}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={
            busy
          }
          onClick={
            grant
          }
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {busy ===
          "grant" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Unlock className="h-4 w-4" />
          )}

          {series.isActive
            ? "Update Access"
            : "Grant Access"}
        </button>

        <button
          type="button"
          disabled={
            busy ||
            !series.isActive
          }
          onClick={() =>
            onRevoke(
              series.id
            )
          }
          className="inline-flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ===
          "revoke" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldOff className="h-4 w-4" />
          )}

          Revoke Access
        </button>
      </div>
    </section>
  );
}

export default function AdminUserAccessPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const userId =
    String(
      params?.userId ||
        ""
    );

  const [
    user,
    setUser,
  ] = useState(null);

  const [
    series,
    setSeries,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    busyKey,
    setBusyKey,
  ] = useState(null);

  /* =========================================================
     LOAD
  ========================================================= */

  const loadAccess =
    useCallback(
      async ({
        background = false,
      } = {}) => {
        if (
          !userId
        ) {
          return;
        }

        if (
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
          const response =
            await fetch(
              `/api/admin/users/${encodeURIComponent(
                userId
              )}/access`,
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
            !response.ok
          ) {
            throw new Error(
              data?.error ||
                "Unable to load user access."
            );
          }

          setUser(
            data?.user ||
              null
          );

          setSeries(
            Array.isArray(
              data?.series
            )
              ? data.series
              : []
          );
        } catch (
          loadError
        ) {
          console.error(
            "User access load error:",
            loadError
          );

          setError(
            loadError?.message ||
              "Unable to load user access."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        userId,
      ]
    );

  useEffect(() => {
    loadAccess();
  }, [
    loadAccess,
  ]);

  /* =========================================================
     GRANT
  ========================================================= */

  const grantAccess =
    async (
      seriesId,
      expiresAt
    ) => {
      const key =
        `${seriesId}:grant`;

      setBusyKey(
        key
      );

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/users/${encodeURIComponent(
              userId
            )}/access`,
            {
              method:
                "POST",

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
                  seriesId:
                    Number(
                      seriesId
                    ),

                  expiresAt,
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

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to grant access."
          );
        }

        await loadAccess({
          background:
            true,
        });
      } catch (
        grantError
      ) {
        console.error(
          "Grant access error:",
          grantError
        );

        setError(
          grantError?.message ||
            "Unable to grant access."
        );
      } finally {
        setBusyKey(
          null
        );
      }
    };

  /* =========================================================
     REVOKE
  ========================================================= */

  const revokeAccess =
    async (
      seriesId
    ) => {
      const target =
        series.find(
          (
            item
          ) =>
            Number(
              item.id
            ) ===
            Number(
              seriesId
            )
        );

      if (!target) {
        return;
      }

      const confirmed =
        window.confirm(
          `Revoke ${target.name} access for ${
            user?.username ||
            "this user"
          }?\n\nTheir current session and device will also be revoked.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      const key =
        `${seriesId}:revoke`;

      setBusyKey(
        key
      );

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/users/${encodeURIComponent(
              userId
            )}/access`,
            {
              method:
                "DELETE",

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
                  seriesId:
                    Number(
                      seriesId
                    ),
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
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to revoke access."
          );
        }

        await loadAccess({
          background:
            true,
        });
      } catch (
        revokeError
      ) {
        console.error(
          "Revoke access error:",
          revokeError
        );

        setError(
          revokeError?.message ||
            "Unable to revoke access."
        );
      } finally {
        setBusyKey(
          null
        );
      }
    };

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    loading
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />

          Loading user access...
        </div>
      </div>
    );
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div>
      {/* HEADER */}

      <div>
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/users"
            )
          }
          className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />

          Back to Users
        </button>

        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Access Management
        </p>

        <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
          Series Access
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Grant or revoke paid-series access for this user.
        </p>
      </div>

      {/* USER CARD */}

      {user ? (
        <section className="mt-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white">
                <UserRound className="h-5 w-5" />
              </div>

              <div>
                <h2 className="text-base font-black text-slate-950">
                  {user.displayName ||
                    user.username}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  @
                  {
                    user.username
                  }
                  {" · "}
                  {
                    user.email
                  }
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-3 py-1.5 text-[10px] font-black ${
                  user.isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {user.isActive
                  ? "ACTIVE USER"
                  : "INACTIVE USER"}
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[10px] font-black text-slate-600">
                {
                  user.role
                }
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-black text-blue-800">
              <KeyRound className="h-4 w-4" />

              JWT Access Snapshot
            </p>

            <p className="mt-1 text-[11px] leading-5 text-blue-700">
              Every access change revokes this user's current
              session and device. The user must log in again
              to receive a fresh JWT containing the latest
              series access.
            </p>
          </div>
        </section>
      ) : null}

      {/* ERROR */}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {/* SERIES */}

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {series.map(
          (
            item
          ) => (
            <AccessCard
              key={
                item.id
              }
              series={
                item
              }
              busy={
                busyKey?.startsWith(
                  `${item.id}:`
                )
                  ? busyKey.split(
                      ":"
                    )[1]
                  : null
              }
              onGrant={
                grantAccess
              }
              onRevoke={
                revokeAccess
              }
            />
          )
        )}
      </div>

      {/* REFRESH */}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            loadAccess({
              background:
                true,
            })
          }
          className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              refreshing
                ? "animate-spin"
                : ""
            }`}
          />

          Refresh
        </button>
      </div>
    </div>
  );
}