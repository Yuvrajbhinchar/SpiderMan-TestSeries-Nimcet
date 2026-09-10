import { Toaster } from "sonner";
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