"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { Icon } from "./Icon";
import { Logo } from "./Logo";
import { ToastHost } from "./ToastHost";
import { hydrateStore } from "@/lib/store";
import { useSidebarCollapsed } from "@/lib/useSidebarCollapsed";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "grid_view" },
  { href: "/new-meeting", label: "New Meeting", icon: "add_circle" },
  { href: "/meetings", label: "Meetings", icon: "event_note" },
  { href: "/execution-plans", label: "Execution Plans", icon: "task_alt" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { collapsed, toggle, suppressTransition } = useSidebarCollapsed();

  useEffect(() => {
    hydrateStore();
  }, []);

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/" || pathname.startsWith("/dashboard");
    return pathname.startsWith(href);
  }

  const widthTransition = suppressTransition ? "" : "transition-[width] duration-300 ease-out";
  const paddingTransition = suppressTransition ? "" : "transition-[padding-left] duration-300 ease-out";

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
              <span className="font-label-md text-label-md text-on-surface-variant">
                Workspace <span className="text-on-surface font-semibold">· Noto</span>
              </span>
            </div>
            <Link
              href="/new-meeting"
              className="inline-flex items-center gap-space-xs px-space-md py-space-xs bg-primary text-on-primary font-label-md text-label-md rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:bg-primary-container active:scale-[0.97] transition-all"
            >
              <Icon name="add" className="text-base" />
              <span>New Meeting</span>
            </Link>
          </div>
        </div>
      </header>

      <aside
        className={`fixed left-0 top-16 bottom-0 ${
          collapsed ? "w-20" : "w-64"
        } ${widthTransition} bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] z-40 flex flex-col py-space-base animate-sidebar-in`}
      >
        <div className="flex flex-col gap-space-base px-space-md w-full">
          <div className={`flex items-center ${collapsed ? "justify-center px-0" : "justify-between px-space-sm"}`}>
            <p
              className={`font-label-sm text-label-sm text-outline uppercase tracking-wider font-semibold overflow-hidden whitespace-nowrap transition-all duration-200 ${
                collapsed ? "max-w-0 opacity-0" : "max-w-[140px] opacity-100"
              }`}
            >
              Navigation
            </p>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-outline hover:text-on-surface hover:bg-surface-container-low active:scale-90 transition-all shrink-0"
            >
              <Icon
                name="chevron_left"
                className={`text-lg transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
              />
            </button>
          </div>
          <nav className="flex flex-col gap-space-2xs">
            {NAV.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group relative flex items-center ${collapsed ? "justify-center px-0" : "px-space-md"} py-space-sm rounded-lg active:scale-[0.98] transition-all font-label-md text-label-md ${
                    active
                      ? "bg-primary-container text-on-primary-container font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  <Icon name={item.icon} className="text-lg shrink-0" />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                      collapsed ? "max-w-0 opacity-0 ml-0" : "max-w-[160px] opacity-100 ml-space-sm"
                    }`}
                  >
                    {item.label}
                  </span>
                  {collapsed && (
                    <span className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-space-sm px-space-sm py-space-2xs rounded-md bg-inverse-surface text-inverse-on-surface font-label-sm text-label-sm whitespace-nowrap opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 z-50 shadow-md">
                      {item.label}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className={`${collapsed ? "pl-20" : "pl-64"} ${paddingTransition}`}>
        <main className="relative pt-16 w-full min-h-screen bg-surface animate-page-in">{children}</main>
      </div>

      <ToastHost />
    </>
  );
}
