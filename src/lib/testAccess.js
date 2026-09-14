// import { db } from "@/lib/turso";
// import {
//   getCurrentUser,
// } from "@/lib/auth";

// /*
// |--------------------------------------------------------------------------
// | SERIES CONFIG
// |--------------------------------------------------------------------------
// */

// const SERIES_CONFIG = {
//   free: {
//     id: 1,
//     name: "Free",
//     isPaid: false,

//     tests:
//       "free_tests",

//     sections:
//       "free_test_sections",

//     questions:
//       "free_questions",

//     options:
//       "free_question_options",

//     subjects:
//       "free_test_subjects",

//     attempts:
//       "free_test_attempts",

//     answers:
//       "free_attempt_answers",

//     events:
//       "free_test_events",
//   },

//   asspire: {
//     id: 2,
//     name: "Asspire",
//     isPaid: true,

//     tests:
//       "asspire_tests",

//     sections:
//       "asspire_test_sections",

//     questions:
//       "asspire_questions",

//     options:
//       "asspire_question_options",

//     subjects:
//       "asspire_test_subjects",

//     attempts:
//       "asspire_test_attempts",

//     answers:
//       "asspire_attempt_answers",

//     events:
//       "asspire_test_events",
//   },

//   imppetus: {
//     id: 3,
//     name: "Imppetus",
//     isPaid: true,

//     tests:
//       "imppetus_tests",

//     sections:
//       "imppetus_test_sections",

//     questions:
//       "imppetus_questions",

//     options:
//       "imppetus_question_options",

//     subjects:
//       "imppetus_test_subjects",

//     attempts:
//       "imppetus_test_attempts",

//     answers:
//       "imppetus_attempt_answers",

//     events:
//       "imppetus_test_events",
//   },

//   spiderman: {
//     id: 4,
//     name: "SpiderMan",
//     isPaid: true,

//     tests:
//       "spiderman_tests",

//     sections:
//       "spiderman_test_sections",

//     questions:
//       "spiderman_questions",

//     options:
//       "spiderman_question_options",

//     subjects:
//       "spiderman_test_subjects",

//     attempts:
//       "spiderman_test_attempts",

//     answers:
//       "spiderman_attempt_answers",

//     events:
//       "spiderman_test_events",
//   },
// };

// /*
// |--------------------------------------------------------------------------
// | NORMALIZE SERIES
// |--------------------------------------------------------------------------
// */

// function normalizeSeries(
//   value
// ) {
//   const series =
//     String(
//       value || ""
//     )
//       .trim()
//       .toLowerCase();

//   return SERIES_CONFIG[
//     series
//   ]
//     ? series
//     : null;
// }

// /*
// |--------------------------------------------------------------------------
// | GET SERIES CONFIG
// |--------------------------------------------------------------------------
// */

// export function getSeriesConfig(
//   value
// ) {
//   const slug =
//     normalizeSeries(
//       value
//     );

//   return slug
//     ? SERIES_CONFIG[
//         slug
//       ]
//     : null;
// }

// /*
// |--------------------------------------------------------------------------
// | AUTHENTICATED USER
// |--------------------------------------------------------------------------
// */

// export async function requireAuthenticatedUser() {
//   const current =
//     await getCurrentUser();

//   if (
//     !current?.id ||
//     !current?.sessionId ||
//     !current?.deviceId
//   ) {
//     return {
//       ok: false,

//       status: 401,

//       error:
//         "Authentication required.",
//     };
//   }

//   const userId =
//     Number(
//       current.id
//     );

//   if (
//     !Number.isInteger(
//       userId
//     ) ||
//     userId <= 0
//   ) {
//     return {
//       ok: false,

//       status: 401,

//       error:
//         "Invalid user session.",
//     };
//   }

//   /*
//    * One DB query.
//    *
//    * We keep this because session/device can be
//    * revoked dynamically.
//    */

//   const result =
//     await db.execute({
//       sql: `
//         SELECT
//           id,
//           username,
//           display_name,
//           role,
//           is_active,
//           active_session_id,
//           active_device_id
//         FROM users
//         WHERE id = ?
//         LIMIT 1
//       `,

//       args: [
//         userId,
//       ],
//     });

//   const user =
//     result.rows?.[0];

//   if (!user) {
//     return {
//       ok: false,

//       status: 401,

//       code:
//         "USER_NOT_FOUND",

//       error:
//         "User account not found.",
//     };
//   }

