import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";

// Kemble's brand headings use an italic editorial serif - Playfair Display
// is the closest Google Font match to the deck's wordmark/heading style.
const displayFont = Playfair_Display({
  subsets: ["latin"],
  style: ["italic"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "User Admin Dashboard",
  description: "Internal-only unified view of users across Amplitude, Wix and Typeform.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={displayFont.variable}>
      <body className="bg-kemble-cream text-kemble-ink antialiased">{children}</body>
    </html>
  );
}
