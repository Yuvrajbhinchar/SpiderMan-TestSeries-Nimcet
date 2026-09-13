"use client";

import {
  useState,
} from "react";

import {
  AlertTriangle,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

import {
  useDispatch,
} from "react-redux";

import {
  useRouter,
} from "next/navigation";

import {
  invalidateTestLibrarySeries,
} from "@/store/testLibrarySlice";

/* =========================================================
   COMPONENT
========================================================= */

export default function TestDeleteButton({
  test,
}) {
  const dispatch =
    useDispatch();

  const router =
    useRouter();

  const [
    open,
    setOpen,
  ] = useState(false);

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================================================
     DELETE
  ========================================================= */

  const handleDelete =
    async () => {
      if (
        deleting ||
        !test?.id ||
        !test?.series
      ) {
        return;
      }

      setDeleting(
        true
      );

      setError("");

      try {
        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              String(
                test.series
              )
            )}/${encodeURIComponent(
              String(
                test.id
              )
            )}/delete`,
            {
              method: "DELETE",

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
              "Unable to delete test."
          );
        }

        /* ---------------------------------------------------
           INVALIDATE STUDENT CACHE
        --------------------------------------------------- */

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
        } else {
          /*
           * Fallback using the current test series.
           */

          dispatch(
            invalidateTestLibrarySeries(
              test.series
            )
          );
        }

        /* ---------------------------------------------------
           GO BACK TO TEST LIST
        --------------------------------------------------- */

        router.replace(
          "/admin/tests"
        );
      } catch (
        deleteError
      ) {
        console.error(
          "Test delete error:",
          deleteError
        );

        setError(
          deleteError?.message ||
            "Unable to delete test."
        );

        setDeleting(
          false
        );
      }
    };

  return (
    <>
      {/* =====================================================
          DELETE BUTTON
      ====================================================== */}

      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3.5 text-xs font-black text-red-600 transition hover:border-red-200 hover:bg-red-100"
      >
        <Trash2 className="h-4 w-4" />

        Delete
      </button>

      {/* =====================================================
          MODAL
      ====================================================== */}

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <div
            className="absolute inset-0"
            onClick={() => {
              if (!deleting) {
                setOpen(false);
              }
            }}
          />

          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.22)]">
            {/* HEADER */}

            <div className="flex items-start justify-between border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-lg font-black text-slate-950">
                    Delete Test?
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    This action permanently removes the test
                    and its dependent content.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  deleting
                }
                onClick={() =>
                  setOpen(
                    false
                  )
                }
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            {/* BODY */}

            <div className="p-5 sm:p-6">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
                  Selected Test
                </p>

                <p className="mt-1 text-sm font-black text-slate-900">
                  {test.title ||
                    "Untitled Test"}
                </p>

                <p className="mt-1 text-[11px] font-medium text-slate-400">
                  {test.seriesName ||
                    test.series}{" "}
                  · ID{" "}
                  {test.id}
                </p>
              </div>

              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-bold text-amber-800">
                  Safety rule
                </p>

                <p className="mt-1 text-[11px] leading-5 text-amber-700">
                  Tests with existing attempts or event
                  records cannot be deleted. Deactivate or
                  unpublish those tests instead.
                </p>
              </div>

              {error ? (
                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-bold leading-5 text-red-600">
                  {error}
                </div>
              ) : null}

              {/* ACTIONS */}

              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={
                    deleting
                  }
                  onClick={() =>
                    setOpen(
                      false
                    )
                  }
                  className="h-11 cursor-pointer rounded-xl px-4 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={
                    deleting
                  }
                  onClick={
                    handleDelete
                  }
                  className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-black text-white shadow-md shadow-red-100 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}

                  {deleting
                    ? "Deleting..."
                    : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}