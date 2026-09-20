import { Toaster } from "sonner";

/*
 * KaTeX stylesheet.
 *
 * Imported once, globally, so every <MathText /> (attempt page,
 * analysis page, admin preview) renders with the correct fonts
 * and spacing. Must stay ABOVE ./globals.css so the app-level
 * .katex overrides in globals.css win.
 */
import "katex/dist/katex.min.css";

import "./globals.css";

import ReduxProvider from "@/components/providers/ReduxProvider";
import AuthProvider from "@/components/providers/AuthProvider";

export const metadata = {
  title: "SpiderMan",
  description:
    "Competitive exam preparation and test series.",
};

export default function RootLayout({
  children,
}) {
  return (
    <html lang="en">
      <body>
        <ReduxProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ReduxProvider>

        <Toaster
          position="top-right"
          richColors
          closeButton
          duration={3500}
        />
      </body>
    </html>
  );
}