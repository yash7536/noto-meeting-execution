"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { hydrateStore } from "@/lib/store";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/new-meeting", label: "New Meeting" },
  { href: "/meetings", label: "Meetings" },
  { href: "/execution-plans", label: "Execution Plans" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    hydrateStore();
  }, []);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/" || pathname.startsWith("/dashboard");
    return pathname.startsWith(href);
  }

  return (
    <>
      <header className="fixed top-0 inset-x-0 h-16 bg-surface-container-lowest/90 backdrop-blur-xl z-50 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 w-full px-gutter-desktop flex items-center justify-between gap-space-base">
          <div className="flex items-center gap-space-md min-w-0">
            <Logo className="truncate" />
          </div>
          <div className="flex items-center gap-space-base shrink-0">
            <div className="hidden lg:flex items-center gap-space-xs px-space-sm py-space-xs bg-surface-container-low rounded-lg">
              <Icon name="domain" className="text-secondary text-base" />
              <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                Workspace:
              </span>
              <span className="font-label-md text-label-md text-on-surface font-semibold">
                Acme Core Product
              </span>
            </div>
            <Link
              href="/new-meeting"
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-primary-container transition-colors"
            >
              <Icon name="add" className="text-base" />
              <span>New Meeting</span>
            </Link>
          </div>
        </div>
      </header>

      <aside className="fixed left-0 top-16 bottom-0 w-64 bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex flex-col py-space-base">
        <div className="flex flex-col gap-space-base px-space-md">
          <div className="px-space-sm">
            <p className="font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold">
              Navigation
            </p>
          </div>
          <nav className="flex flex-col gap-space-2xs">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={
                    active
                      ? "flex items-center px-space-md py-space-sm rounded-lg transition-colors bg-primary-container text-on-primary-container font-semibold font-label-md text-label-md"
                      : "flex items-center px-space-md py-space-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface transition-colors font-label-md text-label-md"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="pl-64">
        <main className="relative pt-16 w-full min-h-screen bg-surface">{children}</main>
      </div>
    </>
  );
}
