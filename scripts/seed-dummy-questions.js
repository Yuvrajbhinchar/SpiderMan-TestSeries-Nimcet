const fs = require("fs");
const path = require("path");
const { createClient } = require("@libsql/client");

/*
|--------------------------------------------------------------------------
| ENV LOADER
|--------------------------------------------------------------------------
|
| This makes the script work with:
|
| node scripts/seed-dummy-questions.js
|
| without needing:
|
| node --env-file=.env.local ...
|
*/

function loadEnvFile() {
  const possibleFiles = [
    path.join(process.cwd(), ".env.local"),
    path.join(process.cwd(), ".env"),
  ];

  for (const filePath of possibleFiles) {
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const content = fs.readFileSync(
      filePath,
      "utf8"
    );

    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      if (line.startsWith("#")) {
        continue;
      }

      const equalIndex = line.indexOf("=");

      if (equalIndex === -1) {
        continue;
      }

      const key = line
        .slice(0, equalIndex)
        .trim();

      let value = line
        .slice(equalIndex + 1)
        .trim();

      if (
        (value.startsWith('"') &&
          value.endsWith('"')) ||
        (value.startsWith("'") &&
          value.endsWith("'"))
      ) {
        value = value.slice(
          1,
          -1
        );
      }

      if (
        process.env[key] ===
        undefined
      ) {
        process.env[key] = value;
      }
    }

    console.log(
      `Loaded environment from ${path.basename(
        filePath
      )}`
    );

    return;
  }

  console.log(
    "No .env.local or .env file found. Using existing process.env."
  );
}

loadEnvFile();

/*
|--------------------------------------------------------------------------
| TURSO CONFIG
|--------------------------------------------------------------------------
*/

const DATABASE_URL =
  process.env.TURSO_DATABASE_URL ||
  process.env.TURSO_URL ||
  process.env.LIBSQL_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "";

const AUTH_TOKEN =
  process.env.TURSO_AUTH_TOKEN ||
  process.env.TURSO_TOKEN ||
  process.env.LIBSQL_AUTH_TOKEN ||
  "";

if (!DATABASE_URL) {
  console.error(
    "\nTurso database URL is missing.\n"
  );

  console.error(
    "Expected one of:"
  );

  console.error(
    "TURSO_DATABASE_URL"
  );

  console.error(
    "TURSO_URL"
  );

  console.error(
    "LIBSQL_DATABASE_URL"
  );

  console.error(
    "DATABASE_URL"
  );

  console.error(
    "\nCheck your .env.local file."
  );

  process.exit(1);
}

if (!AUTH_TOKEN) {
  console.error(
    "\nTurso auth token is missing.\n"
  );

  console.error(
    "Expected one of:"
  );

  console.error(
    "TURSO_AUTH_TOKEN"
  );

  console.error(
    "TURSO_TOKEN"
  );

  console.error(
    "LIBSQL_AUTH_TOKEN"
  );

  console.error(
    "\nCheck your .env.local file."
  );

  process.exit(1);
}

/*
|--------------------------------------------------------------------------
| DB
|--------------------------------------------------------------------------
*/

const db = createClient({
  url: DATABASE_URL,
  authToken: AUTH_TOKEN,
});

/*
|--------------------------------------------------------------------------
| SERIES CONFIG
|--------------------------------------------------------------------------
*/

const SERIES = [
  {
    key: "free",

    name: "Free",

    testTable: "free_tests",
    sectionTable: "free_test_sections",
    questionTable: "free_questions",
    optionTable: "free_question_options",
  },

  {
    key: "asspire",

    name: "Asspire",

    testTable: "asspire_tests",
    sectionTable: "asspire_test_sections",
    questionTable: "asspire_questions",
    optionTable: "asspire_question_options",
  },

  {
    key: "imppetus",

    name: "Imppetus",

    testTable: "imppetus_tests",
    sectionTable: "imppetus_test_sections",
    questionTable: "imppetus_questions",
    optionTable: "imppetus_question_options",
  },

  {
    key: "spiderman",

    name: "SpiderMan",

    testTable: "spiderman_tests",
    sectionTable: "spiderman_test_sections",
    questionTable: "spiderman_questions",
    optionTable:
      "spiderman_question_options",
  },
];

