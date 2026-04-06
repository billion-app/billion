import type { Metadata, Viewport } from "next";
import {
  Albert_Sans,
  Geist_Mono,
  IBM_Plex_Serif,
  Inria_Serif,
} from "next/font/google";

import { cn } from "@acme/ui";
import { Toaster } from "@acme/ui/toast";

import { env } from "~/env";
import { TRPCReactProvider } from "~/trpc/react";

import "~/app/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    env.VERCEL_ENV === "production"
      ? "https://billion-news.app"
      : "http://localhost:3000",
  ),
  icons: { icon: "/billion-logo.png", apple: "/billion-logo.png" },
  title: "Billion — Civic Intelligence for Every American",
  description:
    "Bills, executive orders, and court cases — in plain language, from every angle. AI-powered civic information for the people.",
  openGraph: {
    title: "Billion — Civic Intelligence for Every American",
    description:
      "Bills, executive orders, and court cases — in plain language, from every angle.",
    siteName: "Billion",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1530" },
  ],
};

const ibmPlexSerif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-ibm-plex-serif",
});

const inriaSerif = Inria_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-inria-serif",
});

const albertSans = Albert_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-albert-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "bg-background text-foreground min-h-screen font-sans antialiased",
          ibmPlexSerif.variable,
          inriaSerif.variable,
          albertSans.variable,
          geistMono.variable,
        )}
      >
        <TRPCReactProvider>{props.children}</TRPCReactProvider>
        <Toaster />
      </body>
    </html>
  );
}