//   if (
//     Number(
//       user.is_active
//     ) !== 1
//   ) {
//     return {
//       ok: false,

//       status: 401,

//       code:
//         "ACCOUNT_INACTIVE",

//       error:
//         "Your account is inactive.",
//     };
//   }

//   /*
//    * Session validation.
//    */

//   if (
//     String(
//       user.active_session_id ||
//         ""
//     ) !==
//       String(
//         current.sessionId
//       )
//   ) {
//     return {
//       ok: false,

//       status: 401,

//       code:
//         "SESSION_REVOKED",

//       error:
//         "Your session is no longer active. Please login again.",
//     };
//   }

//   /*
//    * Device validation.
//    */

//   if (
//     String(
//       user.active_device_id ||
//         ""
//     ) !==
//       String(
//         current.deviceId
//       )
//   ) {
//     return {
//       ok: false,

//       status: 401,

//       code:
//         "SESSION_REVOKED",

//       error:
//         "Your session is active on another device.",
//     };
//   }

//   return {
//     ok: true,

//     userId:
//       Number(
//         user.id
//       ),

//     user: {
//       id:
//         Number(
//           user.id
//         ),

//       username:
//         String(
//           user.username
//         ),

//       displayName:
//         user.display_name
//           ? String(
//               user.display_name
//             )
//           : null,

//       role:
//         String(
//           user.role ||
//             "user"
//         ),

//       /*
//        * IMPORTANT:
//        *
//        * Only paid series are stored here.
//        *
//        * Free is intentionally NOT present.
//        */

//       seriesAccess:
//         current.seriesAccess ||
//         {},

//       seriesAccessList:
//         current.seriesAccessList ||
//         [],
//     },
//   };
// }

// /*
// |--------------------------------------------------------------------------
// | TEST ACCESS
// |--------------------------------------------------------------------------
// |
// | Usage:
// |
// | requireTestAccess(
// |   request,
// |   "free",
// |   31
// | )
// |--------------------------------------------------------------------------
// */

// export async function requireTestAccess(
//   request,
//   seriesSlug,
//   rawTestId
// ) {
//   void request;

//   const series =
//     normalizeSeries(
//       seriesSlug
//     );

//   const testId =
//     Number(
//       rawTestId
//     );

//   /*
//    * Validation.
//    */

//   if (
//     !series ||
//     !Number.isInteger(
//       testId
//     ) ||
//     testId <= 0
//   ) {
//     return {
//       ok: false,

//       status: 400,

//       error:
//         "Invalid test route.",
//     };
//   }

//   /*
//    * Authentication.
//    */

//   const auth =
//     await requireAuthenticatedUser();

//   if (!auth.ok) {
//     return auth;
//   }

//   const config =
//     SERIES_CONFIG[
//       series
//     ];

//   /*
//    * --------------------------------------------------------------
//    * ACCESS
//    * --------------------------------------------------------------
//    *
//    * FREE:
//    *   automatically accessible.
//    *
//    * PAID:
//    *   must exist in the verified JWT.
//    *
//    * NO user_series_access query.
//    * --------------------------------------------------------------
//    */

//   const hasSeriesAccess =
//     !config.isPaid ||
//     auth.user.seriesAccess?.[
//       series
//     ] === true;

//   if (
//     !hasSeriesAccess
//   ) {
//     return {
//       ok: false,

//       status: 403,

//       code:
//         "SERIES_ACCESS_REQUIRED",

//       error:
//         "You do not have access to this test series.",
//     };
//   }

//   /*
//    * Test query.
//    */

//   const testResult =
//     await db.execute({
//       sql: `
//         SELECT
//           t.id,
//           t.series_id,
//           t.category_id,
//           t.title,
//           t.slug,
//           t.description,
//           t.duration_minutes,
//           t.total_questions,
//           t.total_marks,
//           t.is_published,

//           tc.name AS category_name,
//           tc.slug AS category_slug,
//           tc.is_active AS category_is_active

//         FROM ${config.tests} t

//         INNER JOIN test_categories tc
//           ON tc.id =
//             t.category_id

//         WHERE
//           t.id = ?
//           AND t.is_published = 1
//           AND tc.is_active = 1

//         LIMIT 1
//       `,

//       args: [
//         testId,
//       ],
//     });

//   const test =
//     testResult.rows?.[0];

//   if (!test) {
//     return {
//       ok: false,

//       status: 404,

