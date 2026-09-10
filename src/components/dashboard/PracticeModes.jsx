"use client";

import {
  Radio,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

import { motion } from "motion/react";

const modes = [
  {
    id: "dpp",
    label: "DPP",
    description: "Daily practice",
    icon: Sparkles,
  },
  {
    id: "mini",
    label: "Mini Test",
    description: "Quick practice",
    icon: Zap,
  },
  {
    id: "mock",
    label: "Mock Test",
    description: "Full-length tests",
    icon: Trophy,
  },
  {
    id: "live",
    label: "Live Test",
    description: "Compete live",
    icon: Radio,
  },
];

export default function PracticeModes({
  activeMode,
  onModeChange,
}) {
  return (
    <section className="mt-12">
      <div className="mb-5">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
          Practice
        </p>

        <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          Choose Your Mode
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const active = activeMode === mode.id;

          return (
            <motion.button
              key={mode.id}
              type="button"
              onClick={() => onModeChange?.(mode.id)}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              className={`relative cursor-pointer overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 sm:p-5 ${
                active
                  ? "border-[#ef1118] bg-[#ef1118] text-white shadow-[0_14px_40px_rgba(239,17,24,0.18)]"
                  : "border-slate-200 bg-white text-slate-900 shadow-sm hover:border-slate-300 hover:shadow-md"
              }`}
            >
              {active ? (
                <motion.div
                  layoutId="active-practice-mode"
                  className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-white/10"
                />
              ) : null}

              <div className="relative">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    active
                      ? "bg-white/15"
                      : "bg-slate-50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <h3 className="mt-4 text-sm font-black sm:text-base">
                  {mode.label}
                </h3>

                <p
                  className={`mt-1 text-xs ${
                    active
                      ? "text-red-100"
                      : "text-slate-400"
                  }`}
                >
                  {mode.description}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}