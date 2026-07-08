import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "User Admin Dashboard",
  description: "Internal-only unified view of users across Amplitude, Wix and Typeform.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
