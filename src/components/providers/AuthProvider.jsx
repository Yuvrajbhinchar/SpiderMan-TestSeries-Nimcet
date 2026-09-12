"use client";

import {
  useEffect,
  useRef,
} from "react";

import {
  useDispatch,
} from "react-redux";

import {
  setAuth,
  clearAuth,
} from "@/store/authSlice";

import {
  clearTestLibraryCache,
} from "@/store/testLibrarySlice";

export default function AuthProvider({
  children,
}) {
  const dispatch =
    useDispatch();

  const initialized =
    useRef(false);

  useEffect(() => {
    if (
      initialized.current
    ) {
      return;
    }

    initialized.current =
      true;

    async function bootstrapAuth() {
      try {
        const response =
          await fetch(
            "/api/auth/me",
            {
              method: "GET",

              credentials:
                "include",

              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => ({})
            );

        /*
         * ------------------------------------------------------
         * AUTH FAILED
         * ------------------------------------------------------
         *
         * Clear both auth state and any user-specific
         * dashboard test cache.
         *
         * This prevents stale cached test lists from surviving
         * a logout / expired session / account switch.
         */

        if (
          !response.ok ||
          !data.authenticated
        ) {
          dispatch(
            clearAuth()
          );

          dispatch(
            clearTestLibraryCache()
          );

          return;
        }

        /*
         * ------------------------------------------------------
         * AUTH SUCCESS
         * ------------------------------------------------------
         *
         * Clear previous user's dashboard cache BEFORE
         * loading the newly authenticated user's data.
         */

        dispatch(
          clearTestLibraryCache()
        );

        dispatch(
          setAuth({
            user:
              data.user,

            access:
              data.access ||
              {},
          })
        );
      } catch (error) {
        console.error(
          "Auth bootstrap error:",
          error
        );

        /*
         * Never leave potentially stale user-specific
         * dashboard data in Redux after an auth bootstrap
         * failure.
         */

        dispatch(
          clearAuth()
        );

        dispatch(
          clearTestLibraryCache()
        );
      }
    }

    bootstrapAuth();
  }, [dispatch]);

  return children;
}