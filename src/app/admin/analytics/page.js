"use client";

import { useCallback, useEffect, useState } from "react";

import {
  BarChart3,
  ClipboardList,
  Loader2,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";

const SERIES_LABELS = {
  free: "Free",
  asspire: "Asspire",
  imppetus: "Imppetus",
  spiderman: "SpiderMan",
};

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#ef1118]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{label}</p>
      {hint ? <p className="mt-1 text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [passThreshold, setPassThreshold] = useState(40);

  const load = useCallback(
    async ({ background = false, threshold } = {}) => {
      background ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/admin/analytics?passThreshold=${threshold ?? passThreshold}`,
          { method: "GET", credentials: "include", cache: "no-store" }
        );

        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(result?.error || "Unable to load analytics.");
        }

        setData(result);
      } catch (loadError) {
        console.error("Admin analytics load error:", loadError);
        setError(loadError?.message || "Unable to load analytics.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [passThreshold]
  );

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overview = data?.overview || {};
  const series = data?.series || [];
  const topTests = data?.topTests || [];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
            Administration
          </p>
          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
            Analytics
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Attempt volume, average scores, and pass rates across every series.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500">
            Pass ≥
            <input
              type="number"
              min={0}
              max={100}
              value={passThreshold}
              onChange={(event) => setPassThreshold(Number(event.target.value) || 0)}
              onBlur={() => load({ background: true })}
              className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-center text-slate-800"
            />
            %
          </label>

          <button
            type="button"
            onClick={() => load({ background: true })}
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

      {loading ? (
        <div className="mt-10 flex min-h-40 items-center justify-center">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading analytics...
          </div>
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={ClipboardList}
              label="Published tests"
              value={`${overview.publishedTests ?? 0} / ${overview.totalTests ?? 0}`}
            />
            <StatCard
              icon={BarChart3}
              label="Total questions"
              value={overview.totalQuestions ?? 0}
            />
            <StatCard
              icon={TrendingUp}
              label="Completed attempts"
              value={`${overview.completedAttempts ?? 0} / ${overview.totalAttempts ?? 0}`}
            />
            <StatCard
              icon={Users}
              label="Active users"
              value={`${overview.activeUsers ?? 0} / ${overview.totalUsers ?? 0}`}
            />
          </div>

          {/* PER-SERIES BREAKDOWN */}
          <section className="mt-8">
            <h2 className="text-lg font-black text-slate-950">Per series</h2>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-5 py-3">Series</th>
                    <th className="px-5 py-3">Tests</th>
                    <th className="px-5 py-3">Questions</th>
                    <th className="px-5 py-3">Attempts</th>
                    <th className="px-5 py-3">Avg score</th>
                    <th className="px-5 py-3">Pass rate</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((row) => (
                    <tr key={row.series} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 font-black text-slate-900">
                        {SERIES_LABELS[row.series] || row.series}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.publishedTests} / {row.totalTests}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{row.totalQuestions}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.completedAttempts} / {row.totalAttempts}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.avgScorePct === null ? "—" : `${row.avgScorePct}%`}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {row.passRatePct === null ? "—" : `${row.passRatePct}%`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* TOP TESTS */}
          <section className="mt-8">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-[#ef1118]" />
              <h2 className="text-lg font-black text-slate-950">
                Most attempted tests
              </h2>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                    <th className="px-5 py-3">Test</th>
                    <th className="px-5 py-3">Series</th>
                    <th className="px-5 py-3">Attempts</th>
                    <th className="px-5 py-3">Avg score</th>
                  </tr>
                </thead>
                <tbody>
                  {topTests.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                        No completed attempts yet.
                      </td>
                    </tr>
                  ) : (
                    topTests.map((row) => (
                      <tr
                        key={`${row.series}-${row.testId}`}
                        className="border-b border-slate-50 last:border-0"
                      >
                        <td className="px-5 py-3 font-bold text-slate-900">{row.title}</td>
                        <td className="px-5 py-3 text-slate-500">
                          {SERIES_LABELS[row.series] || row.series}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{row.attempts}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {row.avgScorePct === null ? "—" : `${row.avgScorePct}%`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}