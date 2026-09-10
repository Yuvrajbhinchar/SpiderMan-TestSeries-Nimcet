"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";

export default function AccessModal({
  open,
  seriesName = "SpiderMan",
  onClose,
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{
              opacity: 0,
              y: 18,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 18,
              scale: 0.96,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            onClick={(event) =>
              event.stopPropagation()
            }
            className="w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_30px_100px_rgba(15,23,42,0.20)]"
          >
            <div className="relative p-6 sm:p-7">
              <div className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-red-100/70 blur-3xl" />

              <div className="relative">
                <div className="flex items-start justify-between">
                  <motion.div
                    initial={{
                      scale: 0.85,
                    }}
                    animate={{
                      scale: 1,
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-[#ef1118]"
                  >
                    <Sparkles className="h-6 w-6" />
                  </motion.div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <h3 className="mt-5 text-2xl font-black tracking-tight text-slate-950">
                  {seriesName} Access
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  This premium test series is
                  currently available only to
                  students with access.
                </p>

                <div className="mt-5 rounded-2xl bg-slate-50 p-4">
                  <div className="flex gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#ef1118] shadow-sm">
                      <MessageCircle className="h-4.5 w-4.5" />
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-900">
                        Contact Admin
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Send a message on Telegram
                        to request access to the{" "}
                        {seriesName} series.
                      </p>
                    </div>
                  </div>
                </div>

                <a
                  href="https://t.me/SpideyLostInMultiverse"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] text-sm font-extrabold text-white shadow-lg shadow-red-100 transition hover:bg-[#d70d14] hover:shadow-red-200"
                >
                  <MessageCircle className="h-4.5 w-4.5" />
                  Contact @SpideyLostInMultiverse
                </a>

                <button
                  type="button"
                  onClick={onClose}
                  className="mt-2 h-11 w-full cursor-pointer rounded-xl text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                >
                  Maybe later
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}