import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function MarketingShell({ children, minimal }: { children: ReactNode; minimal?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 md:px-8">
          <Logo />
          {!minimal && (
            <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
              <a href="/#journey" className="transition-colors hover:text-foreground">چطور کار می‌کند</a>
              <a href="/#sports" className="transition-colors hover:text-foreground">رشته‌ها</a>
              <a href="/#intelligence" className="transition-colors hover:text-foreground">مربی‌گری</a>
              <Link to="/plans" className="transition-colors hover:text-foreground">پلن‌ها</Link>
            </nav>
          )}
          <div className="ms-auto flex items-center gap-1.5 sm:gap-2 lg:ms-0">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login"><span className="hidden sm:inline">ورود به </span>FitLytix</Link>
            </Button>
            <Button asChild variant="hero" size="sm">
              <Link to="/register">شروع ارزیابی</Link>
            </Button>
            {!minimal && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="باز کردن فهرست">
                    <Menu />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[84vw] border-e border-border bg-background p-6">
                  <SheetTitle className="sr-only">فهرست FitLytix</SheetTitle>
                  <Logo className="mb-10" />
                  <nav className="flex flex-col gap-1 text-base font-semibold">
                    <SheetClose asChild><a href="/#journey" className="rounded-lg px-3 py-3 hover:bg-accent">چطور کار می‌کند</a></SheetClose>
                    <SheetClose asChild><a href="/#sports" className="rounded-lg px-3 py-3 hover:bg-accent">رشته‌های ورزشی</a></SheetClose>
                    <SheetClose asChild><a href="/#intelligence" className="rounded-lg px-3 py-3 hover:bg-accent">AI + مربی انسانی</a></SheetClose>
                    <SheetClose asChild><Link to="/plans" className="rounded-lg px-3 py-3 hover:bg-accent">پلن‌ها و قیمت</Link></SheetClose>
                    <SheetClose asChild><Link to="/athlete/dashboard" className="rounded-lg px-3 py-3 hover:bg-accent">داشبورد نمونه</Link></SheetClose>
                  </nav>
                  <Button asChild variant="hero" size="lg" className="mt-8 w-full">
                    <SheetClose asChild><Link to="/register">شروع ارزیابی</Link></SheetClose>
                  </Button>
                </SheetContent>
              </Sheet>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border/50 bg-card/25 py-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 md:grid-cols-[1.4fr_1fr_1fr] md:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-sm leading-7 text-muted-foreground">پلتفرم هوشمند مربی‌گری و عملکرد؛ برای ورزشکارانی که می‌خواهند دقیق‌تر تمرین کنند.</p>
          </div>
          <div>
            <div className="mb-3 text-xs font-bold text-foreground">محصول</div>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <Link to="/athlete/dashboard" className="hover:text-foreground">داشبورد ورزشکار</Link>
              <Link to="/coach" className="hover:text-foreground">فرماندهی مربی</Link>
              <Link to="/plans" className="hover:text-foreground">پلن‌ها</Link>
            </div>
          </div>
          <div>
            <div className="mb-3 text-xs font-bold text-foreground">شروع مسیر</div>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <Link to="/register" className="hover:text-foreground">ساخت حساب</Link>
              <Link to="/assessment/common" className="hover:text-foreground">ارزیابی عمومی</Link>
              <Link to="/login" className="hover:text-foreground">ورود</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-8 flex w-full max-w-7xl flex-col gap-2 border-t border-border/60 px-4 pt-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span>FitLytix © ۱۴۰۵ — نسخه نمایشی محصول</span>
          <span className="font-display">Athlete · Human Coach · Intelligence · Performance Data</span>
        </div>
      </footer>
    </div>
  );
}
