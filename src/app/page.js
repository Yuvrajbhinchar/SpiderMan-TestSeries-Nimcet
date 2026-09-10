"use client";

import {
  useEffect,
  useState,
} from "react";

import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import DashboardHeader from "@/components/dashboard/DashboardHeader";
import SeriesCards from "@/components/dashboard/SeriesCards";
import PracticeModes from "@/components/dashboard/PracticeModes";
import DPPSubjects from "@/components/dashboard/DPPSubjects";
import PracticeLibrary from "@/components/dashboard/PracticeLibrary";
import AccessModal from "@/components/dashboard/AccessModal";
import SpiderManLoader from "@/components/common/SpiderManLoader";

export default function DashboardPage() {
  const router = useRouter();

  const {
    user,
    access,
    loading: authLoading,
    initialized,
  } = useSelector(
    (state) => state.auth
  );

  /*
   * --------------------------------------------------------
   * DASHBOARD STATE
   * --------------------------------------------------------
   */

  const [
    activeSeries,
    setActiveSeries,
  ] = useState("free");

  const [
    activeMode,
    setActiveMode,
  ] = useState("dpp");

  const [
    activeSubject,
    setActiveSubject,
  ] = useState("maths");

  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false);

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] = useState(false);

  const [
    accessModalOpen,
    setAccessModalOpen,
  ] = useState(false);

  /*
   * --------------------------------------------------------
   * AUTH REDIRECT
   * --------------------------------------------------------
   */

  useEffect(() => {
    if (
      initialized &&
      !authLoading &&
      !user
    ) {
      router.replace("/auth/login");
    }
  }, [
    initialized,
    authLoading,
    user,
    router,
  ]);

  /*
   * --------------------------------------------------------
   * SPIDERMAN LOADER
   * --------------------------------------------------------
   *
   * Keep the existing SpiderMan loader during the
   * initial auth/bootstrap phase.
   */

  if (
    !initialized ||
    authLoading
  ) {
    return <SpiderManLoader />;
  }

  /*
   * --------------------------------------------------------
   * NOT AUTHENTICATED
   * --------------------------------------------------------
   */

  if (!user) {
    return (
      <main className="min-h-screen bg-[#f7f8fb]" />
    );
  }

  /*
   * --------------------------------------------------------
   * SERIES SELECTION
   * --------------------------------------------------------
   */

  const handleSeriesClick = (
    selectedSeries
  ) => {
    const slug =
      typeof selectedSeries === "string"
        ? selectedSeries
        : selectedSeries?.slug;

    if (!slug) {
      return;
    }

    /*
     * SpiderMan is premium.
     * Open access modal when the user
     * doesn't have active access.
     */
    if (
      slug === "spiderman" &&
      !access?.spiderman
    ) {
      setAccessModalOpen(true);
      return;
    }

    /*
     * Dashboard only supports these two
     * series.
     */
    if (
      slug !== "free" &&
      slug !== "spiderman"
    ) {
      return;
    }

    setActiveSeries(slug);

    /*
     * Reset practice selection whenever
     * the series changes.
     */
    setActiveMode("dpp");
    setActiveSubject("maths");

    setMobileMenuOpen(false);
    setAccessModalOpen(false);
  };

  /*
   * --------------------------------------------------------
   * PRACTICE MODE
   * --------------------------------------------------------
   */

  const handleModeChange = (
    mode
  ) => {
    if (!mode) {
      return;
    }

    setActiveMode(mode);

    /*
     * Subject filter only applies to DPP.
     * Reset to Maths whenever returning to DPP.
     */
    if (mode === "dpp") {
      setActiveSubject("maths");
    }
  };

  /*
   * --------------------------------------------------------
   * DPP SUBJECT
   * --------------------------------------------------------
   */

  const handleSubjectChange = (
    subject
  ) => {
    if (!subject) {
      return;
    }

    setActiveSubject(subject);
  };

  /*
   * --------------------------------------------------------
   * START TEST
   * --------------------------------------------------------
   */

   /*
  |--------------------------------------------------------------------------
  | START TEST
  |--------------------------------------------------------------------------
  */

  const handleStartTest = (test) => {
    if (!test?.id) {
      return;
    }

    const testSeries =
      test?.series ||
      activeSeries ||
      "free";

    router.push(
      `/test/${encodeURIComponent(
        testSeries
      )}/${encodeURIComponent(
        test.id
      )}/instructions`
    );
  };

  /*
   * --------------------------------------------------------
   * PROFILE
   * --------------------------------------------------------
   */

  const handleProfile = () => {
    setProfileOpen(false);
    setMobileMenuOpen(false);

    router.push(
      "/dashboard/profile"
    );
  };

  /*
   * --------------------------------------------------------
   * HISTORY
   * --------------------------------------------------------
   */

  const handleHistory = () => {
    setProfileOpen(false);
    setMobileMenuOpen(false);

    router.push(
      "/dashboard/history"
    );
  };

  /*
   * --------------------------------------------------------
   * DISPLAY NAME
   * --------------------------------------------------------
   */

  const displayName =
    user?.displayName ||
    user?.username ||
    "Student";

  /*
   * --------------------------------------------------------
   * UI
   * --------------------------------------------------------
   */

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-slate-900">
      {/* ------------------------------------------------------ */}
      {/* HEADER                                                 */}
      {/* ------------------------------------------------------ */}

      <DashboardHeader
        user={user}
        displayName={displayName}
        profileOpen={profileOpen}
        setProfileOpen={
          setProfileOpen
        }
        mobileMenuOpen={
          mobileMenuOpen
        }
        setMobileMenuOpen={
          setMobileMenuOpen
        }
        handleHistory={
          handleHistory
        }
        handleProfile={
          handleProfile
        }
      />

      <div className="mx-auto max-w-360 px-4 py-7 sm:px-6 lg:px-8 lg:py-9">
        {/* ---------------------------------------------------- */}
        {/* HERO                                                 */}
        {/* ---------------------------------------------------- */}

        <section className="mb-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ef1118]">
            SpiderMan Test Series
          </p>

          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Hey, {displayName} 👋
          </h1>

          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Practice smarter, track your attempts,
            and improve one test at a time.
          </p>
        </section>

        {/* ---------------------------------------------------- */}
        {/* SERIES CARDS                                         */}
        {/* ---------------------------------------------------- */}

        <SeriesCards
          activeSeries={activeSeries}
          hasSpiderManAccess={
            Boolean(access?.spiderman)
          }
          onSeriesClick={
            handleSeriesClick
          }
        />

        {/* ---------------------------------------------------- */}
        {/* SELECTED SERIES CONTENT                              */}
        {/* ---------------------------------------------------- */}

        <motion.section
          key={activeSeries}
          initial={{
            opacity: 0,
            y: 10,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.25,
          }}
          className="mt-8"
        >
          {/* Series title */}

          <div className="mb-5">
            <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              {activeSeries ===
              "spiderman"
                ? "SpiderMan"
                : "Free"}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Choose how you want to practice.
            </p>
          </div>

          {/* -------------------------------------------------- */}
          {/* PRACTICE MODES                                     */}
          {/* -------------------------------------------------- */}

          <PracticeModes
            activeMode={activeMode}
            onModeChange={
              handleModeChange
            }
          />

          {/* -------------------------------------------------- */}
          {/* DPP SUBJECTS                                       */}
          {/* -------------------------------------------------- */}

          {activeMode === "dpp" ? (
            <DPPSubjects
              activeSubject={
                activeSubject
              }
              onSubjectChange={
                handleSubjectChange
              }
            />
          ) : null}

          {/* -------------------------------------------------- */}
          {/* PRACTICE LIBRARY                                   */}
          {/* -------------------------------------------------- */}

          <PracticeLibrary
            activeSeries={
              activeSeries
            }
            activeMode={
              activeMode
            }
            activeSubject={
              activeSubject
            }
            onStartTest={
              handleStartTest
            }
          />
        </motion.section>
      </div>

      {/* ------------------------------------------------------ */}
      {/* PREMIUM ACCESS MODAL                                   */}
      {/* ------------------------------------------------------ */}

      <AccessModal
        open={accessModalOpen}
        seriesName="SpiderMan"
        onClose={() =>
          setAccessModalOpen(false)
        }
      />
    </main>
  );
}
