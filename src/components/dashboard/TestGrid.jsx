"use client";

import { motion } from "motion/react";
import { FileQuestion } from "lucide-react";

import TestCard from "./TestCard";

export default function TestGrid({
  tests = [],
  onStartTest,
}) {
  if (!tests.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
          <FileQuestion className="h-6 w-6" />
        </div>

        <h3 className="mt-4 text-base font-extrabold text-slate-900">
          No tests available yet
        </h3>

        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">
          New tests for this category will appear here as
          soon as they are published.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {tests.map((test, index) => (
        <motion.div
          key={test.id}
          initial={{
            opacity: 0,
            y: 15,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.35,
            delay: Math.min(index * 0.05, 0.3),
          }}
        >
          <TestCard
            test={test}
            onStartTest={onStartTest}
          />
        </motion.div>
      ))}
    </div>
  );
}