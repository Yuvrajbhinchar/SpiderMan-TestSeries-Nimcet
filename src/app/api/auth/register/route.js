import { NextResponse } from "next/server";
import { db } from "@/lib/turso";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_.-]+$/.test(username);
}

export async function POST(request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const username = String(body.username || "")
      .trim()
      .toLowerCase();

    const email = String(body.email || "")
      .trim()
      .toLowerCase();

    /*
     * IMPORTANT:
     * Do NOT trim passwords.
     */
    const password = String(body.password || "");

    if (
      !name ||
      !username ||
      !email ||
      !password
    ) {
      return NextResponse.json(
        {
          error: "All fields are required.",
        },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        {
          error: "Name is too long.",
        },
        { status: 400 }
      );
    }

    if (
      username.length < 3 ||
      username.length > 30
    ) {
      return NextResponse.json(
        {
          error:
            "Username must be between 3 and 30 characters.",
        },
        { status: 400 }
      );
    }

    if (!isValidUsername(username)) {
      return NextResponse.json(
        {
          error:
            "Username can contain only letters, numbers, dot, underscore and hyphen.",
        },
        { status: 400 }
      );
    }

    if (email.length > 254) {
      return NextResponse.json(
        {
          error: "Email address is too long.",
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          error:
            "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        {
          error:
            "Password must be at least 6 characters long.",
        },
        { status: 400 }
      );
    }

    /*
     * Check username OR email.
     */
    const existingUser = await db.execute({
      sql: `
        SELECT
          id,
          username,
          email
        FROM users
        WHERE username = ?
           OR email = ?
        LIMIT 1
      `,
      args: [username, email],
    });

    if (existingUser.rows.length > 0) {
      const existing = existingUser.rows[0];

      if (
        String(existing.username || "")
          .toLowerCase() === username
      ) {
        return NextResponse.json(
          {
            error:
              "Username is already taken.",
          },
          { status: 409 }
        );
      }

      if (
        String(existing.email || "")
          .toLowerCase() === email
      ) {
        return NextResponse.json(
          {
            error:
              "Email is already registered.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          error:
            "An account with these details already exists.",
        },
        { status: 409 }
      );
    }

    const result = await db.execute({
      sql: `
        INSERT INTO users (
          username,
          email,
          password,
          display_name,
          role,
          is_active
        )
        VALUES (?, ?, ?, ?, 'user', 1)
      `,
      args: [
        username,
        email,
        password,
        name,
      ],
    });

    return NextResponse.json(
      {
        success: true,
        userId: Number(
          result.lastInsertRowid
        ),
        message:
          "Account created successfully.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Register API error:",
      error
    );

    /*
     * Handle race-condition / UNIQUE constraint
     * errors gracefully.
     */
    const errorMessage = String(
      error?.message || ""
    ).toLowerCase();

    if (
      errorMessage.includes("unique") ||
      errorMessage.includes("constraint")
    ) {
      return NextResponse.json(
        {
          error:
            "Username or email is already registered.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error:
          "Unable to create account. Please try again.",
      },
      { status: 500 }
    );
  }
}