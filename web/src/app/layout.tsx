import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sema — TEI Corpus Explorer",
  description: "A scholarly platform for exploring XML TEI corpora",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="border-b border-border bg-background px-4 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <Link href="/" className="text-lg font-bold text-primary sm:text-xl">
              Sema
            </Link>
            <nav className="hidden gap-6 sm:flex">
              <Link
                href="/"
                className="text-sm text-muted transition-colors hover:text-foreground"
              >
                Home
              </Link>
            </nav>
            <MobileNav />
          </div>
        </header>
        <GlobalErrorBoundary>{children}</GlobalErrorBoundary>
      </body>
    </html>
  );
}

function MobileNav() {
  return (
    <nav className="flex gap-4 sm:hidden">
      <Link
        href="/"
        className="text-xs font-medium text-muted transition-colors hover:text-foreground"
      >
        Home
      </Link>
    </nav>
  );
}
