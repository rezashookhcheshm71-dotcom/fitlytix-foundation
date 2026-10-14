import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
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
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
        <Panel className="animate-rise rounded-3xl p-8">
          <h1 className="text-2xl font-extrabold">ورود به FitLytix</h1>
          <p className="mt-1 text-sm text-muted-foreground">با ایمیل و رمز عبور وارد شوید.</p>
          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5">
              <Label htmlFor="id">ایمیل</Label>
              <Input id="id" value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" dir="ltr" className="h-11 font-display" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">رمز عبور</Label>
              <Input id="pw" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••••" dir="ltr" className="h-11" required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "در حال ورود..." : "ورود"}
            </Button>
          </form>
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/register" search={redirect ? { redirect } : {}} className="text-primary hover:underline">
              حساب ندارید؟ ثبت‌نام
            </Link>
            <Link to="/coach" className="hover:text-foreground">ورود مربی</Link>
          </div>
        </Panel>
      </div>
    </MarketingShell>
  );
}