/*
|--------------------------------------------------------------------------
| MARKING SCHEME
|--------------------------------------------------------------------------
*/

const MARKS = {
  maths: {
    positive: 12,
    negative: 3,
  },

  reasoning: {
    positive: 6,
    negative: 1.5,
  },

  cs: {
    positive: 6,
    negative: 1.5,
  },

  english: {
    positive: 4,
    negative: 1,
  },
};

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function normalize(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function toNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function unique(values) {
  return [
    ...new Set(
      values.map((value) =>
        String(value)
      )
    ),
  ];
}

function tableExists(
  tableName
) {
  return db
    .execute({
      sql: `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
          AND name = ?
        LIMIT 1
      `,
      args: [tableName],
    })
    .then(
      (result) =>
        result.rows.length > 0
    );
}

/*
|--------------------------------------------------------------------------
| CATEGORY
|--------------------------------------------------------------------------
*/

async function getCategory(
  categoryId
) {
  if (
    !Number.isInteger(
      Number(categoryId)
    ) ||
    Number(categoryId) <= 0
  ) {
    return null;
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          name,
          slug
        FROM test_categories
        WHERE id = ?
        LIMIT 1
      `,
      args: [
        Number(categoryId),
      ],
    });

  return (
    result.rows?.[0] ||
    null
  );
}

/*
|--------------------------------------------------------------------------
| TESTS
|--------------------------------------------------------------------------
*/

async function getTests(
  config
) {
  const exists =
    await tableExists(
      config.testTable
    );

  if (!exists) {
    console.log(
      `Skipping ${config.name}: ${config.testTable} does not exist.`
    );

    return [];
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          title,
          slug,
          category_id,
          duration_minutes,
          total_questions,
          total_marks
        FROM ${config.testTable}
        ORDER BY id ASC
      `,
      args: [],
    });

  return Array.isArray(
    result.rows
  )
    ? result.rows
    : [];
}

/*
|--------------------------------------------------------------------------
| SECTIONS
|--------------------------------------------------------------------------
*/

async function getSections(
  config,
  testId
) {
  const exists =
    await tableExists(
      config.sectionTable
    );

  if (!exists) {
    return [];
  }

  const result =
    await db.execute({
      sql: `
        SELECT
          id,
          test_id,
          section_name,
          section_order,
          duration_minutes,
          question_count,
          is_sequential,
          timer_group
        FROM ${config.sectionTable}
        WHERE test_id = ?
        ORDER BY
          section_order ASC,
          id ASC
      `,
      args: [testId],
    });

  return Array.isArray(
    result.rows
  )
    ? result.rows
    : [];
}

/*
|--------------------------------------------------------------------------
| EXISTING QUESTION COUNT
|--------------------------------------------------------------------------
*/

async function getQuestionCount(
  questionTable,
  testId
) {
  const result =
    await db.execute({
      sql: `
        SELECT
          COUNT(*) AS count
        FROM ${questionTable}
        WHERE test_id = ?
      `,
      args: [testId],
    });

  return Number(
    result.rows?.[0]?.count ||
      0
  );
}

/*
|--------------------------------------------------------------------------
| SUBJECT DETECTION
|--------------------------------------------------------------------------
*/

function detectSubject(
  test,
  questionNumber,
  sections
) {
  const testText = normalize(
    `${test.title || ""} ${
      test.slug || ""
    }`
  );

  /*
   * DPP subject directly from test name.
   */

  if (
    testText.includes("math") ||
    testText.includes("mathematics")
  ) {
    return "maths";
  }

  if (
    testText.includes("reason")
  ) {
    return "reasoning";
  }

  if (
    testText.includes(
      "computer"
    ) ||
    testText.includes("cs")
  ) {
    return "cs";
  }

  if (
    testText.includes("english") ||
    testText.includes("eng")
  ) {
    return "english";
  }

  /*
   * For section based tests.
   */

  if (
    Array.isArray(sections) &&
    sections.length > 0
  ) {
    let start = 1;

    for (const section of sections) {
      const count =
        Number(
          section.question_count ||
            0
        );

      const end =
        start + count - 1;

      if (
        questionNumber >=
          start &&
        questionNumber <= end
      ) {
        const sectionText =
          normalize(
            section.section_name
          );

        if (
          sectionText.includes(
            "math"
          )
        ) {
          return "maths";
        }

        if (
          sectionText.includes(
            "reason"
          )
        ) {
          return "reasoning";
        }

        if (
          sectionText.includes(
            "computer"
          ) ||
          sectionText === "cs"
        ) {
          return "cs";
        }

        if (
          sectionText.includes(
            "english"
          )
        ) {
          return "english";
        }
      }

      start = end + 1;
    }
  }

  /*
   * Fallback for generic Mini/Mock.
   */

  const subjects = [
    "maths",
    "reasoning",
    "cs",
    "english",
  ];

  return subjects[
    (questionNumber - 1) %
      subjects.length
  ];
}

