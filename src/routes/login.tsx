import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Activity, Lock, LogIn, Mail, ShieldCheck, Users } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/domain/primitives";
import { signInWithEmail } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "ورود — FitLytix" },
      { name: "description", content: "ورود به حساب ورزشکار یا مربی FitLytix." },
    ],
  }),
  component: LoginPage,
});

// Three promises, each with a glyph, for the brand column. They restate claims the
// product already makes elsewhere; nothing new is asserted here.
const PROMISES = [
  { icon: Activity, text: "عددِ خام و مرجعِ منتشرشده، نه یک نمره‌ی سیاه‌جعبه." },
  { icon: ShieldCheck, text: "حساب و داده در دیتابیس مستقل FitLytix." },
  { icon: Users, text: "ورزشکار و مربی، هر دو از همین در." },
];

function LoginPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: authError } = await signInWithEmail(email.trim(), password);
    setLoading(false);

    if (authError) {
      setError(authError.message || "ایمیل یا رمز عبور صحیح نیست.");
      return;
    }

    if (redirect && redirect.startsWith("/")) {
      window.location.href = redirect;
      return;
    }

    navigate({ to: "/athlete/dashboard", search: {} });
  }

  return (
    <MarketingShell minimal>
      <div className="mx-auto w-full max-w-4xl px-4 py-14">
        <Panel
          variant="raised"
          className="animate-rise grid overflow-hidden rounded-3xl md:grid-cols-[1fr_0.9fr]"
        >
          {/* Form column */}
          <div className="p-8 sm:p-10">
            <h1 className="text-2xl font-extrabold">ورود به FitLytix</h1>
            <p className="mt-1 text-sm text-muted-foreground">با ایمیل و رمز عبور وارد شوید.</p>
            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="id">ایمیل</Label>
                <div className="relative" dir="ltr">
                  <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
                    <Mail className="size-4" />
                  </span>
                  <Input
                    id="id"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="you@example.com"
                    dir="ltr"
                    className="h-11 ps-10 font-display"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">رمز عبور</Label>
                <div className="relative" dir="ltr">
                  <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
                    <Lock className="size-4" />
                  </span>
                  <Input
                    id="pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    dir="ltr"
                    className="h-11 ps-10"
                    required
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
                {loading ? "در حال ورود..." : "ورود"} <LogIn className="size-4" />
              </Button>
            </form>
            <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
              <Link
                to="/register"
                search={redirect ? { redirect } : {}}
                className="text-primary hover:underline"
              >
                حساب ندارید؟ ثبت‌نام
              </Link>
              <Link to="/coach" className="hover:text-foreground">
                ورود مربی
              </Link>
            </div>
          </div>

          {/* Brand column: gives the card a reason to be wide instead of a small
              box floating in empty space. Hidden on narrow screens where the
              form should own the viewport. */}
          <div className="relative hidden flex-col justify-center gap-7 border-s border-border/60 bg-card/40 p-10 md:flex">
            <div
              className="grid-noise pointer-events-none absolute inset-0 opacity-30"
              aria-hidden
            />
            <Logo />
            <ul className="relative space-y-5">
              {PROMISES.map((p) => (
                <li key={p.text} className="flex items-start gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <p.icon className="size-4" />
                  </span>
                  <span className="text-sm leading-6 text-muted-foreground">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>
    </MarketingShell>
  );
}
