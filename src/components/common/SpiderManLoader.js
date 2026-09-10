"use client";

import { motion } from "motion/react";

export default function SpiderManLoader({
  text = "Loading...",
  fullScreen = true,
}) {
  return (
    <main
      className={`${
        fullScreen ? "min-h-screen" : "min-h-75"
      } flex items-center justify-center bg-[#f7f8fb]`}
    >
      <div className="flex flex-col items-center gap-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{
            duration: 0.35,
            ease: "easeOut",
          }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ef1118] text-xl font-black italic text-white shadow-lg shadow-red-100"
        >
          S
        </motion.div>

        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200">
          <motion.div
            className="h-full w-1/2 rounded-full bg-[#ef1118]"
            animate={{
              x: ["0%", "200%"],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            delay: 0.1,
          }}
          className="text-xs font-semibold tracking-wide text-slate-400"
        >
          {text}
        </motion.p>
      </div>
    </main>
  );
}