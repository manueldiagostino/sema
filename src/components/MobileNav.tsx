"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function MobileNav() {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith("/admin");

  return (
    <nav className="flex gap-4 sm:hidden">
      <Link
        href="/"
        transitionTypes={["page"]}
        className="text-xs font-medium text-muted transition-colors hover:text-foreground"
      >
        Home
      </Link>
      {!isAdminPage && (
        <Link
          href="/admin"
          transitionTypes={["page"]}
          className="text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          Admin
        </Link>
      )}
    </nav>
  );
}
