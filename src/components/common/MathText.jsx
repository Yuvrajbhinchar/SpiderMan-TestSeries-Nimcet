"use client";

import { useMemo } from "react";

import { renderMathSegments } from "@/lib/mathText";

/* =========================================================
   MATH TEXT
   ---------------------------------------------------------
   Drop-in replacement for rendering a raw question / option /
   explanation string.

   Before:

     <div className="whitespace-pre-wrap">
       {question.questionText}
     </div>

   After:

     <MathText
       className="whitespace-pre-wrap"
       text={question.questionText}
     />

   Plain strings render byte-for-byte the same as before. Only
   the parts wrapped in $...$, $$...$$, \(...\) or \[...\] go
   through KaTeX.

   SAFETY

   The only HTML ever injected is KaTeX's own output, produced
   with trust:false, so \href / \htmlData / raw markup in a
   question string cannot escape into the page. Text segments
   are rendered by React and stay escaped.
========================================================= */

export default function MathText({
  text,
  children,
  className = "",
  as: Tag = "div",
  ...rest
}) {
  const source =
    typeof text === "string"
      ? text
      : typeof children === "string"
        ? children
        : text === 0
          ? "0"
          : "";

  const segments = useMemo(
    () => renderMathSegments(source),
    [source]
  );

  if (!source) {
    return null;
  }

  return (
    <Tag className={className} {...rest}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <span key={index}>
              {segment.value}
            </span>
          );
        }

        /*
         * KaTeX failed hard on this expression: show the raw
         * LaTeX instead of an empty gap, so the student still
         * sees something and the admin can spot the typo.
         */
        if (!segment.html) {
          return (
            <span
              key={index}
              className="rounded bg-amber-50 px-1 font-mono text-[0.9em] text-amber-700"
            >
              {segment.display
                ? `$$${segment.value}$$`
                : `$${segment.value}$`}
            </span>
          );
        }

        return (
          <span
            key={index}
            /*
             * whitespace-normal: the parent usually carries
             * whitespace-pre-wrap for the plain text, which
             * would otherwise stretch KaTeX's internal spacing.
             */
            className={
              segment.display
                ? "math-display-wrap whitespace-normal"
                : "math-inline-wrap whitespace-normal"
            }
            dangerouslySetInnerHTML={{
              __html: segment.html,
            }}
          />
        );
      })}
    </Tag>
  );
}

/* =========================================================
   INLINE VARIANT

   Same thing, but renders into a <span> so it can sit inside
   an existing line of text (option rows, table cells, chips).
========================================================= */

export function MathTextInline(props) {
  return <MathText as="span" {...props} />;
}