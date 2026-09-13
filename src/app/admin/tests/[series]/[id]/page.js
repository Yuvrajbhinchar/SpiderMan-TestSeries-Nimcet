"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import TestForm from "@/components/admin/TestForm";

import TestStatusControls from "@/components/admin/TestStatusControls";

import TestDeleteButton from "@/components/admin/TestDeleteButton";

import TestSectionsManager from "@/components/admin/TestSectionsManager";

export default function EditTestPage() {
  const params =
    useParams();

  const router =
    useRouter();

  const series =
    String(
      params?.series ||
        ""
    );

  const testId =
    String(
      params?.id ||
        ""
    );

  const [
    test,
    setTest,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  /* =========================================================
     LOAD TEST
  ========================================================= */

  useEffect(() => {
    if (
      !series ||
      !testId
    ) {
      return;
    }

    let cancelled = false;

    async function loadTest() {
      try {
        setLoading(
          true
        );

        setError("");

        const response =
          await fetch(
            `/api/admin/tests/${encodeURIComponent(
              series
            )}/${encodeURIComponent(
              testId
            )}`,
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
              "Unable to load test."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setTest(
          data?.test ||
            null
        );
      } catch (
        loadError
      ) {
        console.error(
          "Admin test load error:",
          loadError
        );

        if (
          !cancelled
        ) {
          setError(
            loadError?.message ||
              "Unable to load test."
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    loadTest();

    return () => {
      cancelled = true;
    };
  }, [
    series,
    testId,
  ]);

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

          Loading test...
        </div>
      </div>
    );
  }

  /* =========================================================
     ERROR
  ========================================================= */

  if (
    error ||
    !test
  ) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <AlertTriangle className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-lg font-black text-slate-950">
            Unable to load test
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {error ||
              "Test not found."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/admin/tests"
              )
            }
            className="mt-6 cursor-pointer rounded-xl bg-[#ef1118] px-5 py-2.5 text-sm font-black text-white"
          >
            Back to Tests
          </button>
        </div>
      </div>
    );
  }

  /* =========================================================
     STATUS UPDATE
  ========================================================= */

  const handleStatusUpdated =
    (
      updatedTest
    ) => {
      if (
        !updatedTest
      ) {
        return;
      }

      setTest(
        (
          previous
        ) => ({
          ...previous,

          ...updatedTest,

          id:
            previous.id,

          series:
            previous.series,

          seriesId:
            previous.seriesId,

          seriesName:
            previous.seriesName,

          categoryId:
            previous.categoryId,

          category:
            previous.category,

          title:
            previous.title,
        })
      );
    };

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div>
      {/* =====================================================
          HEADER
      ====================================================== */}

      <div className="mb-6">
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

        <div className="mt-1.5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">
              {test.title}
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              Manage configuration, structure and availability.
            </p>
          </div>

          <TestDeleteButton
            test={
              test
            }
          />
        </div>
      </div>

      {/* =====================================================
          TEST CONFIG + STATUS
      ====================================================== */}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <TestForm
          mode="edit"
          initialTest={
            test
          }
        />

        <div className="xl:sticky xl:top-24 xl:self-start">
          <TestStatusControls
            test={
              test
            }
            onUpdated={
              handleStatusUpdated
            }
          />

          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Structure
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              Question Management
            </h2>

            <p className="mt-2 text-xs leading-5 text-slate-500">
              Manage sections and questions independently.
            </p>

            <button
              type="button"
              onClick={() =>
                router.push(
                  `/admin/tests/${encodeURIComponent(
                    series
                  )}/${encodeURIComponent(
                    testId
                  )}/questions`
                )
              }
              className="mt-4 w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white transition hover:bg-slate-800"
            >
              Manage Questions
            </button>
          </section>

          <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
              Availability Rule
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              Student Access
            </h2>

            <div className="mt-5 space-y-2">
              <StateRow
                label="Series"
                value="Must be active"
              />

              <StateRow
                label="Category"
                value="Must be active"
              />

              <StateRow
                label="Test"
                value={
                  test.isActive
                    ? "Active"
                    : "Inactive"
                }
              />

              <StateRow
                label="Published"
                value={
                  test.isPublished
                    ? "Published"
                    : "Unpublished"
                }
              />
            </div>
          </section>
        </div>
      </div>

      {/* =====================================================
          SECTIONS
      ====================================================== */}

      <TestSectionsManager
        series={
          series
        }
        testId={
          testId
        }
      />
    </div>
  );
}

/* =========================================================
   STATE ROW
========================================================= */

function StateRow({
  label,
  value,
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-3">
      <span className="text-xs font-bold text-slate-500">
        {label}
      </span>

      <span className="text-xs font-black text-slate-800">
        {value}
      </span>
    </div>
  );
}