import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export function MarketingShell({ children, minimal }: { children: ReactNode; minimal?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 md:px-8">
          <Logo />
          {!minimal && (
            <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
              <Link to="/athlete/dashboard" className="transition-colors hover:text-foreground">ورزشکار</Link>
              <Link to="/coach" className="transition-colors hover:text-foreground">مربی</Link>
              <Link to="/plans" className="transition-colors hover:text-foreground">پلن‌ها</Link>
            </nav>
          )}
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">ورود</Link>
            </Button>
            <Button asChild variant="hero" size="sm">
              <Link to="/register">شروع رایگان</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground md:flex-row md:px-8">
          <span>FitLytix © ۱۴۰۴ — پلتفرم هوشمند مربی‌گری ورزشی</span>
          <span className="font-display">Athlete · Coach · AI Engine · Performance Data</span>
        </div>
      </footer>
    </div>
  );
}
