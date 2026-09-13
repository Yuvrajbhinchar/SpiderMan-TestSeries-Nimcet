"use client";

import {
  useState,
} from "react";

import {
  ArrowDown,
  ArrowUp,
  Loader2,
} from "lucide-react";

import {
  useDispatch,
} from "react-redux";

import {
  invalidateTestLibrarySeries,
} from "@/store/testLibrarySlice";

/* =========================================================
   COMPONENT
========================================================= */

export default function QuestionReorderControls({
  question,
  isFirst,
  isLast,
  onReordered,
}) {
  const dispatch =
    useDispatch();

  const [
    busy,
    setBusy,
  ] = useState(null);

  const [
    error,
    setError,
  ] = useState("");

  async function move(
    direction
  ) {
    if (
      busy ||
      !question?.id ||
      !question?.testId ||
      !question?.series
    ) {
      return;
    }

    if (
      direction ===
        "up" &&
      isFirst
    ) {
      return;
    }

    if (
      direction ===
        "down" &&
      isLast
    ) {
      return;
    }

    setBusy(
      direction
    );

    setError("");

    try {
      const response =
        await fetch(
          `/api/admin/tests/${encodeURIComponent(
            String(
              question.series
            )
          )}/${encodeURIComponent(
            String(
              question.testId
            )
          )}/questions/reorder`,
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
                questionId:
                  Number(
                    question.id
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
            "Unable to reorder question."
        );
      }

      /* -----------------------------------------------------
         CACHE
      ----------------------------------------------------- */

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

      /* -----------------------------------------------------
         NOTIFY PARENT
      ----------------------------------------------------- */

      onReordered?.(
        data
      );
    } catch (
      reorderError
    ) {
      console.error(
        "Question reorder error:",
        reorderError
      );

      setError(
        reorderError?.message ||
          "Unable to reorder question."
      );
    } finally {
      setBusy(
        null
      );
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={
            isFirst ||
            busy !== null
          }
          onClick={() =>
            move("up")
          }
          title="Move up"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ===
          "up" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          disabled={
            isLast ||
            busy !== null
          }
          onClick={() =>
            move("down")
          }
          title="Move down"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ===
          "down" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {error ? (
        <p className="max-w-[180px] text-center text-[9px] font-bold leading-4 text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}