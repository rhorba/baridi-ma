import type { ReactNode } from "react";
import { AuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata = {
  title: "Baridi.ma",
  description: "Cold-chain logistics tracker",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
