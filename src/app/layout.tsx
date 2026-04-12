import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CleanRoute Pro — Riley Tech Studio",
  description:
    "Intelligent route scheduling and optimization for cleaning teams. Auto-calculate travel time, distance and wages between jobs using real-time map data.",
  keywords: ["route scheduling", "cleaning company", "travel time calculator", "team management"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full overflow-hidden antialiased">{children}</body>
    </html>
  );
}
