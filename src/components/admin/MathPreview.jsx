"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  Sigma,
} from "lucide-react";

import MathText from "@/components/common/MathText";

import {
  hasMath,
  validateMathText,
} from "@/lib/mathText";

/* =========================================================
   MATH PREVIEW
   ---------------------------------------------------------
   Shows the admin exactly what the student will see for a
   question / option / explanation string, plus a plain-English
   error if the LaTeX is broken.

   It only appears once the field actually contains math, so
   plain text questions get no extra UI noise.
========================================================= */

export default function MathPreview({
  value,
  label = "Live preview",
  compact = false,
}) {
  const text = String(value || "");

  const containsMath = useMemo(
    () => hasMath(text),
    [text]
  );

  const validation = useMemo(
    () =>
      containsMath
        ? validateMathText(text)
        : {
            ok: true,
            count: 0,
            errors: [],
          },
    [text, containsMath]
  );

  if (!containsMath) {
    return null;
  }

  return (
    <div
      className={`rounded-2xl border ${
        validation.ok
          ? "border-slate-200 bg-slate-50"
          : "border-amber-200 bg-amber-50"
      } ${
        compact
          ? "mt-2 px-3 py-2.5"
          : "mt-3 px-4 py-3.5"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <Sigma
          className={`h-3.5 w-3.5 ${
            validation.ok
              ? "text-slate-400"
              : "text-amber-600"
          }`}
        />

        <span
          className={`text-[10px] font-black uppercase tracking-[0.16em] ${
            validation.ok
              ? "text-slate-400"
              : "text-amber-600"
          }`}
        >
          {label}
        </span>

        <span className="ml-auto text-[10px] font-bold text-slate-400">
          {validation.count}{" "}
          {validation.count === 1
            ? "expression"
            : "expressions"}
        </span>
      </div>

      <MathText
        text={text}
        className={`mt-2.5 whitespace-pre-wrap leading-7 text-slate-800 ${
          compact
            ? "text-sm"
            : "text-[15px]"
        }`}
      />

      {!validation.ok ? (
        <div className="mt-3 space-y-1.5 border-t border-amber-200 pt-2.5">
          {validation.errors.map(
            (
              error,
              index
            ) => (
              <div
                key={index}
                className="flex items-start gap-1.5 text-[11px] leading-5 text-amber-800"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />

                <span>
                  <span className="font-mono font-bold">
                    {error.expression}
                  </span>

                  {" — "}

                  {error.message}
                </span>
              </div>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

/* =========================================================
   CHEAT SHEET
========================================================= */

const SNIPPETS = [
  {
    group: "Basics",
    items: [
      {
        label: "Inline math",
        code: "$x^2 + y^2 = r^2$",
      },
      {
        label: "Display math (own line)",
        code: "$$\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$$",
      },
      {
        label: "Fraction",
        code: "$\\frac{a}{b}$",
      },
      {
        label: "Power / index",
        code: "$a^{n+1}$ and $a_{i,j}$",
      },
      {
        label: "Root",
        code: "$\\sqrt{x}$, $\\sqrt[3]{x}$",
      },
      {
        label: "Literal dollar sign",
        code: "\\$500",
      },
    ],
  },
  {
    group: "Matrices & determinants",
    items: [
      {
        label: "Bracket matrix",
        code: "$$\\begin{bmatrix} 1 & 2 \\\\ 3 & 4 \\end{bmatrix}$$",
      },
      {
        label: "Paren matrix",
        code: "$$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$",
      },
      {
        label: "Determinant",
        code: "$$\\begin{vmatrix} 1 & 2 \\\\ 3 & 4 \\end{vmatrix} = -2$$",
      },
      {
        label: "3x3 with dots",
        code: "$$\\begin{bmatrix} a_{11} & \\cdots & a_{1n} \\\\ \\vdots & \\ddots & \\vdots \\\\ a_{m1} & \\cdots & a_{mn} \\end{bmatrix}$$",
      },
    ],
  },
  {
    group: "Calculus & series",
    items: [
      {
        label: "Integral",
        code: "$$\\int_{0}^{1} x^2 \\, dx = \\frac{1}{3}$$",
      },
      {
        label: "Summation",
        code: "$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$",
      },
      {
        label: "Derivative",
        code: "$\\frac{dy}{dx}$, $\\frac{\\partial f}{\\partial x}$",
      },
      {
        label: "Limit",
        code: "$\\lim_{n \\to \\infty} a_n$",
      },
    ],
  },
  {
    group: "Sets, logic & misc",
    items: [
      {
        label: "Set / interval",
        code: "$A \\cup B$, $A \\cap B$, $x \\in [0, 1)$",
      },
      {
        label: "Cases",
        code: "$$f(x) = \\begin{cases} x & x \\ge 0 \\\\ -x & x < 0 \\end{cases}$$",
      },
      {
        label: "Aligned steps",
        code: "$$\\begin{aligned} (a+b)^2 &= a^2 + 2ab + b^2 \\\\ &= a^2 + b^2 + 2ab \\end{aligned}$$",
      },
      {
        label: "Greek & symbols",
        code: "$\\alpha, \\beta, \\theta, \\pi, \\infty, \\neq, \\le, \\ge, \\approx$",
      },
      {
        label: "Text inside math",
        code: "$x = 5 \\text{ cm}$",
      },
      {
        label: "Degrees",
        code: "$90\\degree$",
      },
    ],
  },
];

export function MathCheatSheet() {
  const [open, setOpen] =
    useState(false);

  const [copied, setCopied] =
    useState("");

  const copy = async (
    code
  ) => {
    try {
      await navigator.clipboard.writeText(
        code
      );

      setCopied(code);

      setTimeout(
        () => setCopied(""),
        1500
      );
    } catch (error) {
      console.error(
        "Clipboard copy failed:",
        error
      );
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <button
        type="button"
        onClick={() =>
          setOpen(
            (previous) =>
              !previous
          )
        }
        className="flex w-full cursor-pointer items-center gap-2 text-left"
      >
        <Sigma className="h-4 w-4 text-[#ef1118]" />

        <span className="text-sm font-black text-slate-900">
          Math / LaTeX help
        </span>

        <ChevronDown
          className={`ml-auto h-4 w-4 text-slate-400 transition ${
            open
              ? "rotate-180"
              : ""
          }`}
        />
      </button>

      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        Wrap math in{" "}
        <code className="rounded bg-slate-100 px-1 font-mono">
          $...$
        </code>{" "}
        for inline, or{" "}
        <code className="rounded bg-slate-100 px-1 font-mono">
          $$...$$
        </code>{" "}
        for a centred line. Everything outside the
        dollars stays normal text. Diagrams and
        figures still go in the image field.
      </p>

      {open ? (
        <div className="mt-4 space-y-4">
          {SNIPPETS.map(
            (section) => (
              <div
                key={
                  section.group
                }
              >
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                  {section.group}
                </p>

                <div className="mt-2 space-y-2">
                  {section.items.map(
                    (item) => (
                      <div
                        key={
                          item.label
                        }
                        className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-600">
                            {
                              item.label
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              copy(
                                item.code
                              )
                            }
                            className="ml-auto flex cursor-pointer items-center gap-1 rounded-lg bg-white px-2 py-1 text-[10px] font-black text-slate-500 transition hover:text-slate-800"
                          >
                            {copied ===
                            item.code ? (
                              <Check className="h-3 w-3 text-emerald-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}

                            {copied ===
                            item.code
                              ? "Copied"
                              : "Copy"}
                          </button>
                        </div>

                        <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-5 text-slate-500">
                          {item.code}
                        </pre>

                        <MathText
                          text={
                            item.code
                          }
                          className="mt-1 border-t border-slate-200 pt-1.5 text-[13px] leading-6 text-slate-800"
                        />
                      </div>
                    )
                  )}
                </div>
              </div>
            )
          )}
        </div>
      ) : null}
    </section>
  );
}