/*
|--------------------------------------------------------------------------
| QUESTION GENERATORS
|--------------------------------------------------------------------------
*/

function mathsQuestion(
  n
) {
  const type =
    (n - 1) % 10;

  if (type === 0) {
    const x = 5 + n;
    const b = 2 + (n % 6);

    return {
      text: `If x + ${b} = ${
        x + b
      }, then x is equal to:`,
      correct: String(x),
      options: [
        String(x),
        String(x - 2),
        String(x + 2),
        String(x + 4),
      ],
    };
  }

  if (type === 1) {
    const base =
      100 + n * 10;

    const percent =
      10 + (n % 5) * 5;

    const result =
      (base * percent) / 100;

    return {
      text: `What is ${percent}% of ${base}?`,
      correct: String(result),
      options: [
        String(result),
        String(result + 5),
        String(result - 5),
        String(result + 10),
      ],
    };
  }

  if (type === 2) {
    const a =
      3 + (n % 7);

    const b =
      2 + (n % 5);

    const result =
      a * b;

    return {
      text: `The value of ${a} × ${b} is:`,
      correct: String(result),
      options: [
        String(result),
        String(result + 2),
        String(result - 2),
        String(result + 4),
      ],
    };
  }

  if (type === 3) {
    const n1 =
      2 + n;

    const n2 =
      n1 + 4;

    const n3 =
      n2 + 4;

    const answer =
      n3 + 4;

    return {
      text: `What is the next term in the sequence ${n1}, ${n2}, ${n3}, ?`,
      correct: String(answer),
      options: [
        String(answer),
        String(answer + 2),
        String(answer + 4),
        String(answer - 3),
      ],
    };
  }

  if (type === 4) {
    const a =
      4 + (n % 6);

    const b =
      3 + (n % 5);

    const result =
      a + b;

    return {
      text: `If a = ${a} and b = ${b}, then a + b is:`,
      correct: String(result),
      options: [
        String(result),
        String(result + 1),
        String(result - 2),
        String(result + 3),
      ],
    };
  }

  if (type === 5) {
    const speed =
      30 +
      (n % 4) * 10;

    const hours =
      2 + (n % 3);

    const result =
      speed * hours;

    return {
      text: `A vehicle travels at ${speed} km/h for ${hours} hours. What distance does it cover?`,
      correct: `${result} km`,
      options: [
        `${result} km`,
        `${result - 10} km`,
        `${result + 10} km`,
        `${result + 20} km`,
      ],
    };
  }

  if (type === 6) {
    const value =
      2 + (n % 8);

    const result =
      value * value;

    return {
      text: `The square of ${value} is:`,
      correct: String(result),
      options: [
        String(result),
        String(result + 2),
        String(result - 2),
        String(result + 5),
      ],
    };
  }

  if (type === 7) {
    const numerator =
      2 + (n % 3);

    const denominator =
      numerator + 2;

    return {
      text: `Which of the following is equal to ${numerator}/${denominator}?`,
      correct: `${numerator}/${denominator}`,
      options: [
        `${numerator}/${denominator}`,
        `${numerator + 1}/${denominator}`,
        `${numerator}/${denominator + 1}`,
        `${numerator + 2}/${denominator}`,
      ],
    };
  }

  if (type === 8) {
    const a =
      2 + (n % 5);

    const answer =
      a + 6;

    return {
      text: `If x = ${a}, then x + 6 equals:`,
      correct: String(answer),
      options: [
        String(answer),
        String(answer - 1),
        String(answer + 2),
        String(answer + 4),
      ],
    };
  }

  const x =
    2 + (n % 6);

  const result =
    3 * x + 2;

  return {
    text: `If 3x + 2 = ${result}, then x is:`,
    correct: String(x),
    options: [
      String(x),
      String(x + 1),
      String(x - 1),
      String(x + 2),
    ],
  };
}

