"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  Save,
  Loader2,
  ArrowLeft,
  Globe2,
  EyeOff,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import {
  useRouter,
} from "next/navigation";

import {
  motion,
} from "motion/react";

const SERIES = [
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

const DEFAULT_FORM =
  {
    series: "free",
    categoryId: "",
    title: "",
    slug: "",
    description: "",
    durationMinutes: "60",
    totalQuestions: "0",
    totalMarks: "0",
    isPublished: false,
    isActive: true,
  };

function slugify(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .replace(
      /-+/g,
      "-"
    );
}

export default function TestForm({
  mode = "create",
  initialTest = null,
}) {
  const router =
    useRouter();

  const editing =
    mode === "edit";

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    categoriesLoading,
    setCategoriesLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    slugTouched,
    setSlugTouched,
  ] = useState(
    editing
  );

  const [
    form,
    setForm,
  ] = useState(
    DEFAULT_FORM
  );

  /* =========================================================
     INITIAL FORM
  ========================================================= */

  useEffect(() => {
    if (
      !initialTest
    ) {
      return;
    }

    setForm({
      series:
        initialTest.series ||
        "free",

      categoryId:
        initialTest.categoryId
          ? String(
              initialTest.categoryId
            )
          : "",

      title:
        initialTest.title ||
        "",

      slug:
        initialTest.slug ||
        "",

      description:
        initialTest.description ||
        "",

      durationMinutes:
        String(
          initialTest.durationMinutes ||
            60
        ),

      totalQuestions:
        String(
          initialTest.totalQuestions ||
            0
        ),

      totalMarks:
        String(
          initialTest.totalMarks ||
            0
        ),

      isPublished:
        Boolean(
          initialTest.isPublished
        ),

      isActive:
        initialTest.isActive !==
        false,
    });

    setSlugTouched(
      true
    );
  }, [
    initialTest,
  ]);

  /* =========================================================
     LOAD CATEGORIES
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        setCategoriesLoading(
          true
        );

        const response =
          await fetch(
            "/api/admin/categories",
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

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to load categories."
          );
        }

        setCategories(
          Array.isArray(
            data?.categories
          )
            ? data.categories
            : []
        );
      } catch (
        loadError
      ) {
        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load categories."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setCategoriesLoading(
            false
          );
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  /* =========================================================
     FIELD HELPERS
  ========================================================= */

  const updateField =
    (
      field,
      value
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,
          [field]:
            value,
        })
      );
    };

  const handleTitleChange =
    (value) => {
      updateField(
        "title",
        value
      );

      if (
        !slugTouched &&
        !editing
      ) {
        updateField(
          "slug",
          slugify(
            value
          )
        );
      }
    };

  const handleSlugChange =
    (value) => {
      setSlugTouched(
        true
      );

      updateField(
        "slug",
        slugify(
          value
        )
      );
    };

  /* =========================================================
     SUBMIT
  ========================================================= */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        saving
      ) {
        return;
      }

      setError("");
      setSuccess("");
      setSaving(
        true
      );

      try {
        const endpoint =
          editing
            ? `/api/admin/tests/${encodeURIComponent(
                String(
                  form.series
                )
              )}/${encodeURIComponent(
                String(
                  initialTest.id
                )
              )}`
            : "/api/admin/tests";

        const method =
          editing
            ? "PATCH"
            : "POST";

        const response =
          await fetch(
            endpoint,
            {
              method,

              credentials:
                "include",

              headers: {
                "Content-Type":
                  "application/json",
              },

              cache:
                "no-store",

              body:
                JSON.stringify(
                  {
                    series:
                      form.series,

                    categoryId:
                      Number(
                        form.categoryId
                      ),

                    title:
                      form.title,

                    slug:
                      form.slug,

                    description:
                      form.description,

                    durationMinutes:
                      Number(
                        form.durationMinutes
                      ),

                    totalQuestions:
                      Number(
                        form.totalQuestions
                      ),

                    totalMarks:
                      Number(
                        form.totalMarks
                      ),

                    isPublished:
                      form.isPublished,

                    isActive:
                      form.isActive,
                  }
                ),
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
              "Unable to save test."
          );
        }

        /*
         * ------------------------------------------------------
         * CREATE
         * ------------------------------------------------------
         */

        if (
          !editing
        ) {
          const createdId =
            data?.test?.id;

          if (
            createdId
          ) {
            router.replace(
              `/admin/tests/${encodeURIComponent(
                String(
                  form.series
                )
              )}/${encodeURIComponent(
                String(
                  createdId
                )
              )}`
            );

            return;
          }
        }

        setSuccess(
          data?.message ||
            "Test saved successfully."
        );
      } catch (
        saveError
      ) {
        console.error(
          "Admin test save error:",
          saveError
        );

        setError(
          saveError?.message ||
            "Unable to save test."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =========================================================
     CATEGORY LIST
  ========================================================= */

  const activeCategories =
    categories.filter(
      (category) =>
        category.isActive ||
        String(
          category.id
        ) ===
          String(
            form.categoryId
          )
    );

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin/tests"
              )
            }
            className="mb-3 inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 transition hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />

            Back to Tests
          </button>

          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
            Test Management
          </p>

          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-slate-950">
            {editing
              ? "Edit Test"
              : "Create Test"}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {editing
              ? "Update the test configuration."
              : "Create a test draft. Questions can be added afterward."}
          </p>
        </div>
      </div>

      {/* =====================================================
          ALERTS
      ====================================================== */}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      {/* =====================================================
          FORM
      ====================================================== */}

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-7"
      >
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          {/* MAIN */}

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Basic Information
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Test Details
              </h2>
            </div>

            <div className="mt-6 space-y-5">
              {/* SERIES */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Series
                </label>

                <select
                  value={
                    form.series
                  }
                  disabled={
                    editing
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "series",
                      event
                        .target
                        .value
                    )
                  }
                  className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
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

                {editing ? (
                  <p className="mt-1.5 text-[10px] text-slate-400">
                    Series cannot be changed after creation.
                  </p>
                ) : null}
              </div>

              {/* CATEGORY */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Category
                </label>

                <select
                  required
                  value={
                    form.categoryId
                  }
                  disabled={
                    categoriesLoading
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "categoryId",
                      event
                        .target
                        .value
                    )
                  }
                  className="mt-2 h-11 w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-700 outline-none focus:border-red-300 focus:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <option value="">
                    {categoriesLoading
                      ? "Loading categories..."
                      : "Select category"}
                  </option>

                  {activeCategories.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {category.name}
                        {!category.isActive
                          ? " (Inactive)"
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </div>

              {/* TITLE */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Title
                </label>

                <input
                  required
                  maxLength={
                    200
                  }
                  value={
                    form.title
                  }
                  onChange={(
                    event
                  ) =>
                    handleTitleChange(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="e.g. NIMCET Maths DPP 01"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />
              </div>

              {/* SLUG */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Slug
                </label>

                <input
                  required
                  maxLength={
                    180
                  }
                  value={
                    form.slug
                  }
                  onChange={(
                    event
                  ) =>
                    handleSlugChange(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="nimcet-maths-dpp-01"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />

                <p className="mt-1.5 text-[10px] leading-5 text-slate-400">
                  Lowercase letters, numbers and hyphens only.
                </p>
              </div>

              {/* DESCRIPTION */}

              <div>
                <label className="text-xs font-black text-slate-700">
                  Description
                </label>

                <textarea
                  rows={
                    5
                  }
                  value={
                    form.description
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "description",
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Optional test description..."
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />
              </div>

              {/* NUMBERS */}

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-xs font-black text-slate-700">
                    Duration (min)
                  </label>

                  <input
                    required
                    type="number"
                    min="1"
                    step="1"
                    value={
                      form.durationMinutes
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "durationMinutes",
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700">
                    Questions
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={
                      form.totalQuestions
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "totalQuestions",
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-black text-slate-700">
                    Total Marks
                  </label>

                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={
                      form.totalMarks
                    }
                    onChange={(
                      event
                    ) =>
                      updateField(
                        "totalMarks",
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-bold text-slate-900 outline-none focus:border-red-300 focus:bg-white"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* SIDE */}

          <div className="space-y-5">
            {/* STATUS */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                Availability
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                Test Status
              </h2>

              {/* ACTIVE */}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    form.isActive
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "isActive",
                      event
                        .target
                        .checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-red-600"
                />

                <div>
                  <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                    {form.isActive ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-slate-400" />
                    )}

                    Active
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Controls whether the test is enabled.
                  </p>
                </div>
              </label>

              {/* PUBLISHED */}

              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <input
                  type="checkbox"
                  checked={
                    form.isPublished
                  }
                  onChange={(
                    event
                  ) =>
                    updateField(
                      "isPublished",
                      event
                        .target
                        .checked
                    )
                  }
                  className="mt-0.5 h-4 w-4 cursor-pointer accent-red-600"
                />

                <div>
                  <p className="flex items-center gap-1.5 text-sm font-black text-slate-900">
                    {form.isPublished ? (
                      <Globe2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-slate-400" />
                    )}

                    Published
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Published tests can appear to students when all other availability checks pass.
                  </p>
                </div>
              </label>
            </section>

            {/* SAVE */}

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <button
                type="submit"
                disabled={
                  saving ||
                  categoriesLoading
                }
                className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              >
                {saving ? (
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                ) : (
                  <Save className="h-4.5 w-4.5" />
                )}

                {saving
                  ? "Saving..."
                  : editing
                    ? "Save Changes"
                    : "Create Test"}
              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/admin/tests"
                  )
                }
                className="mt-2 h-11 w-full cursor-pointer rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                Cancel
              </button>
            </section>
          </div>
        </div>
      </form>
    </div>
  );
}