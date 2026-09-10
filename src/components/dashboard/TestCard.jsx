"use client";

import { motion } from "motion/react";
import {
  BarChart3,
  Brain,
  Calculator,
  Code2,
  Languages,
  Play,
} from "lucide-react";

const SUBJECT_META = {
  Mathematics: {
    icon: Calculator,
    short: "Maths",
  },

  Maths: {
    icon: Calculator,
    short: "Maths",
  },

  Reasoning: {
    icon: Brain,
    short: "Reasoning",
  },

  CS: {
    icon: Code2,
    short: "CS",
  },

  "Computer Science": {
    icon: Code2,
    short: "CS",
  },

  English: {
    icon: Languages,
    short: "English",
  },
};

function formatTime(minutes) {
  const value = Number(minutes || 0);

  if (value <= 0) {
    return "Self-paced";
  }

  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (remaining === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remaining} min`;
}

export default function TestCard({
  test,
  onStartTest,
}) {
  const attemptsUsed = Number(
    test?.attemptsUsed || 0
  );

  const attemptsRemaining = Math.max(
    3 - attemptsUsed,
    0
  );

  const attemptsExhausted =
    Boolean(test?.attemptsExhausted) ||
    attemptsRemaining <= 0;

  const subjects = Array.isArray(
    test?.subjects
  )
    ? test.subjects
    : [];

  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{
        duration: 0.2,
      }}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:border-red-200 hover:shadow-[0_18px_45px_rgba(15,23,42,0.08)]"
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-[#ef1118] transition group-hover:bg-red-100">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div
            className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
              attemptsExhausted
                ? "bg-slate-100 text-slate-500"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            Attempts {attemptsUsed}/3
          </div>
        </div>

        <div className="mt-5">
          <h3 className="line-clamp-2 min-h-13 text-base font-extrabold leading-6 text-slate-900">
            {test?.title || "Untitled Test"}
          </h3>

          {test?.description ? (
            <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
              {test.description}
            </p>
          ) : null}

          {subjects.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {subjects.map((subject) => {
                const meta =
                  SUBJECT_META[subject];

                const Icon = meta?.icon;

                return (
                  <span
                    key={subject}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    {Icon ? (
                      <Icon className="h-3 w-3" />
                    ) : null}

                    {meta?.short ||
                      subject}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-y border-slate-100 py-4">
          <div className="pr-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Questions
            </p>

            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {Number(
                test?.totalQuestions || 0
              )}
            </p>
          </div>

          <div className="px-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Marks
            </p>

            <p className="mt-1 text-sm font-extrabold text-[#ef1118]">
              {Number(
                test?.totalMarks || 0
              )}
            </p>
          </div>

          <div className="pl-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              Time
            </p>

            <p className="mt-1 text-sm font-extrabold text-slate-900">
              {formatTime(
                test?.durationMinutes
              )}
            </p>
          </div>
        </div>

        <motion.button
          whileTap={{
            scale: 0.98,
          }}
          type="button"
          disabled={
            attemptsExhausted
          }
          onClick={() =>
            onStartTest?.(test)
          }
          className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] text-sm font-extrabold text-white shadow-md shadow-red-100 transition hover:bg-[#d90e15] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
        >
          <Play className="h-4 w-4 fill-current" />

          {attemptsExhausted
            ? "Attempts Exhausted"
            : test?.hasInProgress
              ? "Resume Test"
              : "Start Test"}
        </motion.button>
      </div>
    </motion.article>
  );
}