//       error:
//         "Test not found or unpublished.",
//     };
//   }

//   /*
//    * Return test context.
//    */

//   return {
//     ok: true,

//     userId:
//       auth.userId,

//     user:
//       auth.user,

//     series: {
//       id:
//         config.id,

//       name:
//         config.name,

//       slug:
//         series,

//       isPaid:
//         config.isPaid,
//     },

//     config,

//     test: {
//       id:
//         Number(
//           test.id
//         ),

//       seriesId:
//         Number(
//           test.series_id ||
//             config.id
//         ),

//       categoryId:
//         Number(
//           test.category_id
//         ),

//       categoryName:
//         String(
//           test.category_name ||
//             ""
//         ),

//       categorySlug:
//         String(
//           test.category_slug ||
//             ""
//         ),

//       title:
//         String(
//           test.title
//         ),

//       slug:
//         String(
//           test.slug
//         ),

//       description:
//         test.description
//           ? String(
//               test.description
//             )
//           : null,

//       durationMinutes:
//         Number(
//           test.duration_minutes ||
//             0
//         ),

//       totalQuestions:
//         Number(
//           test.total_questions ||
//             0
//         ),

//       totalMarks:
//         Number(
//           test.total_marks ||
//             0
//         ),

//       isPublished:
//         Number(
//           test.is_published ||
//             0
//         ) === 1,

//       seriesName:
//         config.name,

//       seriesSlug:
//         series,

//       isPaid:
//         config.isPaid,

//       isDpp:
//         String(
//           test.category_slug ||
//             ""
//         ).toLowerCase() ===
//         "dpp",
//     },
//   };
// }

// /*
// |--------------------------------------------------------------------------
// | ATTEMPT ACCESS
// |--------------------------------------------------------------------------
// |
// | This helper is available for routes that need direct
// | attempt ownership verification.
// |--------------------------------------------------------------------------
// */

// export async function requireAttemptAccess(
//   request,
//   seriesSlug,
//   testId,
//   attemptId
// ) {
//   void request;

//   const series =
//     normalizeSeries(
//       seriesSlug
//     );

//   const parsedTestId =
//     Number(
//       testId
//     );

//   const parsedAttemptId =
//     Number(
//       attemptId
//     );

//   /*
//    * Validation.
//    */

//   if (
//     !series ||
//     !Number.isInteger(
//       parsedTestId
//     ) ||
//     parsedTestId <= 0 ||
//     !Number.isInteger(
//       parsedAttemptId
//     ) ||
//     parsedAttemptId <= 0
//   ) {
//     return {
//       ok: false,

//       status: 400,

//       error:
//         "Invalid attempt route.",
//     };
//   }

//   /*
//    * Authentication.
//    */

//   const auth =
//     await requireAuthenticatedUser();

//   if (!auth.ok) {
//     return auth;
//   }

//   const config =
//     SERIES_CONFIG[
//       series
//     ];

//   /*
//    * Series access.
//    */

//   const hasSeriesAccess =
//     !config.isPaid ||
//     auth.user.seriesAccess?.[
//       series
//     ] === true;

//   if (
//     !hasSeriesAccess
//   ) {
//     return {
//       ok: false,

//       status: 403,

//       code:
//         "SERIES_ACCESS_REQUIRED",

//       error:
//         "You do not have access to this test series.",
//     };
//   }

//   /*
//    * ONE attempt query.
//    *
//    * id + user_id + test_id
//    */

//   const result =
//     await db.execute({
//       sql: `
//         SELECT
//           id,
//           user_id,
//           test_id,
//           attempt_number,
//           status,
//           started_at,
//           submitted_at,
//           deadline_at,
//           score,
//           total_marks,
//           correct_count,
//           wrong_count,
//           unanswered_count,
//           time_taken_seconds,
//           created_at,
//           event_id
//         FROM ${config.attempts}
//         WHERE
//           id = ?
//           AND user_id = ?
//           AND test_id = ?
//         LIMIT 1
//       `,

//       args: [
//         parsedAttemptId,
//         auth.userId,
//         parsedTestId,
//       ],
//     });

//   const attempt =
//     result.rows?.[0];

//   if (!attempt) {
//     return {
//       ok: false,

//       status: 404,

//       error:
//         "Attempt not found or access denied.",
//     };
//   }

//   return {
//     ok: true,

//     userId:
//       auth.userId,

//     user:
//       auth.user,

//     config,

//     attempt,
//   };
// }