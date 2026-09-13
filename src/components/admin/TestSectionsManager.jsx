"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Check,
  Clock3,
  Edit3,
  Layers3,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import {
  useDispatch,
} from "react-redux";

import {
  invalidateTestLibrarySeries,
} from "@/store/testLibrarySlice";

const EMPTY_FORM = {
  sectionName: "",
  durationMinutes: "",
  isSequential: true,
  timerGroup: "",
};

function SectionModal({
  open,
  editing,
  form,
  saving,
  error,
  onChange,
  onClose,
  onSubmit,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
      />

      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ef1118]">
              Section
            </p>

            <h2 className="mt-1 text-xl font-black text-slate-950">
              {editing
                ? "Edit Section"
                : "Add Section"}
            </h2>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="p-5 sm:p-6"
        >
          <div className="space-y-4">
            {/* NAME */}

            <div>
              <label className="text-xs font-black text-slate-700">
                Section Name
              </label>

              <input
                required
                maxLength={150}
                value={
                  form.sectionName
                }
                onChange={(event) =>
                  onChange(
                    "sectionName",
                    event.target.value
                  )
                }
                placeholder="e.g. Mathematics"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
              />
            </div>

            {/* DURATION */}

            <div>
              <label className="text-xs font-black text-slate-700">
                Section Duration
              </label>

              <div className="relative">
                <Clock3 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    form.durationMinutes
                  }
                  onChange={(event) =>
                    onChange(
                      "durationMinutes",
                      event.target.value
                    )
                  }
                  placeholder="Optional"
                  className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
                />
              </div>

              <p className="mt-1.5 text-[10px] text-slate-400">
                Leave empty when the section uses the test
                timer.
              </p>
            </div>

            {/* TIMER GROUP */}

            <div>
              <label className="text-xs font-black text-slate-700">
                Timer Group
              </label>

              <input
                value={
                  form.timerGroup
                }
                onChange={(event) =>
                  onChange(
                    "timerGroup",
                    event.target.value
                  )
                }
                placeholder="Optional"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 focus:border-red-300 focus:bg-white"
              />
            </div>

            {/* SEQUENTIAL */}

            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <input
                type="checkbox"
                checked={
                  form.isSequential
                }
                onChange={(event) =>
                  onChange(
                    "isSequential",
                    event.target.checked
                  )
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-red-600"
              />

              <div>
                <p className="text-sm font-black text-slate-900">
                  Sequential Section
                </p>

                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  Students must follow this section's question
                  flow sequentially.
                </p>
              </div>
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-bold leading-5 text-red-600">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-4 text-sm font-black text-white shadow-md shadow-red-100 hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}

              {saving
                ? "Saving..."
                : editing
                  ? "Save Changes"
                  : "Create Section"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TestSectionsManager({
  series,
  testId,
}) {
  const dispatch =
    useDispatch();

  const [
    sections,
    setSections,
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
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState(
    EMPTY_FORM
  );

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    movingKey,
    setMovingKey,
  ] = useState(null);

  const [
    deletingId,
    setDeletingId,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    formError,
    setFormError,
  ] = useState("");

  /* =========================================================
     LOAD
  ========================================================= */

  const loadSections =
    useCallback(
      async ({
        background = false,
      } = {}) => {
        if (
          !series ||
          !testId
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
              `/api/admin/tests/${encodeURIComponent(
                String(
                  series
                )
              )}/${encodeURIComponent(
                String(
                  testId
                )
              )}/sections`,
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
            !response.ok
          ) {
            throw new Error(
              data?.error ||
                "Unable to load sections."
            );
          }

          setSections(
            Array.isArray(
              data?.sections
            )
              ? data.sections
              : []
          );
        } catch (
          loadError
        ) {
          console.error(
            "Section load error:",
            loadError
          );

          setError(
            loadError?.message ||
              "Unable to load sections."
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
        series,
        testId,
      ]
    );

  useEffect(() => {
    loadSections();
  }, [
    loadSections,
  ]);

  /* =========================================================
     OPEN CREATE
  ========================================================= */

  function openCreate() {
    setEditing(
      null
    );

    setForm({
      ...EMPTY_FORM,
    });

    setFormError("");
    setModalOpen(
      true
    );
  }

  /* =========================================================
     OPEN EDIT
  ========================================================= */

  function openEdit(
    section
  ) {
    setEditing(
      section
    );

    setForm({
      sectionName:
        section.sectionName ||
        "",

      durationMinutes:
        section.durationMinutes
          ? String(
              section.durationMinutes
            )
          : "",

      isSequential:
        section.isSequential !==
        false,

      timerGroup:
        section.timerGroup ||
        "",
    });

    setFormError("");
    setModalOpen(
      true
    );
  }

  /* =========================================================
     FORM
  ========================================================= */

  function updateForm(
    field,
    value
  ) {
    setForm(
      (
        previous
      ) => ({
        ...previous,

        [field]:
          value,
      })
    );
  }

  /* =========================================================
     SAVE
  ========================================================= */

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    if (
      saving
    ) {
      return;
    }

    setSaving(
      true
    );

    setFormError("");

    try {
      const isEditing =
        Boolean(
          editing?.id
        );

      const endpoint =
        isEditing
          ? `/api/admin/tests/${encodeURIComponent(
              String(
                series
              )
            )}/${encodeURIComponent(
              String(
                testId
              )
            )}/sections/${encodeURIComponent(
              String(
                editing.id
              )
            )}`
          : `/api/admin/tests/${encodeURIComponent(
              String(
                series
              )
            )}/${encodeURIComponent(
              String(
                testId
              )
            )}/sections`;

      const response =
        await fetch(
          endpoint,
          {
            method:
              isEditing
                ? "PATCH"
                : "POST",

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
                sectionName:
                  form.sectionName,

                durationMinutes:
                  form.durationMinutes
                    ? Number(
                        form.durationMinutes
                      )
                    : null,

                isSequential:
                  form.isSequential,

                timerGroup:
                  form.timerGroup,
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
            "Unable to save section."
        );
      }

      const invalidation =
        data?.cacheInvalidation;

      if (
        invalidation?.type ===
          "series" &&
        invalidation?.series
      ) {
        dispatch(
          invalidateTestLibrarySeries(
            invalidation.series
          )
        );
      }

      setModalOpen(
        false
      );

      await loadSections({
        background:
          true,
      });
    } catch (
      saveError
    ) {
      console.error(
        "Section save error:",
        saveError
      );

      setFormError(
        saveError?.message ||
          "Unable to save section."
      );
    } finally {
      setSaving(
        false
      );
    }
  }

  /* =========================================================
     MOVE
  ========================================================= */

  async function moveSection(
    section,
    direction
  ) {
    if (
      movingKey ||
      !section?.id
    ) {
      return;
    }

    const index =
      sections.findIndex(
        (
          item
        ) =>
          Number(
            item.id
          ) ===
          Number(
            section.id
          )
      );

    if (
      index <
      0
    ) {
      return;
    }

    if (
      direction ===
        "up" &&
      index ===
        0
    ) {
      return;
    }

    if (
      direction ===
        "down" &&
      index ===
        sections.length -
          1
    ) {
      return;
    }

    setMovingKey(
      `${section.id}:${direction}`
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/tests/${encodeURIComponent(
            String(
              series
            )
          )}/${encodeURIComponent(
            String(
              testId
            )
          )}/sections/reorder`,
          {
            method: "POST",

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
                sectionId:
                  Number(
                    section.id
                  ),

                direction,
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
            "Unable to reorder section."
        );
      }

      await loadSections({
        background:
          true,
      });
    } catch (
      moveError
    ) {
      console.error(
        "Section reorder error:",
        moveError
      );

      setError(
        moveError?.message ||
          "Unable to reorder section."
      );
    } finally {
      setMovingKey(
        null
      );
    }
  }

  /* =========================================================
     DELETE
  ========================================================= */

  async function deleteSection(
    section
  ) {
    if (
      deletingId
    ) {
      return;
    }

    const questionCount =
      Number(
        section.questionCount ||
          0
      );

    const message =
      questionCount >
      0
        ? `Delete "${section.sectionName}"?\n\n${questionCount} question${
            questionCount ===
            1
              ? ""
              : "s"
          } will become unsectioned. The questions themselves will NOT be deleted.`
        : `Delete "${section.sectionName}" permanently?`;

    if (
      !window.confirm(
        message
      )
    ) {
      return;
    }

    setDeletingId(
      section.id
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/tests/${encodeURIComponent(
            String(
              series
            )
          )}/${encodeURIComponent(
            String(
              testId
            )
          )}/sections/${encodeURIComponent(
            String(
              section.id
            )
          )}`,
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
                confirm:
                  true,
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
            "Unable to delete section."
        );
      }

      const invalidation =
        data?.cacheInvalidation;

      if (
        invalidation?.type ===
          "series" &&
        invalidation?.series
      ) {
        dispatch(
          invalidateTestLibrarySeries(
            invalidation.series
          )
        );
      }

      await loadSections({
        background:
          true,
      });
    } catch (
      deleteError
    ) {
      console.error(
        "Section delete error:",
        deleteError
      );

      setError(
        deleteError?.message ||
          "Unable to delete section."
      );
    } finally {
      setDeletingId(
        null
      );
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {/* HEADER */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            <Layers3 className="h-3.5 w-3.5" />

            Test Structure
          </p>

          <h2 className="mt-1 text-lg font-black text-slate-950">
            Sections
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Create and organize sectional test structure.
          </p>
        </div>

        <button
          type="button"
          onClick={
            openCreate
          }
          className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-3.5 text-xs font-black text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15]"
        >
          <Plus className="h-4 w-4" />

          Add Section
        </button>
      </div>

      {/* ERROR */}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-bold leading-5 text-red-600">
          {error}
        </div>
      ) : null}

      {/* LIST */}

      <div className="mt-5">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />

              Loading sections...
            </div>
          </div>
        ) : null}

        {!loading &&
        sections.length ===
          0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
              <Layers3 className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-sm font-black text-slate-900">
              No sections yet
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              Add a section for sectional tests.
            </p>

            <button
              type="button"
              onClick={
                openCreate
              }
              className="mt-4 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-black text-white"
            >
              <Plus className="h-3.5 w-3.5" />

              Add Section
            </button>
          </div>
        ) : null}

        {!loading &&
        sections.length >
          0 ? (
          <div className="space-y-3">
            {sections.map(
              (
                section,
                index
              ) => {
                const upBusy =
                  movingKey ===
                  `${section.id}:up`;

                const downBusy =
                  movingKey ===
                  `${section.id}:down`;

                const deleting =
                  deletingId ===
                  section.id;

                return (
                  <motion.div
                    key={
                      section.id
                    }
                    initial={{
                      opacity: 0,
                      y: 5,
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
                    className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {/* ORDER */}

                      <div className="flex shrink-0 items-center gap-2">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                          {
                            section.sectionOrder
                          }
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={
                              index ===
                                0 ||
                              movingKey !==
                                null
                            }
                            onClick={() =>
                              moveSection(
                                section,
                                "up"
                              )
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
                            title="Move up"
                          >
                            {upBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowUp className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={
                              index ===
                                sections.length -
                                  1 ||
                              movingKey !==
                                null
                            }
                            onClick={() =>
                              moveSection(
                                section,
                                "down"
                              )
                            }
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-25"
                            title="Move down"
                          >
                            {downBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* DETAILS */}

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-slate-900">
                            {
                              section.sectionName
                            }
                          </h3>

                          {section.isSequential ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700">
                              <Check className="h-2.5 w-2.5" />

                              Sequential
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-bold text-slate-400">
                          <span>
                            {
                              section.questionCount
                            }{" "}
                            questions
                          </span>

                          {section.durationMinutes ? (
                            <span>
                              {
                                section.durationMinutes
                              }{" "}
                              min
                            </span>
                          ) : null}

                          {section.timerGroup ? (
                            <span>
                              Timer:{" "}
                              {
                                section.timerGroup
                              }
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* ACTIONS */}

                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            openEdit(
                              section
                            )
                          }
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 hover:bg-slate-50"
                        >
                          <Edit3 className="h-3.5 w-3.5" />

                          Edit
                        </button>

                        <button
                          type="button"
                          disabled={
                            deleting
                          }
                          onClick={() =>
                            deleteSection(
                              section
                            )
                          }
                          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-3 text-xs font-black text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              }
            )}
          </div>
        ) : null}
      </div>

      {/* REFRESH */}

      {!loading &&
      sections.length >
        0 ? (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={
              refreshing
            }
            onClick={() =>
              loadSections({
                background:
                  true,
              })
            }
            className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-slate-700 disabled:cursor-not-allowed"
          >
            <Loader2
              className={`h-3.5 w-3.5 ${
                refreshing
                  ? "animate-spin"
                  : ""
              }`}
            />

            Refresh
          </button>
        </div>
      ) : null}

      <SectionModal
        open={
          modalOpen
        }
        editing={
          editing
        }
        form={
          form
        }
        saving={
          saving
        }
        error={
          formError
        }
        onChange={
          updateForm
        }
        onClose={() =>
          setModalOpen(
            false
          )
        }
        onSubmit={
          handleSubmit
        }
      />
    </section>
  );
}