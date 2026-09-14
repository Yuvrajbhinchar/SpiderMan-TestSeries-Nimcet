import { Suspense } from "react";

import LoginClient from "./LoginClient";

function LoginFallback() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f8f9fc]" />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}