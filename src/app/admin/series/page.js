"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CheckCircle2,
  Layers,
  Loader2,
  Lock,
  RefreshCw,
  ShieldOff,
  Unlock,
} from "lucide-react";

export default function AdminSeriesPage() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const loadSeries = useCallback(async ({ background = false } = {}) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/series", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load series.");
      }

      setSeries(Array.isArray(data?.series) ? data.series : []);
    } catch (loadError) {
      console.error("Admin series load error:", loadError);
      setError(loadError?.message || "Unable to load series.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSeries();
  }, [loadSeries]);

  const toggleSeries = async (item) => {
    if (busyId) return;

    const nextActive = !item.isActive;

    const confirmed = window.confirm(
      nextActive
        ? `Activate "${item.name}"?`
        : `Deactivate "${item.name}"?\n\nStudents will no longer be able to access this series.`
    );

    if (!confirmed) return;

    setBusyId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/admin/series/${item.id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ isActive: nextActive }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to update series.");
      }

      setSeries((previous) =>
        previous.map((row) =>
          row.id === item.id ? { ...row, isActive: nextActive } : row
        )
      );
    } catch (updateError) {
      console.error("Series status update error:", updateError);
      setError(updateError?.message || "Unable to update series.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Administration
        </p>

        <div className="mt-1.5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              Series Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Activate or deactivate entire test series platform-wide.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadSeries({ background: true })}
            disabled={loading || refreshing}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <div className="col-span-full flex min-h-40 items-center justify-center">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading series...
            </div>
          </div>
        ) : null}

        {!loading
          ? series.map((item) => (
              <section
                key={item.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {item.isActive ? (
                      <Unlock className="h-5 w-5" />
                    ) : (
                      <Lock className="h-5 w-5" />
                    )}
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${
                      item.isActive
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {item.isActive ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <ShieldOff className="h-3 w-3" />
                    )}
                    {item.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-black text-slate-950">
                  {item.name}
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  {item.isPaid ? "Paid series" : "Free series"} · /{item.slug}
                </p>

                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-slate-500">
                  <Layers className="h-3.5 w-3.5" />
                  {item.testCount} test{item.testCount === 1 ? "" : "s"}
                </div>

                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => toggleSeries(item)}
                  className={`mt-5 inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    item.isActive
                      ? "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                      : "bg-emerald-600 text-white hover:bg-emerald-700"
                  }`}
                >
                  {busyId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : item.isActive ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <Unlock className="h-4 w-4" />
                  )}
                  {item.isActive ? "Deactivate" : "Activate"}
                </button>
              </section>
            ))
          : null}
      </div>
    </div>
  );
}