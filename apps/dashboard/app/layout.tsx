import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "sonner";

import { SessionBar } from "@/components/session-bar";
import { publicEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${publicEnv().NEXT_PUBLIC_APP_NAME} · Dashboard`,
  description: "Self-hosted visual feedback platform for prototypes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const env = publicEnv();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background text-foreground">
        <div className="flex min-h-screen flex-col">
          <header className="border-b bg-card">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-6 py-4">
              <Link href="/projects" className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="inline-block h-6 w-6 rounded-md bg-primary"
                  style={{ clipPath: "polygon(50% 0, 100% 35%, 80% 100%, 20% 100%, 0 35%)" }}
                />
                <span className="text-sm font-semibold tracking-tight">
                  {env.NEXT_PUBLIC_APP_NAME}
                </span>
              </Link>
              <nav className="flex items-center gap-3 text-sm">
                <Link className="text-muted-foreground hover:text-foreground" href="/projects">
                  Projects
                </Link>
                <SessionBar />
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <div className="mx-auto w-full max-w-6xl px-6 py-8">{children}</div>
          </main>
          <footer className="border-t bg-card/40">
            <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 text-xs text-muted-foreground">
              <span>{env.NEXT_PUBLIC_APP_NAME} · self-hosted</span>
              <span>API: {env.NEXT_PUBLIC_FEEDBACK_API_URL}</span>
            </div>
          </footer>
        </div>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
