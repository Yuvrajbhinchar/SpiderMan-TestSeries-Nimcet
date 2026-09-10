"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChartNoAxesCombined,
  ClipboardList,
  History,
  RefreshCw,
} from "lucide-react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SpiderManLoader from "@/components/common/SpiderManLoader";

export default function TestHistoryPage() {
  const router = useRouter();

  const {
    user,
    loading: authLoading,
    initialized,
  } = useSelector((state) => state.auth);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (initialized && !authLoading && !user) {
      router.replace("/auth/login");
    }
  }, [initialized, authLoading, user, router]);

  useEffect(() => {
    if (!initialized || authLoading || !user) {
      return;
    }

    loadHistory();
  }, [initialized, authLoading, user]);

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/dashboard/history?limit=100",
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load test history."
        );
      }

      setHistory(
        Array.isArray(data?.history)
          ? data.history
          : []
      );
    } catch (err) {
      console.error("History loading error:", err);

      setError(
        err?.message ||
          "Unable to load test history."
      );
    } finally {
      setLoading(false);
    }
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "—";
    }

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  function getPercentage(item) {
    const score = Number(item?.score || 0);
    const totalMarks = Number(
      item?.totalMarks || 0
    );

    if (totalMarks <= 0) {
      return 0;
    }

    return Math.round(
      (score / totalMarks) * 100
    );
  }

  function getSeriesStyle(slug) {
    const value = String(slug || "").toLowerCase();

    if (value === "spiderman") {
      return {
        badge:
          "border-red-100 bg-red-50 text-red-600",
        dot: "bg-red-500",
      };
    }

    if (value === "asspire") {
      return {
        badge:
          "border-violet-100 bg-violet-50 text-violet-600",
        dot: "bg-violet-500",
      };
    }

    if (value === "imppetus") {
      return {
        badge:
          "border-amber-100 bg-amber-50 text-amber-600",
        dot: "bg-amber-500",
      };
    }

    return {
      badge:
        "border-blue-100 bg-blue-50 text-blue-600",
      dot: "bg-blue-500",
    };
  }

  function handleDashboard() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
  }

  function handleHistory() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }

  function handleProfile() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    router.push("/dashboard/profile");
  }

  function handleLogout() {
    setProfileOpen(false);
    setMobileMenuOpen(false);

    router.post?.("/api/auth/logout");
  }

  function handleResult(item) {
    if (
      !item?.attemptId ||
      !item?.testId ||
      !item?.series?.slug
    ) {
      return;
    }

    router.push(
      `/test/${encodeURIComponent(
        item.series.slug
      )}/${encodeURIComponent(
        item.testId
      )}/result?attemptId=${encodeURIComponent(
        item.attemptId
      )}`
    );
  }

  function handleAnalysis(item) {
    if (
      !item?.attemptId ||
      !item?.testId ||
      !item?.series?.slug
    ) {
      return;
    }

    router.push(
      `/test/${encodeURIComponent(
        item.series.slug
      )}/${encodeURIComponent(
        item.testId
      )}/analysis?attemptId=${encodeURIComponent(
        item.attemptId
      )}`
    );
  }

  if (!initialized || authLoading) {
    return <SpiderManLoader />;
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f8fb]" />
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f7f8fb]">
        <DashboardHeader
          user={user}
          displayName={
            user?.displayName ||
            user?.email?.split("@")[0] ||
            "Student"
          }
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          handleLogout={handleLogout}
          handleHistory={handleHistory}
          handleProfile={handleProfile}
        />

        <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
          <SpiderManLoader />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-[#f7f8fb]">
        <DashboardHeader
          user={user}
          displayName={
            user?.displayName ||
            user?.email?.split("@")[0] ||
            "Student"
          }
          profileOpen={profileOpen}
          setProfileOpen={setProfileOpen}
          mobileMenuOpen={mobileMenuOpen}
          setMobileMenuOpen={setMobileMenuOpen}
          handleLogout={handleLogout}
          handleHistory={handleHistory}
          handleProfile={handleProfile}
        />

        <div className="flex min-h-[calc(100vh-72px)] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
              <History className="h-6 w-6" />
            </div>

            <h1 className="mt-5 text-xl font-black text-slate-900">
              Unable to load history
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={loadHistory}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-600"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-900">
      <DashboardHeader
        user={user}
        displayName={
          user?.displayName ||
          user?.email?.split("@")[0] ||
          "Student"
        }
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        handleLogout={handleLogout}
        handleHistory={handleHistory}
        handleProfile={handleProfile}
      />

      <section className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={handleDashboard}
              className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
                <History className="h-5 w-5" />
              </div>

              <div>
                <h1 className="text-[28px] font-black tracking-[-0.04em] text-slate-950 sm:text-[32px]">
                  Your Attempts
                </h1>

                <p className="mt-1 text-sm font-medium text-slate-500">
                  Review your completed tests.
                </p>
              </div>
            </div>
          </div>

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-500 shadow-[0_8px_22px_rgba(15,23,42,0.05)]">
            <ClipboardList className="h-3.5 w-3.5" />
            {history.length}{" "}
            {history.length === 1
              ? "Attempt"
              : "Attempts"}
          </div>
        </div>

        {history.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[0_14px_45px_rgba(15,23,42,0.06)]"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
              <ClipboardList className="h-7 w-7" />
            </div>

            <h2 className="mt-5 text-xl font-black text-slate-900">
              No attempts yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Complete a test and your attempt history
              will appear here.
            </p>

            <button
              type="button"
              onClick={handleDashboard}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_22px_rgba(15,23,42,0.15)] transition hover:-translate-y-0.5 hover:bg-blue-600"
            >
              Browse Tests
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {history.map((item, index) => {
              const percentage =
                getPercentage(item);

              const seriesStyle =
                getSeriesStyle(
                  item?.series?.slug
                );

              return (
                <motion.article
                  key={item.attemptId}
                  initial={{
                    opacity: 0,
                    y: 14,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(index * 0.04, 0.3),
                  }}
                  className="group relative"
                >
                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px rounded-3xl bg-linear-to-r from-blue-200 via-slate-100 to-blue-200 opacity-0 blur-[1px] group-hover:opacity-100"
                    animate={{
                      opacity: [0.35, 0.7, 0.35],
                    }}
                    transition={{
                      duration: 2.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />

                  <div className="relative rounded-[23px] border border-slate-200 bg-white px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.07)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:shadow-[0_20px_50px_rgba(37,99,235,0.13)] sm:px-6 sm:py-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2.5 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.08em] ${seriesStyle.badge}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${seriesStyle.dot}`}
                            />

                            {item?.series?.name ||
                              "Test"}
                          </span>

                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                            Attempt #
                            {
                              item.attemptNumber
                            }
                          </span>
                        </div>

                        <h2 className="truncate text-[17px] font-extrabold tracking-[-0.02em] text-slate-950 sm:text-[19px]">
                          {item?.test?.title ||
                            "Untitled Test"}
                        </h2>

                        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span>
                            {formatDate(
                              item?.submittedAt ||
                                item?.createdAt
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 sm:gap-8 lg:min-w-55 lg:justify-center">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                            Score
                          </p>

                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-[21px] font-black text-slate-900">
                              {Number(
                                item?.score || 0
                              )}
                            </span>

                            <span className="text-sm font-semibold text-slate-400">
                              /
                              {Number(
                                item?.totalMarks || 0
                              )}
                            </span>
                          </div>
                        </div>

                        <div className="h-9 w-px bg-slate-200" />

                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
                            Percentage
                          </p>

                          <p className="mt-1 text-[21px] font-black text-blue-600">
                            {percentage}%
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleResult(item)
                          }
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                        >
                          Result
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleAnalysis(item)
                          }
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-600 hover:shadow-[0_10px_24px_rgba(37,99,235,0.22)]"
                        >
                          Analysis
                          <ChartNoAxesCombined className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}