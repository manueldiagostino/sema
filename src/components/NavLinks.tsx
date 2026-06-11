"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function NavLinks() {
  const pathname = usePathname();
  const isAdminPage = pathname?.startsWith("/admin");

  return (
    <>
      <Link
        href="/"
        transitionTypes={["page"]}
        className="text-sm text-secondary transition-colors hover:text-foreground"
      >
        Home
      </Link>
      {!isAdminPage && (
        <Link
          href="/admin"
          transitionTypes={["page"]}
          className="text-sm text-secondary transition-colors hover:text-foreground"
        >
          Admin
        </Link>
      )}
    </>
  );
}
