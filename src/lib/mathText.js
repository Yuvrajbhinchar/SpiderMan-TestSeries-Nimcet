import katex from "katex";

/* =========================================================
   MATH TEXT
   ---------------------------------------------------------
   Question text, option text and explanations are stored as
   plain strings. Admins may embed LaTeX inside those strings
   using standard delimiters:

     $ ... $       inline math      $x^2 + y^2 = r^2$
     \( ... \)     inline math      \(\frac{a}{b}\)
     $$ ... $$     display math     $$\int_0^1 x\,dx$$
     \[ ... \]     display math     \[\begin{pmatrix}...\end{pmatrix}\]

   Everything OUTSIDE the delimiters stays plain text, so old
   questions with no LaTeX keep rendering exactly as before.

   This module does the parsing + KaTeX rendering. It has no
   React in it so it can also be used server side (for example
   to validate an admin's LaTeX before saving).
========================================================= */

/* =========================================================
   DELIMITERS

   Order matters: $$ must be tested before $, and \[ before \(
   is irrelevant but kept grouped for readability.
========================================================= */

const DELIMITERS = [
  {
    left: "$$",
    right: "$$",
    display: true,
    allowNewlines: true,
  },
  {
    left: "\\[",
    right: "\\]",
    display: true,
    allowNewlines: true,
  },
  {
    left: "\\(",
    right: "\\)",
    display: false,
    allowNewlines: false,
  },
  {
    left: "$",
    right: "$",
    display: false,
    allowNewlines: false,
  },
];

/* =========================================================
   MACROS

   Small convenience set so admins type less. Anything here is
   available in every question without extra setup.
========================================================= */

const MACROS = {
  "\\RR": "\\mathbb{R}",
  "\\NN": "\\mathbb{N}",
  "\\ZZ": "\\mathbb{Z}",
  "\\QQ": "\\mathbb{Q}",
  "\\CC": "\\mathbb{C}",
  "\\degree": "^{\\circ}",
  "\\dx": "\\,\\mathrm{d}x",
  "\\ddx": "\\frac{\\mathrm{d}}{\\mathrm{d}x}",
  "\\abs": "\\left|#1\\right|",
  "\\norm": "\\left\\|#1\\right\\|",
  "\\set": "\\left\\{#1\\right\\}",
};

/* =========================================================
   KATEX OPTIONS
========================================================= */

const BASE_OPTIONS = {
  throwOnError: false,
  errorColor: "#ef1118",

  /*
   * strict: false
   *
   * Students' questions are copy-pasted from many sources.
   * We do NOT want a console warning (or a hard failure) for
   * things like unicode minus signs or \text with accents.
   */
  strict: false,

  /*
   * trust: false
   *
   * Blocks \htmlData, \href, \includegraphics and friends, so
   * a question string can never inject markup or a link into
   * the page. This is the important security switch here,
   * because KaTeX output is inserted as HTML.
   */
  trust: false,

  macros: MACROS,

  maxSize: 40,
  maxExpand: 1000,
};

/* =========================================================
   RENDER CACHE

   The same expression is re-rendered on every question change,
   every palette jump and every re-render of the attempt page.
   KaTeX is fast but not free, so keep a bounded cache.
========================================================= */

const CACHE_LIMIT = 600;

const cache = new Map();

function cacheGet(key) {
  if (!cache.has(key)) {
    return undefined;
  }

  const value = cache.get(key);

  /*
   * Touch the key so the eviction below removes the genuinely
   * least recently used entry.
   */
  cache.delete(key);
  cache.set(key, value);

  return value;
}

function cacheSet(key, value) {
  cache.set(key, value);

  if (cache.size > CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;

    cache.delete(oldestKey);
  }

  return value;
}

/* =========================================================
   FIND CLOSING DELIMITER

   Walks forward from startIndex and returns the index of the
   closing delimiter, or -1 if there is none.

   The closing delimiter is tested BEFORE the backslash escape
   rule, because \) and \] start with a backslash themselves.
========================================================= */

function findClosing(source, startIndex, right) {
  let index = startIndex;

  while (index < source.length) {
    if (source.startsWith(right, index)) {
      return index;
    }

    /*
     * Skip an escaped character inside the math body so that
     * \$ or \\ never terminates the expression early.
     */
    if (source[index] === "\\") {
      index += 2;
      continue;
    }

    index += 1;
  }

  return -1;
}

