"use client";

import {
  useState,
} from "react";

import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Power,
  PowerOff,
} from "lucide-react";

import {
  invalidateTestLibrarySeries,
} from "@/store/testLibrarySlice";

import {
  useDispatch,
} from "react-redux";

/* =========================================================
   COMPONENT
========================================================= */

export default function TestStatusControls({
  test,
  onUpdated,
}) {
  const dispatch =
    useDispatch();

  const [
    busyAction,
    setBusyAction,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  if (!test) {
    return null;
  }

  /* =======================================================
     ACTION
  ======================================================= */

  const runAction =
    async (
      action
    ) => {
      if (
        busyAction
      ) {
        return;
      }

      setBusyAction(
        action
      );

      setError("");
      setSuccess("");

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
            )}/status`,
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

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              "Unable to update test status."
          );
        }

        /* ---------------------------------------------------
           CACHE INVALIDATION
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
        }

        /* ---------------------------------------------------
           SUCCESS
        --------------------------------------------------- */

        setSuccess(
          data?.message ||
            "Test status updated."
        );

        if (
          data?.test
        ) {
          onUpdated?.(
            data.test
          );
        }
      } catch (
        actionError
      ) {
        console.error(
          "Test status update error:",
          actionError
        );

        setError(
          actionError?.message ||
            "Unable to update test status."
        );
      } finally {
        setBusyAction(
          null
        );
      }
    };

  /* =======================================================
     BUTTON
  ======================================================= */

  const StatusButton =
    ({
      action,
      active,
      icon: Icon,
      title,
      description,
      enabledLabel,
      disabledLabel,
    }) => {
      const busy =
        busyAction ===
        action;

      const disabled =
        busyAction !==
          null ||
        active ===
          (action ===
            "activate" ||
            action ===
              "publish");

      return (
        <button
          type="button"
          disabled={
            disabled
          }
          onClick={() =>
            runAction(
              action
            )
          }
          className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border p-4 text-left transition ${
            active
              ? "border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50"
              : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              active
                ? "bg-emerald-100 text-emerald-700"
                : "bg-white text-slate-400 shadow-sm"
            }`}
          >
            {busy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <Icon className="h-4.5 w-4.5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-900">
              {active
                ? enabledLabel
                : disabledLabel}
            </p>

            <p className="mt-1 text-[11px] leading-5 text-slate-500">
              {description}
            </p>
          </div>
        </button>
      );
    };

  /* =======================================================
     UI
  ======================================================= */

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
        Controls
      </p>

      <h2 className="mt-1 text-lg font-black text-slate-950">
        Test Status
      </h2>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        Control whether students can discover and start
        this test.
      </p>

      {/* ---------------------------------------------------
          ACTIVE
      --------------------------------------------------- */}

      <div className="mt-5">
        <StatusButton
          action={
            test.isActive
              ? "deactivate"
              : "activate"
          }
          active={
            Boolean(
              test.isActive
            )
          }
          icon={
            test.isActive
              ? Power
              : PowerOff
          }
          enabledLabel="Test is active"
          disabledLabel="Test is inactive"
          description={
            test.isActive
              ? "New students can start this test when the other availability rules also pass."
              : "New students cannot start this test. Existing in-progress attempts are not interrupted."
          }
        />
      </div>

      {/* ---------------------------------------------------
          PUBLISHED
      --------------------------------------------------- */}

      <div className="mt-3">
        <StatusButton
          action={
            test.isPublished
              ? "unpublish"
              : "publish"
          }
          active={
            Boolean(
              test.isPublished
            )
          }
          icon={
            test.isPublished
              ? Eye
              : EyeOff
          }
          enabledLabel="Test is published"
          disabledLabel="Test is unpublished"
          description={
            test.isPublished
              ? "The test can appear in student test lists when active and accessible."
              : "The test stays hidden from student discovery."
          }
        />
      </div>

      {/* ---------------------------------------------------
          STATE SUMMARY
      --------------------------------------------------- */}

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
            Active
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-700">
            <CheckCircle2
              className={`h-3.5 w-3.5 ${
                test.isActive
                  ? "text-emerald-600"
                  : "text-slate-300"
              }`}
            />

            {test.isActive
              ? "Yes"
              : "No"}
          </p>
        </div>

        <div className="rounded-xl bg-slate-50 p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
            Published
          </p>

          <p className="mt-1 flex items-center gap-1.5 text-xs font-black text-slate-700">
            <CheckCircle2
              className={`h-3.5 w-3.5 ${
                test.isPublished
                  ? "text-emerald-600"
                  : "text-slate-300"
              }`}
            />

            {test.isPublished
              ? "Yes"
              : "No"}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------
          FEEDBACK
      --------------------------------------------------- */}

      {success ? (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-700">
          {success}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs font-bold text-red-600">
          {error}
        </div>
      ) : null}
    </section>
  );
}