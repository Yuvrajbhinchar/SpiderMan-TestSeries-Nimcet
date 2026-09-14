"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  CheckCircle2,
  FolderTree,
  Loader2,
  Plus,
  RefreshCw,
  ShieldOff,
} from "lucide-react";

const EMPTY_FORM = { name: "", slug: "", description: "", parentId: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadCategories = useCallback(async ({ background = false } = {}) => {
    background ? setRefreshing(true) : setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/categories", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to load categories.");
      }

      setCategories(Array.isArray(data?.categories) ? data.categories : []);
    } catch (loadError) {
      console.error("Admin categories load error:", loadError);
      setError(loadError?.message || "Unable to load categories.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const categoryById = useMemo(() => {
    const map = new Map();
    categories.forEach((item) => map.set(item.id, item));
    return map;
  }, [categories]);

  const slugify = (value) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const submitCategory = async (event) => {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          name: form.name,
          slug: form.slug || slugify(form.name),
          description: form.description || null,
          parentId: form.parentId ? Number(form.parentId) : null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to create category.");
      }

      setForm(EMPTY_FORM);
      setFormOpen(false);
      await loadCategories({ background: true });
    } catch (createError) {
      console.error("Category create error:", createError);
      setError(createError?.message || "Unable to create category.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCategory = async (item) => {
    if (busyId) return;

    const nextActive = !item.isActive;

    const confirmed = window.confirm(
      nextActive
        ? `Activate "${item.name}"?`
        : `Deactivate "${item.name}"?\n\nTests under this category will be treated as unavailable.`
    );

    if (!confirmed) return;

    setBusyId(item.id);
    setError("");

    try {
      const response = await fetch(`/api/admin/categories/${item.id}/status`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ isActive: nextActive }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || "Unable to update category.");
      }

      setCategories((previous) =>
        previous.map((row) =>
          row.id === item.id ? { ...row, isActive: nextActive } : row
        )
      );
    } catch (updateError) {
      console.error("Category status update error:", updateError);
      setError(updateError?.message || "Unable to update category.");
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
              Category Management
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Organize tests into categories and control their availability.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => loadCategories({ background: true })}
              disabled={loading || refreshing}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setFormOpen((open) => !open)}
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-4 text-sm font-black text-white transition hover:bg-red-700"
            >
              <Plus className="h-4 w-4" />
              New Category
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {formOpen ? (
        <form
          onSubmit={submitCategory}
          className="mt-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2"
        >
          <div>
            <label className="text-xs font-black text-slate-700">Name</label>
            <input
              required
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="e.g. NIMCET Mock Tests"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-700">
              Slug (auto-generated if left blank)
            </label>
            <input
              value={form.slug}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, slug: event.target.value }))
              }
              placeholder="nimcet-mock-tests"
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
            />
          </div>

          <div>
            <label className="text-xs font-black text-slate-700">
              Parent Category (optional)
            </label>
            <select
              value={form.parentId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, parentId: event.target.value }))
              }
              className="mt-1.5 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white"
            >
              <option value="">None</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-black text-slate-700">
              Description (optional)
            </label>
            <input
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none focus:border-red-300 focus:bg-white"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setForm(EMPTY_FORM);
              }}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-600"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-4 text-xs font-black text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Create Category
            </button>
          </div>
        </form>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Parent
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="inline-flex items-center gap-2 text-sm font-bold text-slate-400">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading categories...
                    </div>
                  </td>
                </tr>
              ) : null}

              {!loading && categories.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <FolderTree className="mx-auto h-7 w-7 text-slate-400" />
                    <h3 className="mt-4 text-base font-black text-slate-900">
                      No categories yet
                    </h3>
                  </td>
                </tr>
              ) : null}

              {!loading
                ? categories.map((item) => (
                    <tr key={item.id} className="transition hover:bg-slate-50/60">
                      <td className="px-5 py-4">
                        <p className="text-sm font-black text-slate-900">
                          {item.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          /{item.slug}
                        </p>
                      </td>

                      <td className="px-4 py-4 text-xs font-bold text-slate-500">
                        {item.parentId
                          ? categoryById.get(item.parentId)?.name || "—"
                          : "—"}
                      </td>

                      <td className="px-4 py-4">
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
                      </td>

                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => toggleCategory(item)}
                          className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-xs font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                            item.isActive
                              ? "border border-red-100 bg-red-50 text-red-600 hover:bg-red-100"
                              : "bg-emerald-600 text-white hover:bg-emerald-700"
                          }`}
                        >
                          {busyId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : null}
                          {item.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}