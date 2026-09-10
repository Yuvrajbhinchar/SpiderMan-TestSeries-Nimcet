import { NextResponse } from "next/server";

import { db } from "@/lib/turso";
import {
  getCurrentUser,
  clearAuthCookie,
} from "@/lib/auth";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (user?.id) {
      await db.execute({
        sql: `
          UPDATE users
          SET
            active_session_id = NULL,
            active_device_id = NULL,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
        args: [user.id],
      });
    }

    await clearAuthCookie();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Logout API error:", error);

    /*
     * Even if DB update fails, remove the browser cookie.
     */
    await clearAuthCookie();

    return NextResponse.json(
      {
        success: false,
        error: "Logout completed locally.",
      },
      { status: 200 }
    );
  }
}