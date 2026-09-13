"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  ClipboardList,
  Users,
  ShieldCheck,
  Activity,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

import {
  motion,
} from "motion/react";

import {
  useRouter,
} from "next/navigation";

import SpiderManLoader from "@/components/common/SpiderManLoader";

export default function AdminDashboardPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    admin,
    setAdmin,
  ] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAdmin() {
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
          !data?.authenticated
        ) {
          router.replace(
            "/"
          );

          return;
        }

        setAdmin(
          data.admin
        );
      } catch (
        loadError
      ) {
        console.error(
          "Admin dashboard load error:",
          loadError
        );

        if (
          !cancelled
        ) {
          setError(
            "Unable to load admin dashboard."
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

    loadAdmin();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (loading) {
    return (
      <SpiderManLoader
        text="Loading Admin Panel..."
      />
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#ef1118]">
            <Activity className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-lg font-black text-slate-950">
            Unable to load dashboard
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {error}
          </p>
        </div>
      </div>
    );
  }

  const cards = [
    {
      title: "Test Management",
      description:
        "Create, edit, publish and control your test series.",
      value: "Coming next",
      icon: ClipboardList,
      href: "/admin/tests",
    },
    {
      title: "User Management",
      description:
        "View users and manage account status.",
      value: "Coming next",
      icon: Users,
      href: "/admin/users",
    },
    {
      title: "Series Access",
      description:
        "Grant and revoke access to paid series.",
      value: "Coming next",
      icon: ShieldCheck,
      href: "/admin/access",
    },
  ];

  return (
    <div>
      {/* =====================================================
          HERO
      ====================================================== */}

      <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-100/70 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-[#ef1118]">
            <CheckCircle2 className="h-3 w-3" />

            Secure Admin Area
          </div>

          <h1 className="mt-5 max-w-3xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Welcome back,
            {" "}
            {admin?.displayName ||
              admin?.username ||
              "Admin"}
            .
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            This is your SpiderMan control
            center. Tests, questions, users,
            access and live events will be
            managed from here.
          </p>
        </div>
      </section>

      {/* =====================================================
          MODULE CARDS
      ====================================================== */}

      <section className="mt-8">
        <div className="mb-5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ef1118]">
            Management
          </p>

          <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
            Admin Modules
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map(
            (
              card,
              index
            ) => {
              const Icon =
                card.icon;

              return (
                <motion.button
                  key={
                    card.title
                  }
                  type="button"
                  initial={{
                    opacity: 0,
                    y: 10,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    duration:
                      0.25,
                    delay:
                      index *
                      0.05,
                  }}
                  whileHover={{
                    y: -4,
                  }}
                  whileTap={{
                    scale: 0.985,
                  }}
                  onClick={() =>
                    router.push(
                      card.href
                    )
                  }
                  className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md"
                >
                  <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-red-50 blur-2xl transition-transform duration-500 group-hover:scale-125" />

                  <div className="relative">
                    <div className="flex items-start justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-[#ef1118]">
                        <Icon className="h-5 w-5" />
                      </div>

                      <ArrowRight className="h-4.5 w-4.5 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-[#ef1118]" />
                    </div>

                    <h3 className="mt-5 text-base font-black text-slate-950">
                      {card.title}
                    </h3>

                    <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">
                      {card.description}
                    </p>

                    <p className="mt-5 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                      {card.value}
                    </p>
                  </div>
                </motion.button>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}