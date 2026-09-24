"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles } from "lucide-react";

export function Header() {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "Home" },
    { href: "/text-ai-assistants", label: "App" },
  ];

  return (
    <header className="border-b border-border bg-background">
      <div className="content-grid flex h-[66px] items-center justify-between gap-4">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 font-semibold text-foreground">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-surface text-primary">
            <Sparkles className="size-3.5" aria-hidden="true" />
          </span>
          <span className="truncate text-sm sm:text-base">AI Text Enhancer</span>
        </Link>
        <nav aria-label="Main navigation" className="flex h-full shrink-0 items-center gap-5 sm:gap-7">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full items-center border-b-2 px-0.5 text-sm transition-colors hover:text-foreground sm:text-base ${active ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
