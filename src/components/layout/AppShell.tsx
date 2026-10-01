import type { ReactNode } from "react";
import { Link, type LinkProps } from "@tanstack/react-router";
import {
  AlertTriangle,
  Apple,
  Bell,
  BatteryCharging,
  CalendarDays,
  IdCard,
  Sparkles,
  Target,
  UserCog,
  Watch,
  Dna,
  Dumbbell,
  LayoutDashboard,
  LineChart,
  Library,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar } from "@/components/domain/athlete";
import { MockBadge } from "@/components/domain/primitives";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notificationService } from "@/services/notifications/service";

type NavItem = { to: NonNullable<LinkProps["to"]>; label: string; icon: LucideIcon };

const athleteNav: NavItem[] = [
  { to: "/athlete/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { to: "/athlete/program", label: "برنامه", icon: CalendarDays },
  { to: "/athlete/performance", label: "عملکرد", icon: LineChart },
  { to: "/athlete/fitness-dna", label: "Fitness DNA", icon: Dna },
  { to: "/athlete/nutrition", label: "تغذیه", icon: Apple },
  { to: "/athlete/recovery", label: "ریکاوری", icon: BatteryCharging },
  { to: "/athlete/goals", label: "هدف‌ها", icon: Target },
  { to: "/athlete/health", label: "سلامت", icon: Watch },
  { to: "/athlete/passport", label: "پاسپورت", icon: IdCard },
];

const coachNav: NavItem[] = [
  { to: "/coach", label: "خلاصه", icon: LayoutDashboard },
  { to: "/coach/athletes", label: "ورزشکاران", icon: Users },
  { to: "/coach/attention", label: "نیاز به توجه", icon: AlertTriangle },
  { to: "/coach/assistant", label: "دستیار", icon: Sparkles },
  { to: "/coach/programs", label: "برنامه‌ها", icon: CalendarDays },
  { to: "/coach/nutrition", label: "تغذیه", icon: Apple },
  { to: "/coach/performance", label: "عملکرد", icon: LineChart },
  { to: "/coach/exercises", label: "پایگاه حرکات", icon: Library },
  { to: "/coach/profile", label: "پروفایل", icon: UserCog },
];

export function AppShell({
  mode,
  children,
  userName,
  userRole,
}: {
  mode: "athlete" | "coach";
  children: ReactNode;
  userName: string;
  userRole: string;
}) {
  const nav = mode === "athlete" ? athleteNav : coachNav;
  const switchTo = mode === "athlete" ? { to: "/coach" as const, label: "نمای مربی" } : { to: "/athlete/dashboard" as const, label: "نمای ورزشکار" };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-sidebar-border bg-sidebar/80 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo />
        </div>
        <div className="px-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {mode === "athlete" ? "Athlete" : "Coach Command Center"}
        </div>
        <nav className="flex flex-col gap-1 px-3">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/coach" }}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
              activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground shadow-[inset_3px_0_0_var(--primary)]" }}
            >
              <n.icon className="size-4.5 transition-colors group-[.active]:text-primary" />
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-3 p-4">
          <Link
            to={switchTo.to}
            className="flex items-center justify-between rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <span>{switchTo.label}</span>
            <Dumbbell className="size-3.5" />
          </Link>
          <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent p-3">
            <Avatar name={userName} />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{userName}</div>
              <div className="truncate text-[11px] text-muted-foreground">{userRole}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:h-16 md:px-8">
          <div className="flex items-center gap-3 lg:hidden">
            <Link to="/"><LogoMark className="size-8" /></Link>
            <span className="text-sm font-bold">{mode === "athlete" ? "ورزشکار" : "مربی"}</span>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            <MockBadge label="نسخه نمایشی · داده‌های شبیه‌سازی‌شده" />
          </div>
          <div className="flex items-center gap-2">
<Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative rounded-full text-muted-foreground" aria-label="اعلان‌ها">
                  <Bell className="size-4" />
                  <span className="absolute end-2 top-2 size-1.5 rounded-full bg-primary" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80" dir="rtl">
                <div className="mb-2 text-sm font-bold">یادآوری‌ها</div>
                <ul className="space-y-2">{notificationService.upcoming("ath_001").map((n) => <li key={n.id} className="rounded-lg bg-muted/40 p-2"><div className="flex justify-between text-xs font-semibold"><span>{n.title}</span><span className="text-muted-foreground">{n.scheduledFor}</span></div><p className="text-[11px] text-muted-foreground">{n.body}</p></li>)}</ul>
                <p className="mt-2 text-[10px] text-muted-foreground">نمونه نمایشی؛ ارسال اعلان، پیامک یا ایمیل هنوز وصل نیست.</p>
              </PopoverContent>
            </Popover>
            <Link to={switchTo.to} className="lg:hidden">
              <Avatar name={userName} className="size-9" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:pb-12">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 z-40 lg:hidden">
          <div className="mx-auto mb-3 flex w-[calc(100%-2rem)] max-w-md items-center gap-1 overflow-x-auto rounded-2xl glass px-2 py-2 shadow-card [scrollbar-width:none]">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/coach" }}
                className={cn("flex shrink-0 flex-col items-center gap-1 rounded-xl px-3 py-1.5 text-[10px] font-medium whitespace-nowrap text-muted-foreground transition-colors")}
                activeProps={{ className: "text-primary" }}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
