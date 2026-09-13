import {
  adminSuccess,
} from "@/lib/adminSecurity";

import {
  withAdmin,
} from "@/lib/adminApi";

/* =========================================================
   GET
   /api/admin/me
========================================================= */

export const GET =
  withAdmin(
    async ({
      user,
      userId,
      role,
    }) => {
      return adminSuccess(
        {
          authenticated:
            true,

          admin: {
            id:
              Number(
                userId
              ),

            username:
              user?.username ||
              null,

            displayName:
              user?.display_name ||
              user?.displayName ||
              null,

            email:
              user?.email ||
              null,

            role,
          },
        },
        200
      );
    },
    {
      logContext:
        "[GET /api/admin/me]",
    }
  );