"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  LayoutDashboard,
  ClipboardList,
  HelpCircle,
  Users,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Settings,
} from "lucide-react";

import {
  motion,
  AnimatePresence,
} from "motion/react";

import {
  useRouter,
  usePathname,
} from "next/navigation";

import SpiderManLoader from "@/components/common/SpiderManLoader";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    label: "Tests",
    href: "/admin/tests",
    icon: ClipboardList,
  },
  {
    label: "Questions",
    href: "/admin/questions",
    icon: HelpCircle,
  },
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
  },
  {
    label: "Access",
    href: "/admin/access",
    icon: ShieldCheck,
  },
];

export default function AdminLayout({
  children,
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    authorized,
    setAuthorized,
  ] = useState(false);

  const [
    admin,
    setAdmin,
  ] = useState(null);

  const [
    mobileOpen,
    setMobileOpen,
  ] = useState(false);

  /* =========================================================
     ADMIN AUTH CHECK
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function verifyAdmin() {
      try {
        const response =
          await fetch(
            "/api/admin/me",
            {
              method: "GET",

              credentials:
                "include",

              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        if (
          cancelled
        ) {
          return;
        }

        if (
          !response.ok ||
          !data?.authenticated ||
          data?.admin?.role !==
            "admin"
        ) {
          setAuthorized(
            false
          );

          router.replace(
            "/"
          );

          return;
        }

        setAdmin(
          data.admin
        );

        setAuthorized(
          true
        );
      } catch (error) {
        console.error(
          "Admin verification error:",
          error
        );

        if (
          !cancelled
        ) {
          setAuthorized(
            false
          );

          router.replace(
            "/"
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    verifyAdmin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  /* =========================================================
     LOADING
  ========================================================= */

  if (
    loading ||
    !authorized
  ) {
    return (
      <SpiderManLoader
        text="Verifying Admin Access..."
      />
    );
  }

  /* =========================================================
     SIDEBAR
  ========================================================= */

  const sidebar = (
    <>
      <div className="flex h-20 items-center justify-between border-b border-slate-200 px-6">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin"
            )
          }
          className="cursor-pointer text-left"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#ef1118]">
            SpiderMan
          </p>

          <h1 className="mt-0.5 text-lg font-black tracking-tight text-slate-950">
            Admin Panel
          </h1>
        </button>

        <button
          type="button"
          onClick={() =>
            setMobileOpen(
              false
            )
          }
          className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          aria-label="Close menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {NAV_ITEMS.map(
          (item) => {
            const Icon =
              item.icon;

            const active =
              pathname ===
                item.href ||
              (
                item.href !==
                  "/admin" &&
                pathname?.startsWith(
                  item.href
                )
              );

            return (
              <button
                key={
                  item.href
                }
                type="button"
                onClick={() => {
                  router.push(
                    item.href
                  );

                  setMobileOpen(
                    false
                  );
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold transition ${
                  active
                    ? "bg-red-50 text-[#ef1118]"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />

                {item.label}
              </button>
            );
          }
        )}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="rounded-2xl bg-slate-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
              {String(
                admin?.username ||
                  "A"
              )
                .slice(
                  0,
                  1
                )
                .toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-slate-900">
                {admin?.displayName ||
                  admin?.username ||
                  "Admin"}
              </p>

              <p className="truncate text-[10px] text-slate-400">
                Administrator
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            router.push(
              "/"
            )
          }
          className="mt-2 flex w-full cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-bold text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
        >
          <LogOut className="h-4.5 w-4.5" />

          Exit Admin
        </button>
      </div>
    </>
  );

  /* =========================================================
     MAIN
  ========================================================= */

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-900">
      {/* =====================================================
          MOBILE OVERLAY
      ====================================================== */}

      <AnimatePresence>
        {mobileOpen ? (
          <motion.button
            type="button"
            aria-label="Close menu"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
            onClick={() =>
              setMobileOpen(
                false
              )
            }
            className="fixed inset-0 z-40 cursor-pointer bg-slate-950/30 backdrop-blur-sm lg:hidden"
          />
        ) : null}
      </AnimatePresence>

      {/* =====================================================
          DESKTOP SIDEBAR
      ====================================================== */}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-slate-200 bg-white lg:flex lg:flex-col">
        {sidebar}
      </aside>

      {/* =====================================================
          MOBILE SIDEBAR
      ====================================================== */}

      <AnimatePresence>
        {mobileOpen ? (
          <motion.aside
            initial={{
              x: -280,
            }}
            animate={{
              x: 0,
            }}
            exit={{
              x: -280,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
            className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-slate-200 bg-white shadow-2xl lg:hidden"
          >
            {sidebar}
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <div className="lg:pl-[260px]">
        {/* TOP BAR */}

        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-[72px] items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setMobileOpen(
                    true
                  )
                }
                className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 lg:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
                  Control Center
                </p>

                <h2 className="text-base font-black text-slate-950">
                  Administration
                </h2>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <div className="flex h-9 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-[11px] font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />

                Admin Session Active
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400">
                <Settings className="h-4 w-4" />
              </div>
            </div>
          </div>
        </header>

        {/* PAGE */}

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}