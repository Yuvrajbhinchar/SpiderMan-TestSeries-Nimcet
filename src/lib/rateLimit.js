/*
|--------------------------------------------------------------------------
| SIMPLE IN-MEMORY RATE LIMITER
|--------------------------------------------------------------------------
|
| IMPORTANT:
| - No Turso query
| - No database table
| - No extra dependency
|
| This limits requests per running server instance.
|--------------------------------------------------------------------------
*/

const buckets =
  new Map();

const CLEANUP_INTERVAL_MS =
  60 * 1000;

let lastCleanupAt =
  Date.now();

/*
|--------------------------------------------------------------------------
| CLEANUP
|--------------------------------------------------------------------------
*/

function cleanupExpiredBuckets() {
  const now =
    Date.now();

  if (
    now - lastCleanupAt <
    CLEANUP_INTERVAL_MS
  ) {
    return;
  }

  lastCleanupAt =
    now;

  for (
    const [
      key,
      bucket,
    ] of buckets
  ) {
    if (
      bucket.resetAt <=
      now
    ) {
      buckets.delete(
        key
      );
    }
  }
}

/*
|--------------------------------------------------------------------------
| RATE LIMIT
|--------------------------------------------------------------------------
*/

export function rateLimit({
  key,
  limit,
  windowMs,
}) {
  cleanupExpiredBuckets();

  const now =
    Date.now();

  const safeKey =
    String(
      key ?? ""
    )
      .slice(
        0,
        300
      );

  if (!safeKey) {
    return {
      allowed: true,

      remaining:
        limit,

      retryAfterSeconds: 0,
    };
  }

  let bucket =
    buckets.get(
      safeKey
    );

  /*
   * Start a new window.
   */

  if (
    !bucket ||
    bucket.resetAt <=
      now
  ) {
    bucket = {
      count: 0,

      resetAt:
        now +
        windowMs,
    };

    buckets.set(
      safeKey,
      bucket
    );
  }

  bucket.count +=
    1;

  const remaining =
    Math.max(
      0,
      limit -
        bucket.count
    );

  const retryAfterSeconds =
    Math.max(
      1,
      Math.ceil(
        (bucket.resetAt -
          now) /
          1000
      )
    );

  if (
    bucket.count >
    limit
  ) {
    return {
      allowed: false,

      remaining: 0,

      retryAfterSeconds,

      resetAt:
        bucket.resetAt,
    };
  }

  return {
    allowed: true,

    remaining,

    retryAfterSeconds,

    resetAt:
      bucket.resetAt,
  };
}

/*
|--------------------------------------------------------------------------
| CLIENT IP
|--------------------------------------------------------------------------
*/

export function getClientIp(
  request
) {
  const forwardedFor =
    request.headers.get(
      "x-forwarded-for"
    );

  if (
    forwardedFor
  ) {
    const firstIp =
      forwardedFor
        .split(",")[0]
        ?.trim();

    if (
      firstIp &&
      firstIp.length <=
        100
    ) {
      return firstIp;
    }
  }

  const realIp =
    request.headers.get(
      "x-real-ip"
    );

  if (
    realIp &&
    realIp.length <=
      100
  ) {
    return realIp.trim();
  }

  return "unknown";
}