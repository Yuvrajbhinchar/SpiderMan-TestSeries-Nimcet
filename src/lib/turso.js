import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim();

if (!url) {
  throw new Error("Missing TURSO_DATABASE_URL in .env.local");
}

if (!authToken) {
  throw new Error("Missing TURSO_AUTH_TOKEN in .env.local");
}

console.log(
  `[Turso] Connecting to: ${url.replace(
    /^(.{12}).*(\.turso\.io.*)$/,
    "$1...$2"
  )}`
);

export const db = createClient({
  url,
  authToken,
});