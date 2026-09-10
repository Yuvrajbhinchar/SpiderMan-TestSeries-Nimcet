"use client";

import {
  Folder,
  LockKeyhole,
  Sparkles,
} from "lucide-react";
import { motion } from "motion/react";

export default function SeriesCards({
  activeSeries,
  hasSpiderManAccess,
  onSeriesClick,
}) {
  const series = [
    {
      id: "free",
      name: "Free",
      label: "OPEN PRACTICE",
      description:
        "Daily practice, mini tests, mocks and more.",
      icon: Folder,
      featured: false,
      locked: false,
    },
    {
      id: "spiderman",
      name: "SpiderMan",
      label: "PREMIUM SERIES",
      description:
        "Advanced practice built for serious preparation.",
      icon: Sparkles,
      featured: true,
      locked: !hasSpiderManAccess,
    },
  ];

  return (
    <section className="mt-10">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Your preparation
        </p>

        <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Test Series
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Pick a series to continue practicing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {series.map((item) => {
          const Icon = item.icon;
          const active =
            activeSeries === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              onClick={() =>
                onSeriesClick(item.id)
              }
              whileHover={{
                y: -5,
              }}
              whileTap={{
                scale: 0.985,
              }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 24,
              }}
              className={`group relative min-h-44 w-full cursor-pointer overflow-hidden rounded-[28px] border p-6 text-left sm:p-7 ${
                active
                  ? item.featured
                    ? "border-slate-900 bg-slate-950 text-white shadow-[0_24px_70px_rgba(15,23,42,0.20)]"
                    : "border-[#ef1118] bg-white text-slate-900 shadow-[0_18px_50px_rgba(239,17,24,0.10)]"
                  : "border-slate-200 bg-white text-slate-900 shadow-[0_10px_35px_rgba(15,23,42,0.05)] hover:border-slate-300 hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
              }`}
            >
              {/* Background glow */}
              <div
                className={`pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full blur-3xl transition duration-500 group-hover:scale-125 ${
                  active && item.featured
                    ? "bg-[#ef1118]/30"
                    : "bg-red-100/60"
                }`}
              />

              <div
                className={`pointer-events-none absolute -bottom-16 left-1/3 h-36 w-36 rounded-full blur-3xl ${
                  item.featured
                    ? "bg-white/5"
                    : "bg-slate-100"
                }`}
              />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <motion.div
                    animate={{
                      rotate: active ? -3 : 0,
                      scale: active ? 1.05 : 1,
                    }}
                    whileHover={{
                      rotate: -5,
                      scale: 1.08,
                    }}
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      item.featured
                        ? active
                          ? "bg-white/10 text-white"
                          : "bg-slate-100 text-slate-700"
                        : active
                          ? "bg-red-50 text-[#ef1118]"
                          : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    <Icon
                      className="h-6 w-6"
                      strokeWidth={2}
                    />
                  </motion.div>

                  {item.locked ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500">
                      <LockKeyhole className="h-3 w-3" />
                      Premium
                    </span>
                  ) : (
                    <span
                      className={`rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wider ${
                        active && item.featured
                          ? "bg-white/10 text-red-200"
                          : "bg-red-50 text-[#d70d14]"
                      }`}
                    >
                      {active
                        ? "Selected"
                        : "Available"}
                    </span>
                  )}
                </div>

                <div className="mt-7">
                  <p
                    className={`text-[9px] font-black uppercase tracking-[0.2em] ${
                      active && item.featured
                        ? "text-red-300"
                        : "text-[#ef1118]"
                    }`}
                  >
                    {item.label}
                  </p>

                  <h3
                    className={`mt-1 text-2xl font-black tracking-tight ${
                      active && item.featured
                        ? "text-white"
                        : "text-slate-950"
                    }`}
                  >
                    {item.name}
                  </h3>

                  <p
                    className={`mt-2 max-w-md text-sm leading-6 ${
                      active && item.featured
                        ? "text-slate-400"
                        : "text-slate-500"
                    }`}
                  >
                    {item.description}
                  </p>
                </div>

                {/* Active underline */}
                <motion.div
                  animate={{
                    width: active
                      ? "90px"
                      : "0px",
                  }}
                  transition={{
                    duration: 0.35,
                    ease: "easeOut",
                  }}
                  className="absolute -bottom-6 left-0 h-1 rounded-full bg-[#ef1118]"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}