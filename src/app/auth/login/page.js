"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import { motion } from "motion/react";

import {
  Eye,
  EyeOff,
  User,
  LockKeyhole,
  ArrowRight,
} from "lucide-react";

import { toast } from "sonner";

import AuthLayout from "@/components/auth/AuthLayout";
import SpiderManLoader from "@/components/common/SpiderManLoader";

const DEVICE_STORAGE_KEY =
  "spiderman_device_id";

export default function LoginPage() {
  const router = useRouter();
  const searchParams =
    useSearchParams();

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [loading, setLoading] =
    useState(false);

  const [
    registeredNotice,
    setRegisteredNotice,
  ] = useState(false);

  useEffect(() => {
    if (
      searchParams.get(
        "registered"
      ) === "1"
    ) {
      setRegisteredNotice(true);

      toast.success(
        "Account created. Please sign in."
      );
    }
  }, [searchParams]);

  function getDeviceId() {
    let deviceId =
      localStorage.getItem(
        DEVICE_STORAGE_KEY
      );

    if (!deviceId) {
      deviceId =
        crypto.randomUUID();

      localStorage.setItem(
        DEVICE_STORAGE_KEY,
        deviceId
      );
    }

    return deviceId;
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const form =
      e.currentTarget;

    const identifier =
      form.identifier.value.trim();

    /*
     * Never trim password.
     */
    const password =
      form.password.value;

    if (!identifier) {
      toast.error(
        "Please enter your username or email."
      );
      return;
    }

    if (!password) {
      toast.error(
        "Please enter your password."
      );
      return;
    }

    try {
      setLoading(true);

      const deviceId =
        getDeviceId();

      const response =
        await fetch(
          "/api/auth/login",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              identifier,
              password,
              deviceId,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to sign in."
        );
      }

      toast.success(
        "Welcome back!"
      );

      /*
       * Root is the dashboard.
       */
      router.replace("/");

      router.refresh();
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      toast.error(
        error.message ||
          "Unable to sign in. Please try again."
      );

      setLoading(false);
    }
  }

  const prefilledIdentifier =
    searchParams.get(
      "identifier"
    ) || "";

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[999]">
          <SpiderManLoader
            text="Signing you in..."
          />
        </div>
      )}

      <AuthLayout
        title={
          <>
            Prepare.
            <br />
            <span className="text-[#ef1118]">
              Practice.
            </span>
            <br />
            Perform.
          </>
        }
        subtitle="Your competitive exam preparation, organized into focused tests, detailed analysis, and smarter practice."
        features={[
          "Practice Tests",
          "Performance Analysis",
          "Smart Preparation",
        ]}
      >
        <div className="mb-7">
          <motion.p
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#d70d14]"
          >
            Welcome back
          </motion.p>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Sign in to SpiderMan
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Continue your preparation
            from where you left off.
          </p>
        </div>

        {registeredNotice && (
          <motion.div
            initial={{
              opacity: 0,
              y: -5,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-semibold text-emerald-700"
          >
            Your account is ready. Sign
            in to continue.
          </motion.div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* IDENTIFIER */}
          <div>
            <label
              htmlFor="identifier"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Username or email
            </label>

            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="identifier"
                name="identifier"
                type="text"
                placeholder="Username or email"
                required
                autoComplete="username"
                defaultValue={
                  prefilledIdentifier
                }
                disabled={loading}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#ef1118] focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Password
            </label>

            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="password"
                name="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-12 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#ef1118] focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowPassword(
                    (value) => !value
                  )
                }
                disabled={loading}
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
              >
                {showPassword ? (
                  <EyeOff className="h-4.5 w-4.5" />
                ) : (
                  <Eye className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* SUBMIT */}
          <motion.button
            whileHover={{
              y: -1,
            }}
            whileTap={{
              scale: 0.99,
            }}
            type="submit"
            disabled={loading}
            className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#ef1118] px-4 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:bg-[#d90f15] hover:shadow-red-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <Link
            href="/auth/register"
            className="font-bold text-[#d70d14] transition-colors hover:text-[#b80b11]"
          >
            Create one
          </Link>
        </p>
      </AuthLayout>
    </>
  );
}