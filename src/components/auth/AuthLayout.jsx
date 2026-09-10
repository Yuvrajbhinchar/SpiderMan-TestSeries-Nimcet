"use client";

import { motion } from "motion/react";

export default function AuthLayout({
  children,
  title,
  subtitle,
  features = [],
}) {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f9fc] text-slate-900">
      <div className="relative min-h-screen">
        {/* ============================================================ */}
        {/* BACKGROUND */}
        {/* ============================================================ */}

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-red-100/60 blur-3xl" />

          <div className="absolute -bottom-40 -right-20 h-[28rem] w-[28rem] rounded-full bg-slate-200/60 blur-3xl" />

          <div className="absolute left-[38%] top-[42%] h-72 w-72 rounded-full bg-white/80 blur-3xl" />
        </div>

        {/* ============================================================ */}
        {/* MAIN LAYOUT */}
        {/* ============================================================ */}

        <div className="relative mx-auto min-h-screen max-w-[1500px] px-4 sm:px-6 lg:px-8 xl:px-10">
          <div className="grid min-h-screen grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_500px] lg:gap-10">
            {/* ======================================================== */}
            {/* LEFT SIDE */}
            {/* ======================================================== */}

            <section className="relative flex min-h-screen flex-col px-4 pb-12 pt-8 sm:px-6 sm:pt-10 lg:px-8 lg:pb-14 lg:pt-12 xl:px-10">
              {/* ==================================================== */}
              {/* LOGO */}
              {/* ==================================================== */}

              <motion.button
                type="button"
                onClick={() => {
                  window.location.href = "/";
                }}
                initial={{
                  opacity: 0,
                  y: -6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.35,
                  ease: "easeOut",
                }}
                whileTap={{
                  scale: 0.97,
                }}
                className="group flex w-fit cursor-pointer items-center gap-3"
                aria-label="Go to dashboard"
              >
                <motion.div
                  whileHover={{
                    scale: 1.05,
                    rotate: -3,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 360,
                    damping: 20,
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ef1118] text-lg font-black italic text-white shadow-[0_10px_28px_rgba(239,17,24,0.20)]"
                >
                  S
                </motion.div>

                <div className="text-left">
                  <div className="text-[17px] font-extrabold tracking-tight text-slate-950">
                    SpiderMan
                  </div>

                  <div className="text-[9px] font-bold tracking-[0.22em] text-slate-400">
                    TEST SERIES
                  </div>
                </div>
              </motion.button>

              {/* ==================================================== */}
              {/* HERO */}
              {/* ==================================================== */}

              <div className="flex flex-1 items-start pt-24 sm:pt-28 lg:pt-24 xl:pt-28">
                <div className="max-w-2xl">
                  <motion.p
                    initial={{
                      opacity: 0,
                      y: 10,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: 0.05,
                      duration: 0.4,
                    }}
                    className="mb-5 text-[10px] font-black uppercase tracking-[0.24em] text-[#d70d14]"
                  >
                    Competitive preparation
                  </motion.p>

                  <motion.h1
                    initial={{
                      opacity: 0,
                      y: 18,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: 0.08,
                      duration: 0.5,
                      ease: "easeOut",
                    }}
                    className="max-w-2xl text-[52px] font-black leading-[0.94] tracking-[-0.055em] text-slate-950 sm:text-[64px] lg:text-[68px] xl:text-[76px]"
                  >
                    {title}
                  </motion.h1>

                  <motion.p
                    initial={{
                      opacity: 0,
                      y: 12,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay: 0.16,
                      duration: 0.45,
                    }}
                    className="mt-7 max-w-xl text-sm leading-7 text-slate-500 sm:text-[15px]"
                  >
                    {subtitle}
                  </motion.p>

                  {/* ================================================== */}
                  {/* FEATURES */}
                  {/* ================================================== */}

                  {features.length > 0 && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 12,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      transition={{
                        delay: 0.22,
                        duration: 0.45,
                      }}
                      className="mt-8 flex flex-wrap gap-2.5"
                    >
                      {features.map(
                        (feature, index) => (
                          <motion.div
                            key={feature}
                            initial={{
                              opacity: 0,
                              y: 8,
                            }}
                            animate={{
                              opacity: 1,
                              y: 0,
                            }}
                            transition={{
                              delay:
                                0.25 +
                                index * 0.06,
                              duration: 0.3,
                            }}
                            whileHover={{
                              y: -2,
                            }}
                            className="cursor-default rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-[0_5px_18px_rgba(15,23,42,0.04)] transition-shadow duration-200 hover:shadow-md"
                          >
                            {feature}
                          </motion.div>
                        )
                      )}
                    </motion.div>
                  )}
                </div>
              </div>

              {/* ==================================================== */}
              {/* FOOTER */}
              {/* ==================================================== */}

              <motion.p
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.35,
                  duration: 0.35,
                }}
                className="text-xs font-medium text-slate-400"
              >
                Practice. Analyze. Improve.
              </motion.p>
            </section>

            {/* ======================================================== */}
            {/* RIGHT SIDE */}
            {/* ======================================================== */}

            <section className="relative px-0 pb-6 sm:px-2 lg:px-0 lg:py-6">
              {/* ==================================================== */}
              {/* MOBILE LOGO */}
              {/* ==================================================== */}

              <motion.div
                initial={{
                  opacity: 0,
                  y: -6,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                }}
                transition={{
                  duration: 0.3,
                }}
                className="mb-6 flex lg:hidden"
              >
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = "/";
                  }}
                  className="flex cursor-pointer items-center gap-3"
                  aria-label="Go to dashboard"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef1118] text-lg font-black italic text-white shadow-[0_10px_25px_rgba(239,17,24,0.18)]">
                    S
                  </div>

                  <div className="text-left">
                    <div className="text-base font-extrabold tracking-tight text-slate-950">
                      SpiderMan
                    </div>

                    <div className="text-[9px] font-bold tracking-[0.2em] text-slate-400">
                      TEST SERIES
                    </div>
                  </div>
                </button>
              </motion.div>

              {/* ==================================================== */}
              {/* FLOATING FORM CARD */}
              {/* ==================================================== */}

              <motion.div
                initial={{
                  opacity: 0,
                  x: 18,
                  y: 12,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                  y: 0,
                }}
                transition={{
                  duration: 0.45,
                  ease: "easeOut",
                }}
                className="relative min-h-[calc(100vh-48px)] overflow-hidden rounded-[30px] border border-slate-200/90 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl lg:sticky lg:top-6"
              >
                {/* Card glow */}
                <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-red-50 blur-3xl" />

                <div className="pointer-events-none absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-slate-100 blur-3xl" />

                <div className="relative flex min-h-full items-center px-7 py-8 sm:px-9 lg:px-10 xl:px-11">
                  <div className="w-full">
                    {children}
                  </div>
                </div>
              </motion.div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}