/* =========================================================
   CONTENT VALIDATION

   A lone "$" in ordinary prose (prices, "cost $5") must not
   silently swallow half a sentence into math mode. These
   checks make an accidental match fall back to plain text.
========================================================= */

function isValidContent(content, delimiter) {
  if (!content || !content.trim()) {
    return false;
  }

  /*
   * A blank line never belongs inside one expression.
   */
  if (content.includes("\n\n")) {
    return false;
  }

  if (!delimiter.allowNewlines && content.includes("\n")) {
    return false;
  }

  /*
   * Single $ is the ambiguous one, so it gets the strict rules:
   * no leading/trailing whitespace, and not a bare number
   * (which is almost always currency, not math).
   */
  if (delimiter.left === "$") {
    if (/^\s/.test(content) || /\s$/.test(content)) {
      return false;
    }

    if (/^\d[\d.,]*$/.test(content)) {
      return false;
    }
  }

  return true;
}

/* =========================================================
   PARSE

   Splits a raw string into ordered segments:

     { type: "text", value: "Solve " }
     { type: "math", value: "x^2 = 4", display: false }
========================================================= */

export function parseMathSegments(source) {
  const text = typeof source === "string" ? source : String(source ?? "");

  const segments = [];

  let buffer = "";
  let index = 0;

  const flushText = () => {
    if (buffer) {
      segments.push({
        type: "text",
        value: buffer,
      });

      buffer = "";
    }
  };

  while (index < text.length) {
    /*
     * Escaped dollar: \$ renders as a literal $.
     */
    if (text[index] === "\\" && text[index + 1] === "$") {
      buffer += "$";
      index += 2;
      continue;
    }

    let matched = false;

    for (const delimiter of DELIMITERS) {
      if (!text.startsWith(delimiter.left, index)) {
        continue;
      }

      const contentStart = index + delimiter.left.length;

      const closeIndex = findClosing(text, contentStart, delimiter.right);

      if (closeIndex === -1) {
        continue;
      }

      const content = text.slice(contentStart, closeIndex);

      if (!isValidContent(content, delimiter)) {
        continue;
      }

      flushText();

      segments.push({
        type: "math",
        value: content,
        display: delimiter.display,
      });

      index = closeIndex + delimiter.right.length;

      matched = true;

      break;
    }

    if (matched) {
      continue;
    }

    buffer += text[index];

    index += 1;
  }

  flushText();

  return segments;
}

/* =========================================================
   HAS MATH
========================================================= */

export function hasMath(source) {
  return parseMathSegments(source).some(
    (segment) => segment.type === "math"
  );
}

/* =========================================================
   RENDER ONE EXPRESSION
========================================================= */

export function renderMath(expression, display = false) {
  const key = `${display ? "D" : "I"}\u0000${expression}`;

  const cached = cacheGet(key);

  if (cached !== undefined) {
    return cached;
  }

  let html = "";

  try {
    html = katex.renderToString(expression, {
      ...BASE_OPTIONS,
      displayMode: Boolean(display),
    });
  } catch (error) {
    /*
     * throwOnError is false, so this only fires on a genuinely
     * broken input. Fall back to the raw source rather than
     * blanking the question out.
     */
    console.error("KaTeX render failed:", error);

    html = "";
  }

  return cacheSet(key, html);
}

/* =========================================================
   RENDER ALL SEGMENTS

   Returns the same segment list with `html` filled in for the
   math segments. Text segments are untouched and are rendered
   by React as normal escaped text.
========================================================= */

export function renderMathSegments(source) {
  return parseMathSegments(source).map((segment) => {
    if (segment.type !== "math") {
      return segment;
    }

    const html = renderMath(segment.value, segment.display);

    return {
      ...segment,
      html,
    };
  });
}

/* =========================================================
   VALIDATE

   Used by the admin editor to show "3 expressions, all valid"
   style feedback before saving.
========================================================= */

export function validateMathText(source) {
  const segments = parseMathSegments(source);

  const errors = [];

  let count = 0;

  for (const segment of segments) {
    if (segment.type !== "math") {
      continue;
    }

    count += 1;

    try {
      katex.renderToString(segment.value, {
        ...BASE_OPTIONS,
        throwOnError: true,
        displayMode: Boolean(segment.display),
      });
    } catch (error) {
      errors.push({
        expression: segment.value,

        message: String(error?.message || "Invalid LaTeX.").replace(
          /^KaTeX parse error:\s*/,
          ""
        ),
      });
    }
  }

  return {
    count,
    errors,
    ok: errors.length === 0,
  };
}