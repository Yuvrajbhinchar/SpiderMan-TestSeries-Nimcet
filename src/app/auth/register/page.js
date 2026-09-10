"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import {
  Eye,
  EyeOff,
  User,
  Mail,
  LockKeyhole,
  ArrowRight,
  Check,
} from "lucide-react";

import { toast } from "sonner";

import AuthLayout from "@/components/auth/AuthLayout";
import SpiderManLoader from "@/components/common/SpiderManLoader";

export default function RegisterPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmPassword,
    setShowConfirmPassword,
  ] = useState(false);

  const [agreeTerms, setAgreeTerms] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    const form = e.currentTarget;

    const name =
      form.name.value.trim();

    const username =
      form.username.value.trim();

    const email =
      form.email.value.trim();

    const password =
      form.password.value;

    const confirmPassword =
      form.confirmPassword.value;

    if (!name) {
      toast.error(
        "Please enter your full name."
      );
      return;
    }

    if (
      username.length < 3 ||
      username.length > 30
    ) {
      toast.error(
        "Username must be between 3 and 30 characters."
      );
      return;
    }

    if (
      !/^[a-zA-Z0-9_.-]+$/.test(username)
    ) {
      toast.error(
        "Username can contain only letters, numbers, dot, underscore and hyphen."
      );
      return;
    }

    if (!email) {
      toast.error(
        "Please enter your email address."
      );
      return;
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        email
      )
    ) {
      toast.error(
        "Please enter a valid email address."
      );
      return;
    }

    if (password.length < 6) {
      toast.error(
        "Password must be at least 6 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      toast.error(
        "Passwords do not match."
      );
      return;
    }

    if (!agreeTerms) {
      toast.error(
        "Please agree to the Terms of Service and Privacy Policy."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch(
        "/api/auth/register",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            name,
            username,
            email,
            password,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "Unable to create your account."
        );
      }

      toast.success(
        "Account created successfully!"
      );

      router.replace(
        `/auth/login?registered=1&identifier=${encodeURIComponent(
          username
        )}`
      );
    } catch (error) {
      console.error(
        "Registration error:",
        error
      );

      toast.error(
        error.message ||
          "Unable to create your account."
      );

      setLoading(false);
    }
  }

  return (
    <>
      {loading && (
        <div className="fixed inset-0 z-[999]">
          <SpiderManLoader
            text="Creating your account..."
          />
        </div>
      )}

      <AuthLayout
        title={
          <>
            Start your
            <br />
            <span className="text-[#ef1118]">
              preparation.
            </span>
          </>
        }
        subtitle="Create your SpiderMan account and get access to focused practice, test series, and performance tracking."
        features={[
          "Practice Tests",
          "Detailed Analysis",
          "Smarter Preparation",
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
            Create account
          </motion.p>

          <h2 className="text-3xl font-bold tracking-tight text-slate-900">
            Join SpiderMan
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Create your account and start
            practicing smarter.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* NAME */}
          <div>
            <label
              htmlFor="name"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Full name
            </label>

            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="name"
                name="name"
                type="text"
                placeholder="Your full name"
                required
                autoComplete="name"
                disabled={loading}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#ef1118] focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {/* USERNAME */}
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Username
            </label>

            <div className="relative">
              <User className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                required
                minLength={3}
                maxLength={30}
                autoComplete="username"
                disabled={loading}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#ef1118] focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          </div>

          {/* EMAIL */}
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Email address
            </label>

            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
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
                placeholder="Create a password"
                required
                minLength={6}
                autoComplete="new-password"
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

          {/* CONFIRM PASSWORD */}
          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Confirm password
            </label>

            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />

              <input
                id="confirmPassword"
                name="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                placeholder="Confirm your password"
                required
                minLength={6}
                autoComplete="new-password"
                disabled={loading}
                className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-11 pr-12 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#ef1118] focus:bg-white focus:ring-4 focus:ring-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (value) => !value
                  )
                }
                disabled={loading}
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
                className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4.5 w-4.5" />
                ) : (
                  <Eye className="h-4.5 w-4.5" />
                )}
              </button>
            </div>
          </div>

          {/* TERMS */}
          <div className="pt-1">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-600">
              <button
                type="button"
                onClick={() =>
                  setAgreeTerms(
                    (value) => !value
                  )
                }
                disabled={loading}
                aria-label="Agree to terms"
                className={`mt-0.5 flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border transition-all ${
                  agreeTerms
                    ? "border-[#ef1118] bg-[#ef1118] text-white"
                    : "border-slate-300 bg-white"
                }`}
              >
                {agreeTerms && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </button>

              <span className="text-xs leading-5 text-slate-500">
                I agree to the{" "}
                <span className="font-semibold text-slate-700">
                  Terms of Service
                </span>{" "}
                and{" "}
                <span className="font-semibold text-slate-700">
                  Privacy Policy
                </span>
                .
              </span>
            </label>
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
            Create account
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </form>

        <p className="mt-7 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/auth/login"
            className="font-bold text-[#d70d14] transition-colors hover:text-[#b80b11]"
          >
            Sign in
          </Link>
        </p>
      </AuthLayout>
    </>
  );
}