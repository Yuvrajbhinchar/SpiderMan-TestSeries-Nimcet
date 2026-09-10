"use client";

import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";

import {
  setAuth,
  clearAuth,
} from "@/store/authSlice";

export default function AuthProvider({
  children,
}) {
  const dispatch = useDispatch();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) {
      return;
    }

    initialized.current = true;

    async function bootstrapAuth() {
      try {
        const response = await fetch(
          "/api/auth/me",
          {
            method: "GET",
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.authenticated) {
          dispatch(clearAuth());
          return;
        }

        dispatch(
          setAuth({
            user: data.user,
            access: data.access || {},
          })
        );
      } catch (error) {
        console.error(
          "Auth bootstrap error:",
          error
        );

        dispatch(clearAuth());
      }
    }

    bootstrapAuth();
  }, [dispatch]);

  return children;
}