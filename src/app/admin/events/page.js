"use client";

import { useCallback, useEffect, useState } from "react";

import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Plus,
  RefreshCw,
  ShieldOff,
  Trash2,
  Trophy,
  X,
} from "lucide-react";

const SERIES_TABS = [
  { slug: "free", label: "Free" },
  { slug: "asspire", label: "Asspire" },
  { slug: "imppetus", label: "Imppetus" },
  { slug: "spiderman", label: "SpiderMan" },
];

const EMPTY_FORM = {
  testId: "",
  eventName: "",
  startAt: "",
  startWindowEnd: "",
  durationMinutes: "",
  autoSubmit: true,
};

function toLocalInputValue(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(isoString) {
  if (!isoString) return "—";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return String(isoString);

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PhasePill({ phase }) {
  const map = {
    scheduled: { label: "Scheduled", className: "bg-slate-100 text-slate-600" },
    entry_open: {
      label: "Entry open",
      className: "bg-emerald-50 text-emerald-700",
    },
    closed: { label: "Closed", className: "bg-red-50 text-red-600" },
  };

  const { label, className } = map[phase] || map.scheduled;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-black ${className}`}
    >
      {label}
    </span>
  );
}

export default function AdminEventsPage() {
  const [series, setSeries] = useState("asspire");

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [tests, setTests] = useState([]);
  const [testsLoading, setTestsLoading] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const [busyId, setBusyId] = useState(null);

  const [leaderboardOpenId, setLeaderboardOpenId] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  const loadEvents = useCallback(
    async ({ background = false } = {}) => {
      background ? setRefreshing(true) : setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/admin/events/${series}`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data?.error || "Unable to load events.");
        }

        setEvents(Array.isArray(data?.events) ? data.events : []);
      } catch (loadError) {
        console.error("Admin events load error:", loadError);
        setError(loadError?.message || "Unable to load events.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [series]
  );

  const loadTests = useCallback(async () => {
    setTestsLoading(true);

    try {
      const response = await fetch(
        `/api/admin/tests?series=${series}&limit=50&status=published`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load tests.");
      }

      setTests(Array.isArray(data?.tests) ? data.tests : []);
    } catch (loadError) {
      console.error("Admin tests load error:", loadError);
    } finally {
      setTestsLoading(false);
    }
  }, [series]);

  useEffect(() => {
    setLeaderboardOpenId(null);
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    loadEvents();
  }, [series, loadEvents]);

  const openCreateForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    loadTests();
  };

  const openEditForm = (event) => {
    setEditingId(event.id);
    setForm({
      testId: String(event.testId),
      eventName: event.eventName || "",
      startAt: toLocalInputValue(event.startAt),
      startWindowEnd: toLocalInputValue(event.startWindowEnd),
      durationMinutes: String(event.durationMinutes),
      autoSubmit: event.autoSubmit,
    });
    setFormOpen(true);
    loadTests();
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const submitForm = async (formEvent) => {
    formEvent.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    const payload = editingId
      ? {
          eventName: form.eventName || null,
          startAt: form.startAt ? new Date(form.startAt).toISOString() : undefined,
          startWindowEnd: form.startWindowEnd
            ? new Date(form.startWindowEnd).toISOString()
            : undefined,
          durationMinutes: Number(form.durationMinutes),
          autoSubmit: form.autoSubmit,
        }
      : {
          testId: Number(form.testId),
          eventName: form.eventName || null,
          startAt: new Date(form.startAt).toISOString(),
          startWindowEnd: new Date(form.startWindowEnd).toISOString(),
          durationMinutes: Number(form.durationMinutes),
          autoSubmit: form.autoSubmit,
        };

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/events/${series}/${editingId}`
          : `/api/admin/events/${series}`,
        {
          method: editingId ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to save event.");
      }

      closeForm();
      await loadEvents({ background: true });
    } catch (submitError) {
      console.error("Admin event save error:", submitError);
      setError(submitError?.message || "Unable to save event.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (event) => {
    if (busyId) return;
    setBusyId(`${event.id}:status`);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/events/${series}/${event.id}/status`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({
            action: event.isPublished ? "unpublish" : "publish",
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to update event status.");
      }

      setEvents((previous) =>
        previous.map((item) =>
          item.id === event.id
            ? { ...item, isPublished: !event.isPublished }
            : item
        )
      );
    } catch (statusError) {
      console.error("Admin event status error:", statusError);
      setError(statusError?.message || "Unable to update event status.");
    } finally {
      setBusyId(null);
    }
  };

  const deleteEvent = async (event) => {
    if (busyId) return;

    if (
      !window.confirm(
        `Delete the event "${event.eventName || event.testTitle}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setBusyId(`${event.id}:delete`);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/events/${series}/${event.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ confirm: true }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete event.");
      }

      setEvents((previous) => previous.filter((item) => item.id !== event.id));
    } catch (deleteError) {
      console.error("Admin event delete error:", deleteError);
      setError(deleteError?.message || "Unable to delete event.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleLeaderboard = async (event) => {
    if (leaderboardOpenId === event.id) {
      setLeaderboardOpenId(null);
      return;
    }

    setLeaderboardOpenId(event.id);
    setLeaderboardLoading(true);
    setLeaderboard([]);

    try {
      const response = await fetch(
        `/api/admin/events/${series}/${event.id}/leaderboard`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load leaderboard.");
      }

      setLeaderboard(Array.isArray(data?.leaderboard) ? data.leaderboard : []);
    } catch (leaderboardError) {
      console.error("Admin leaderboard load error:", leaderboardError);
      setError(leaderboardError?.message || "Unable to load leaderboard.");
    } finally {
      setLeaderboardLoading(false);
    }
  };

  return (
    <div>
      {/* HEADER */}

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Administration
        </p>

        <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
          Live Test Events
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Schedule, publish and monitor live test windows per series.
        </p>
      </div>

      {/* SERIES TABS */}

      <div className="mt-6 flex flex-wrap gap-2">
        {SERIES_TABS.map((tab) => (
          <button
            key={tab.slug}
            type="button"
            onClick={() => setSeries(tab.slug)}
            className={`h-10 rounded-xl px-4 text-sm font-black transition ${
              series === tab.slug
                ? "bg-slate-950 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ACTIONS */}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={openCreateForm}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#ef1118] px-4 text-sm font-black text-white transition hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          New event
        </button>

        <button
          type="button"
          onClick={() => loadEvents({ background: true })}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ERROR */}

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {/* CREATE / EDIT FORM */}

      {formOpen ? (
        <form
          onSubmit={submitForm}
          className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-900">
              {editingId ? "Edit event" : "New event"}
            </h2>

            <button
              type="button"
              onClick={closeForm}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-500">Test</label>

              <div className="relative mt-1">
                <select
                  required
                  disabled={Boolean(editingId) || testsLoading}
                  value={form.testId}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, testId: event.target.value }))
                  }
                  className="h-11 w-full cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-9 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {testsLoading ? "Loading tests..." : "Select a test"}
                  </option>

                  {tests.map((test) => (
                    <option key={test.id} value={test.id}>
                      {test.title}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>

              {editingId ? (
                <p className="mt-1 text-[11px] text-slate-400">
                  The test behind an event can't be changed after creation.
                </p>
              ) : null}
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-500">
                Event name (optional)
              </label>

              <input
                value={form.eventName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, eventName: event.target.value }))
                }
                placeholder="e.g. December Mock #4"
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">
                Starts at
              </label>

              <input
                required
                type="datetime-local"
                value={form.startAt}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, startAt: event.target.value }))
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">
                Entry closes at
              </label>

              <input
                required
                type="datetime-local"
                value={form.startWindowEnd}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    startWindowEnd: event.target.value,
                  }))
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
              />

              <p className="mt-1 text-[11px] text-slate-400">
                No new entrants can join after this time.
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500">
                Duration (minutes)
              </label>

              <input
                required
                type="number"
                min="1"
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    durationMinutes: event.target.value,
                  }))
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
              />
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={form.autoSubmit}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      autoSubmit: event.target.checked,
                    }))
                  }
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-red-600"
                />
                Auto-submit when time runs out
              </label>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeForm}
              className="h-10 rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? "Save changes" : "Create event"}
            </button>
          </div>
        </form>
      ) : null}

      {/* EVENTS LIST */}

      <section className="mt-5 space-y-3">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading events...
            </div>
          </div>
        ) : null}

        {!loading && events.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
            <CalendarClock className="mx-auto h-7 w-7 text-slate-400" />

            <h3 className="mt-4 text-base font-black text-slate-900">
              No events yet
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Create one to schedule a live test window for this series.
            </p>
          </div>
        ) : null}

        {!loading
          ? events.map((event) => {
              const statusBusy = busyId === `${event.id}:status`;
              const deleteBusy = busyId === `${event.id}:delete`;
              const leaderboardOpen = leaderboardOpenId === event.id;

              return (
                <div
                  key={event.id}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900">
                        {event.eventName || event.testTitle}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-400">
                        {event.testTitle}
                      </p>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <PhasePill phase={event.phase} />

                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black ${
                            event.isPublished
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {event.isPublished ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <ShieldOff className="h-3 w-3" />
                          )}
                          {event.isPublished ? "Published" : "Unpublished"}
                        </span>

                        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                          {event.attemptCount} attempt
                          {event.attemptCount === 1 ? "" : "s"}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-1 text-xs text-slate-500 sm:grid-cols-3">
                        <span>Starts: {formatDateTime(event.startAt)}</span>
                        <span>
                          Entry closes: {formatDateTime(event.startWindowEnd)}
                        </span>
                        <span>Duration: {event.durationMinutes} min</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleLeaderboard(event)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-100 bg-amber-50 px-3 text-xs font-black text-amber-700 transition hover:bg-amber-100"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                        Leaderboard
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditForm(event)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:bg-slate-50"
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        disabled={statusBusy}
                        onClick={() => toggleStatus(event)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          event.isPublished
                            ? "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                            : "bg-blue-600 text-white hover:bg-blue-700"
                        }`}
                      >
                        {statusBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : null}
                        {event.isPublished ? "Unpublish" : "Publish"}
                      </button>

                      <button
                        type="button"
                        disabled={deleteBusy}
                        onClick={() => deleteEvent(event)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deleteBusy ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>

                  {leaderboardOpen ? (
                    <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                      {leaderboardLoading ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading leaderboard...
                        </div>
                      ) : leaderboard.length === 0 ? (
                        <p className="text-xs font-medium text-slate-400">
                          No submitted attempts yet.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[480px] text-left text-xs">
                            <thead>
                              <tr className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                <th className="py-1.5 pr-3">Rank</th>
                                <th className="py-1.5 pr-3">Student</th>
                                <th className="py-1.5 pr-3">Score</th>
                                <th className="py-1.5 pr-3">Correct</th>
                                <th className="py-1.5 pr-3">Wrong</th>
                                <th className="py-1.5 pr-3">Time</th>
                              </tr>
                            </thead>

                            <tbody className="divide-y divide-slate-200">
                              {leaderboard.map((row) => (
                                <tr key={row.userId}>
                                  <td className="py-1.5 pr-3 font-black text-slate-900">
                                    #{row.rank}
                                  </td>
                                  <td className="py-1.5 pr-3 font-semibold text-slate-700">
                                    {row.displayName}
                                  </td>
                                  <td className="py-1.5 pr-3 font-bold text-slate-900">
                                    {row.score}
                                    {row.totalMarks !== null
                                      ? ` / ${row.totalMarks}`
                                      : ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-emerald-600">
                                    {row.correctCount}
                                  </td>
                                  <td className="py-1.5 pr-3 text-red-600">
                                    {row.wrongCount}
                                  </td>
                                  <td className="py-1.5 pr-3 text-slate-500">
                                    {row.timeTakenSeconds !== null
                                      ? `${Math.round(row.timeTakenSeconds / 60)} min`
                                      : "—"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          : null}
      </section>
    </div>
  );
}