function reasoningQuestion(
  n
) {
  const type =
    (n - 1) % 8;

  if (type === 0) {
    const a =
      2 + n;

    const b =
      a + 3;

    const c =
      b + 3;

    const d =
      c + 3;

    return {
      text: `Find the next number: ${a}, ${b}, ${c}, ${d}, ?`,
      correct: String(d + 3),
      options: [
        String(d + 3),
        String(d + 2),
        String(d + 4),
        String(d + 5),
      ],
    };
  }

  if (type === 1) {
    return {
      text: "If CAT is coded as DBU, then DOG will be coded as:",
      correct: "EPH",
      options: [
        "EPH",
        "EOH",
        "FPH",
        "EPI",
      ],
    };
  }

  if (type === 2) {
    return {
      text: "Which one is different from the remaining three?",
      correct: "Circle",
      options: [
        "Square",
        "Rectangle",
        "Triangle",
        "Circle",
      ],
    };
  }

  if (type === 3) {
    return {
      text: "Book is to Reading as Food is to:",
      correct: "Eating",
      options: [
        "Cooking",
        "Eating",
        "Buying",
        "Serving",
      ],
    };
  }

  if (type === 4) {
    return {
      text: "A is taller than B, and B is taller than C. Who is the shortest?",
      correct: "C",
      options: [
        "A",
        "B",
        "C",
        "Cannot be determined",
      ],
    };
  }

  if (type === 5) {
    return {
      text: "Find the odd pair:",
      correct: "Cow - Water",
      options: [
        "Dog - Kennel",
        "Lion - Den",
        "Bird - Nest",
        "Cow - Water",
      ],
    };
  }

  if (type === 6) {
    return {
      text: "Which word does not belong to the group?",
      correct: "Apple",
      options: [
        "Carrot",
        "Potato",
        "Spinach",
        "Apple",
      ],
    };
  }

  return {
    text: "If all roses are flowers, which statement is definitely true?",
    correct: "All roses are flowers",
    options: [
      "All flowers are roses",
      "All roses are flowers",
      "No roses are flowers",
      "Some roses are not flowers",
    ],
  };
}

function csQuestion(
  n
) {
  const type =
    (n - 1) % 8;

  if (type === 0) {
    return {
      text: "Which data structure follows the LIFO principle?",
      correct: "Stack",
      options: [
        "Queue",
        "Stack",
        "Tree",
        "Graph",
      ],
    };
  }

  if (type === 1) {
    return {
      text: "Which key uniquely identifies a record in a relational table?",
      correct: "Primary Key",
      options: [
        "Foreign Key",
        "Primary Key",
        "Candidate Value",
        "View",
      ],
    };
  }

  if (type === 2) {
    return {
      text: "Which protocol is commonly used to transfer web pages?",
      correct: "HTTP",
      options: [
        "FTP",
        "HTTP",
        "SMTP",
        "SSH",
      ],
    };
  }

  if (type === 3) {
    return {
      text: "Which of the following is an operating system?",
      correct: "Linux",
      options: [
        "Python",
        "Linux",
        "Oracle",
        "HTML",
      ],
    };
  }

  if (type === 4) {
    return {
      text: "What is the binary representation of decimal 5?",
      correct: "101",
      options: [
        "100",
        "101",
        "110",
        "111",
      ],
    };
  }

  if (type === 5) {
    return {
      text: "Which traversal of a binary search tree produces sorted order?",
      correct: "Inorder",
      options: [
        "Preorder",
        "Postorder",
        "Inorder",
        "Level Order",
      ],
    };
  }

  if (type === 6) {
    return {
      text: "Which language is primarily used for styling web pages?",
      correct: "CSS",
      options: [
        "HTML",
        "CSS",
        "SQL",
        "C",
      ],
    };
  }

  return {
    text: "Which of the following is a programming language?",
    correct: "Python",
    options: [
      "Python",
      "HTTP",
      "CSS",
      "SQL Table",
    ],
  };
}

