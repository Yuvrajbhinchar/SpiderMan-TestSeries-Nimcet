"use client";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  ChevronDown,
  ClipboardList,
  History,
  LogOut,
  Menu,
  UserRound,
  X,
} from "lucide-react";

import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { clearAuth } from "@/store/authSlice";

function getInitials(displayName) {
  if (!displayName) {
    return "S";
  }

  return displayName
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function DashboardHeader({
  user,
  profileOpen,
  setProfileOpen,
  mobileMenuOpen,
  setMobileMenuOpen,
}) {
  const dispatch = useDispatch();
  const router = useRouter();
  const profileRef = useRef(null);

  const displayName =
    user?.displayName || user?.username || "Student";

  /*
   * Close profile menu when clicking anywhere outside.
   */
  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    if (profileOpen) {
      document.addEventListener(
        "mousedown",
        handleOutsideClick
      );
    }

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, [profileOpen, setProfileOpen]);

  async function handleLogout() {
    setProfileOpen(false);
    setMobileMenuOpen(false);

    try {
      const response = await fetch(
        "/api/auth/logout",
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Logout failed."
        );
      }

      dispatch(clearAuth());

      toast.success(
        "Logged out successfully."
      );

      router.replace("/auth/login");
      router.refresh();
    } catch (error) {
      console.error(
        "Logout error:",
        error
      );

      /*
       * Even if the request fails, local Redux state
       * should not keep showing the user as authenticated.
       */
      dispatch(clearAuth());

      toast.error(
        error.message ||
          "Unable to logout. Please try again."
      );

      router.replace("/auth/login");
    }
  }

  function goHome() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    router.push("/");
  }

  function goProfile() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    router.push("/dashboard/profile");
  }

  function goHistory() {
    setProfileOpen(false);
    setMobileMenuOpen(false);
    router.push("/dashboard/history");
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-white/85 backdrop-blur-2xl">
      <div className="mx-auto flex h-18 max-w-360 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* LOGO */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={goHome}
          className="group flex cursor-pointer items-center gap-3"
          aria-label="Go to dashboard"
        >
          <motion.div
            whileHover={{
              scale: 1.05,
              rotate: -3,
            }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 20,
            }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ef1118] text-lg font-black italic text-white shadow-lg shadow-red-100"
          >
            S
          </motion.div>

          <div className="hidden sm:block">
            <div className="text-[17px] font-extrabold tracking-tight text-slate-950">
              SpiderMan
            </div>

            <div className="text-[10px] font-bold tracking-[0.18em] text-slate-400">
              TEST SERIES
            </div>
          </div>
        </motion.button>

        {/* DESKTOP PROFILE */}
        <div
          ref={profileRef}
          className="relative hidden md:block"
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() =>
              setProfileOpen(
                (value) => !value
              )
            }
            aria-expanded={profileOpen}
            aria-label="Open profile menu"
            className="flex cursor-pointer items-center gap-3 rounded-full border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#ef1118] to-[#b80b11] text-sm font-bold text-white">
              {getInitials(displayName)}
            </div>

            <div className="max-w-32 truncate text-left text-sm font-bold text-slate-800">
              {displayName}
            </div>

            <ChevronDown
              className={`h-4 w-4 text-slate-400 transition-transform ${
                profileOpen
                  ? "rotate-180"
                  : ""
              }`}
            />
          </motion.button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{
                  opacity: 0,
                  y: -8,
                  scale: 0.97,
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1,
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                  scale: 0.97,
                }}
                transition={{
                  duration: 0.18,
                  ease: "easeOut",
                }}
                className="absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
              >
                {/* USER */}
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ef1118] to-[#b80b11] font-bold text-white">
                      {getInitials(
                        displayName
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">
                        {displayName}
                      </p>

                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        @{user?.username ||
                          "student"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    onClick={goProfile}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <UserRound className="h-4 w-4" />
                    <span>Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={goHistory}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    <History className="h-4 w-4" />
                    <span>Test History</span>
                  </button>

                  <div className="my-1 h-px bg-slate-100" />

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* MOBILE MENU */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() =>
            setMobileMenuOpen(
              (value) => !value
            )
          }
          aria-expanded={mobileMenuOpen}
          aria-label={
            mobileMenuOpen
              ? "Close menu"
              : "Open menu"
          }
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 md:hidden"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </motion.button>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: "auto",
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            className="overflow-hidden border-t border-slate-100 bg-white md:hidden"
          >
            <div className="px-4 py-4">
              <div className="mb-3 flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ef1118] to-[#b80b11] font-bold text-white">
                  {getInitials(
                    displayName
                  )}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">
                    {displayName}
                  </p>

                  <p className="truncate text-xs text-slate-400">
                    @{user?.username ||
                      "student"}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={goProfile}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </button>

                <button
                  type="button"
                  onClick={goHistory}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <ClipboardList className="h-4 w-4" />
                  Test History
                </button>

                <div className="my-1 h-px bg-slate-100" />

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-600 transition hover:bg-red-50"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}