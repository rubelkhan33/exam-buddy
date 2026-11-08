"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, use, type ReactNode } from "react";
import { browser } from "react-dom";
import { Icon } from "./icons";

/** Renders children only in the browser (progress lives in localStorage). */
function BrowserOnly({ children }: { children: ReactNode }) {
  use(browser("Progress and exam history are stored in this browser's localStorage."));
  return <>{children}</>;
}

export function ClientScreen({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <BrowserOnly>{children}</BrowserOnly>
    </Suspense>
  );
}

export function LoadingScreen({ text = "লোড হচ্ছে…" }: { text?: string }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md items-center justify-center text-muted">{text}</div>
  );
}

const NAV = [
  { href: "/", label: "হোম", icon: "home" },
  { href: "/topics", label: "পরীক্ষা", icon: "book" },
  { href: "/review", label: "রিভিউ", icon: "clock" },
  { href: "/analytics", label: "অ্যানালিটিক্স", icon: "chart" },
] as const;

export function Screen({
  children,
  nav = false,
  footer,
}: {
  children: ReactNode;
  nav?: boolean;
  footer?: ReactNode;
}) {
  const path = usePathname();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-bg">
      <main className="flex flex-1 flex-col gap-4 px-5 pt-5 pb-6">{children}</main>
      {footer && (
        <div className="sticky bottom-0 z-10 border-t border-line bg-nav px-5 pt-3.5 pb-6">{footer}</div>
      )}
      {nav && (
        <nav
          aria-label="প্রধান মেনু"
          className="no-print sticky bottom-0 z-10 grid grid-cols-4 border-t border-line bg-nav px-2 pt-2 pb-5"
        >
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-semibold text-accent" : "text-muted"
                }`}
              >
                <Icon name={n.icon} size={22} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function Header({ title, subtitle, back }: { title: string; subtitle?: string; back?: string }) {
  return (
    <div className="flex items-center gap-3">
      {back && (
        <Link
          href={back}
          aria-label="পিছনে"
          className="flex size-11 shrink-0 items-center justify-center rounded-[14px] border border-line bg-surface"
        >
          <Icon name="back" size={20} />
        </Link>
      )}
      <div className="flex min-w-0 flex-col">
        <h1 className="text-xl font-bold">{title}</h1>
        {subtitle && <span className="truncate text-[13px] text-muted">{subtitle}</span>}
      </div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[18px] border border-line bg-surface p-4 ${className}`}>{children}</div>;
}

export function Bar({ ratio, warn, height = 8 }: { ratio: number; warn?: boolean; height?: number }) {
  return (
    <div className="w-full rounded-full bg-line" style={{ height }}>
      <div
        className={`rounded-full ${warn ? "bg-warn-bar" : "bg-accent"}`}
        style={{ height, width: `${Math.max(0, Math.min(1, ratio)) * 100}%` }}
      />
    </div>
  );
}

export function Ring({ ratio, children }: { ratio: number; children: ReactNode }) {
  const p = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  return (
    <div
      className="flex size-24 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(var(--color-accent) 0 ${p}%, var(--color-line) ${p}% 100%)` }}
    >
      <div className="flex size-[78px] flex-col items-center justify-center rounded-full bg-surface">{children}</div>
    </div>
  );
}

export function Num({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`font-num font-bold ${className}`}>{children}</span>;
}

export function Chip({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-9 rounded-full px-3.5 text-[13px] ${
        active ? "bg-accent font-semibold text-accent-ink" : "border border-line bg-surface text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function Tag({ children, tone = "neutral" }: { children: ReactNode; tone?: "info" | "warn" | "neutral" }) {
  const cls =
    tone === "info"
      ? "bg-info-bg text-info font-semibold"
      : tone === "warn"
        ? "bg-warn-bg text-warn font-semibold"
        : "bg-surface-2 text-muted";
  return <span className={`rounded-lg px-2.5 py-0.5 text-xs ${cls}`}>{children}</span>;
}

export function PrimaryLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`flex h-[52px] items-center justify-center rounded-[14px] bg-accent text-base font-bold text-accent-ink ${className}`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-start gap-2">
      <span className="text-[15px] font-semibold">{title}</span>
      <span className="text-sm leading-relaxed text-muted">{text}</span>
      {action}
    </Card>
  );
}