function englishQuestion(
  n
) {
  const type =
    (n - 1) % 8;

  if (type === 0) {
    return {
      text: "Choose the synonym of 'rapid'.",
      correct: "Fast",
      options: [
        "Slow",
        "Fast",
        "Weak",
        "Late",
      ],
    };
  }

  if (type === 1) {
    return {
      text: "Choose the antonym of 'ancient'.",
      correct: "Modern",
      options: [
        "Old",
        "Historic",
        "Modern",
        "Past",
      ],
    };
  }

  if (type === 2) {
    return {
      text: "Choose the correctly spelled word.",
      correct: "Necessary",
      options: [
        "Necesary",
        "Necessery",
        "Necessary",
        "Nessesary",
      ],
    };
  }

  if (type === 3) {
    return {
      text: "Fill in the blank: She ___ to the library every day.",
      correct: "goes",
      options: [
        "go",
        "goes",
        "going",
        "gone",
      ],
    };
  }

  if (type === 4) {
    return {
      text: "Choose the word closest in meaning to 'brief'.",
      correct: "Short",
      options: [
        "Long",
        "Short",
        "Heavy",
        "Large",
      ],
    };
  }

  if (type === 5) {
    return {
      text: "Identify the noun: 'The student solved the question.'",
      correct: "student",
      options: [
        "solved",
        "the",
        "student",
        "quickly",
      ],
    };
  }

  if (type === 6) {
    return {
      text: "Choose the grammatically correct sentence.",
      correct:
        "He does not know the answer.",
      options: [
        "He do not know the answer.",
        "He does not know the answer.",
        "He does not knows the answer.",
        "He not know the answer.",
      ],
    };
  }

  return {
    text: "Choose the correct meaning of 'optimistic'.",
    correct: "Hopeful",
    options: [
      "Angry",
      "Hopeful",
      "Careless",
      "Fearful",
    ],
  };
}

/*
|--------------------------------------------------------------------------
| GENERATE
|--------------------------------------------------------------------------
*/

function generateQuestion(
  subject,
  questionNumber
) {
  let generated;

  if (subject === "maths") {
    generated =
      mathsQuestion(
        questionNumber
      );
  } else if (
    subject === "reasoning"
  ) {
    generated =
      reasoningQuestion(
        questionNumber
      );
  } else if (
    subject === "cs"
  ) {
    generated =
      csQuestion(
        questionNumber
      );
  } else {
    generated =
      englishQuestion(
        questionNumber
      );
  }

  const marking =
    MARKS[subject];

  let options =
    unique(
      generated.options
    );

  /*
   * Make sure exactly 4 options exist.
   */

  while (
    options.length <
    4
  ) {
    options.push(
      `Dummy Option ${
        options.length + 1
      }`
    );
  }

  options =
    options.slice(0, 4);

  /*
   * Guarantee correct answer.
   */

  const correct =
    String(
      generated.correct
    );

  if (
    !options.includes(
      correct
    )
  ) {
    options[0] = correct;
  }

  return {
    questionText:
      generated.text,

    explanation:
      "Dummy question created for testing the SpiderMan Test Series.",

    questionType:
      "mcq",

    marks:
      marking.positive,

    negativeMarks:
      marking.negative,

    options,
  };
}

/*
|--------------------------------------------------------------------------
| FIND SECTION
|--------------------------------------------------------------------------
*/

function getSectionForQuestion(
  sections,
  questionNumber
) {
  if (
    !sections.length
  ) {
    return null;
  }

  let start = 1;

  for (const section of sections) {
    const count =
      Number(
        section.question_count ||
          0
      );

    const end =
      start + count - 1;

    if (
      questionNumber >=
        start &&
      questionNumber <= end
    ) {
      return Number(
        section.id
      );
    }

    start =
      end + 1;
  }

  /*
   * Fallback:
   * first section.
   */

  return Number(
    sections[0].id
  );
}

/*
|--------------------------------------------------------------------------
| SEED ONE TEST
|--------------------------------------------------------------------------
*/

