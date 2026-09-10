"use client";

import {
  Brain,
  Calculator,
  Code2,
  Languages,
} from "lucide-react";

import { motion } from "motion/react";

const subjects = [
  {
    id: "maths",
    name: "Maths",
    icon: Calculator,
  },
  {
    id: "reasoning",
    name: "Reasoning",
    icon: Brain,
  },
  {
    id: "cs",
    name: "CS",
    icon: Code2,
  },
  {
    id: "english",
    name: "English",
    icon: Languages,
  },
];

export default function DPPSubjects({
  activeSubject,
  onSubjectChange,
}) {
  return (
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
        duration: 0.2,
      }}
      className="mt-5"
    >
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {subjects.map((subject) => {
          const Icon = subject.icon;
          const active =
            activeSubject === subject.id;

          return (
            <motion.button
              key={subject.id}
              type="button"
              onClick={() =>
                onSubjectChange?.(subject.id)
              }
              whileTap={{
                scale: 0.97,
              }}
              className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-bold transition-all ${
                active
                  ? "border-slate-900 bg-slate-900 text-white shadow-md shadow-slate-200"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {subject.name}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}