async function seedTest(
  config,
  test,
  category
) {
  const testId =
    Number(test.id);

  const existingCount =
    await getQuestionCount(
      config.questionTable,
      testId
    );

  if (
    existingCount > 0
  ) {
    console.log(
      `SKIP  ${config.key}/${testId} | ${test.title} | already has ${existingCount} questions`
    );

    return {
      skipped: true,
      questions: 0,
      options: 0,
    };
  }

  const totalQuestions =
    Number(
      test.total_questions ||
        0
    );

  if (
    totalQuestions <= 0
  ) {
    console.log(
      `SKIP  ${config.key}/${testId} | ${test.title} | total_questions=0`
    );

    return {
      skipped: true,
      questions: 0,
      options: 0,
    };
  }

  const sections =
    await getSections(
      config,
      testId
    );

  /*
   * Only practice tests.
   */

  const categoryText =
    normalize(
      `${category?.name || ""} ${
        category?.slug || ""
      }`
    );

  const isPractice =
    categoryText.includes(
      "dpp"
    ) ||
    categoryText.includes(
      "mini"
    ) ||
    categoryText.includes(
      "mock"
    );

  if (!isPractice) {
    console.log(
      `SKIP  ${config.key}/${testId} | ${test.title} | not DPP/Mini/Mock`
    );

    return {
      skipped: true,
      questions: 0,
      options: 0,
    };
  }

  console.log(
    `SEED  ${config.key}/${testId} | ${test.title} | ${totalQuestions} questions`
  );

  let insertedQuestions = 0;
  let insertedOptions = 0;

  /*
   * ------------------------------------------------------
   * Questions
   * ------------------------------------------------------
   */

  for (
    let questionNumber = 1;
    questionNumber <=
    totalQuestions;
    questionNumber += 1
  ) {
    const subject =
      detectSubject(
        test,
        questionNumber,
        sections
      );

    const generated =
      generateQuestion(
        subject,
        questionNumber
      );

    const sectionId =
      getSectionForQuestion(
        sections,
        questionNumber
      );

    /*
     * ----------------------------------------------------
     * INSERT QUESTION
     * ----------------------------------------------------
     */

    const questionResult =
      await db.execute({
        sql: `
          INSERT INTO ${config.questionTable} (
            test_id,
            section_id,
            question_text,
            explanation,
            question_type,
            marks,
            negative_marks,
            question_order
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        args: [
          testId,
          sectionId,
          generated.questionText,
          generated.explanation,
          generated.questionType,
          generated.marks,
          generated.negativeMarks,
          questionNumber,
        ],
      });

    /*
     * libSQL doesn't always return generated id
     * the same way across versions/configurations.
     *
     * So immediately resolve it using test_id +
     * question_order.
     */

    const insertedQuestion =
      await db.execute({
        sql: `
          SELECT id
          FROM ${config.questionTable}
          WHERE
            test_id = ?
            AND question_order = ?
          ORDER BY id DESC
          LIMIT 1
        `,
        args: [
          testId,
          questionNumber,
        ],
      });

    const questionId =
      Number(
        insertedQuestion.rows?.[0]
          ?.id
      );

    if (
      !Number.isInteger(
        questionId
      ) ||
      questionId <= 0
    ) {
      throw new Error(
        `Could not resolve inserted question ID for ${config.key}/${testId} question ${questionNumber}.`
      );
    }

    insertedQuestions += 1;

    /*
     * ----------------------------------------------------
     * OPTIONS
     * ----------------------------------------------------
     */

    const correctAnswer =
      String(
        generated.options[
          0
        ]
      );

    /*
     * Rotate correct answer position
     * so dummy tests don't always have
     * answer A.
     */

    const correctIndex =
      (questionNumber - 1) %
      4;

    const finalOptions = [
      ...generated.options,
    ];

    const correctPosition =
      finalOptions.findIndex(
        (option) =>
          String(option) ===
          String(
            generated.options[0]
          )
      );

    /*
     * Move first/correct generated answer
     * to deterministic position.
     */

    const rotated = [
      ...finalOptions,
    ];

    if (
      correctPosition !==
      correctIndex
    ) {
      const temp =
        rotated[
          correctIndex
        ];

      rotated[
        correctIndex
      ] =
        rotated[
          correctPosition
        ];

      rotated[
        correctPosition
      ] = temp;
    }

    for (
      let optionIndex = 0;
      optionIndex < 4;
      optionIndex += 1
    ) {
      const labels = [
        "A",
        "B",
        "C",
        "D",
      ];

      const isCorrect =
        optionIndex ===
        correctIndex
          ? 1
          : 0;

      await db.execute({
        sql: `
          INSERT INTO ${config.optionTable} (
            question_id,
            option_label,
            option_text,
            is_correct,
            option_order
          )
          VALUES (?, ?, ?, ?, ?)
        `,
        args: [
          questionId,
          labels[optionIndex],
          rotated[
            optionIndex
          ],
          isCorrect,
          optionIndex + 1,
        ],
      });

      insertedOptions += 1;
    }

    if (
      questionNumber % 10 ===
        0 ||
      questionNumber ===
        totalQuestions
    ) {
      console.log(
        `      ${questionNumber}/${totalQuestions}`
      );
    }
  }

  /*
   * ------------------------------------------------------
   * SECTION COUNTS
   * ------------------------------------------------------
   *
   * Only update section count if section table exists.
   *
   * No updated_at dependency.
   */

  if (
    sections.length > 0
  ) {
    for (const section of sections) {
      const result =
        await db.execute({
          sql: `
            SELECT
              COUNT(*) AS count
            FROM ${config.questionTable}
            WHERE
              test_id = ?
              AND section_id = ?
          `,
          args: [
            testId,
            Number(
              section.id
            ),
          ],
        });

      const count =
        Number(
          result.rows?.[0]
            ?.count || 0
        );

      /*
       * Only update question_count.
       * This avoids depending on updated_at.
       */

      try {
        await db.execute({
          sql: `
            UPDATE ${config.sectionTable}
            SET question_count = ?
            WHERE id = ?
          `,
          args: [
            count,
            Number(
              section.id
            ),
          ],
        });
      } catch (error) {
        console.warn(
          `      Could not update section ${section.id}: ${error.message}`
        );
      }
    }
  }

  console.log(
    `DONE  ${config.key}/${testId} | questions=${insertedQuestions} | options=${insertedOptions}`
  );

  return {
    skipped: false,
    questions:
      insertedQuestions,
    options:
      insertedOptions,
  };
}

/*
|--------------------------------------------------------------------------
| MAIN
|--------------------------------------------------------------------------
*/

async function main() {
  console.log("");
  console.log(
    "=================================================="
  );
  console.log(
    " SpiderMan Dummy Question Seeder"
  );
  console.log(
    "=================================================="
  );

  console.log(
    `Database: ${DATABASE_URL}`
  );

  let checked = 0;
  let seeded = 0;
  let skipped = 0;
  let questionTotal = 0;
  let optionTotal = 0;

  for (const config of SERIES) {
    console.log("");
    console.log(
      `--- ${config.name} ---`
    );

    let tests = [];

    try {
      tests =
        await getTests(
          config
        );
    } catch (error) {
      console.warn(
        `Could not read ${config.testTable}: ${error.message}`
      );

      continue;
    }

    for (const test of tests) {
      checked += 1;

      let category = null;

      try {
        category =
          await getCategory(
            Number(
              test.category_id
            )
          );
      } catch (error) {
        console.warn(
          `Category lookup failed for ${config.key}/${test.id}: ${error.message}`
        );
      }

      const result =
        await seedTest(
          config,
          test,
          category
        );

      if (result.skipped) {
        skipped += 1;
      } else {
        seeded += 1;

        questionTotal +=
          result.questions;

        optionTotal +=
          result.options;
      }
    }
  }

  console.log("");
  console.log(
    "=================================================="
  );
  console.log(
    " COMPLETE"
  );
  console.log(
    "=================================================="
  );

  console.log(
    `Tests checked : ${checked}`
  );

  console.log(
    `Tests seeded  : ${seeded}`
  );

  console.log(
    `Tests skipped : ${skipped}`
  );

  console.log(
    `Questions     : ${questionTotal}`
  );

  console.log(
    `Options       : ${optionTotal}`
  );

  console.log(
    "=================================================="
  );
}

/*
|--------------------------------------------------------------------------
| RUN
|--------------------------------------------------------------------------
*/

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("");
    console.error(
      "=================================================="
    );
    console.error(
      " SEED FAILED"
    );
    console.error(
      "=================================================="
    );

    console.error(
      error
    );

    console.error(
      "=================================================="
    );

    process.exit(1);
  });