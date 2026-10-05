import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel } from "@/components/domain/primitives";
import { createAthleteProfile, ensureProfile, signUpWithEmail } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "ثبت‌نام — FitLytix" },
      { name: "description", content: "ساخت حساب مستقل FitLytix." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", password: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await signUpWithEmail(form);
    if (authError) {
      setLoading(false);
      setError(authError.message);
      return;
    }

    if (!data.user) {
      setLoading(false);
      setError("ثبت‌نام انجام نشد. دوباره تلاش کنید.");
      return;
    }

    const profileResult = await ensureProfile(data.user.id, form);
    if (profileResult.error) {
      setLoading(false);
      setError("حساب ساخته شد اما ذخیره اطلاعات پروفایل کامل نشد.");
      return;
    }

    const athleteResult = await createAthleteProfile(data.user.id);
    if (athleteResult.error) {
      setLoading(false);
      setError("حساب ساخته شد اما ساخت پروفایل ورزشکار کامل نشد.");
      return;
    }

    setLoading(false);
    setDone(true);
  }

  if (done) {
    return (
      <MarketingShell minimal>
        <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-16">
          <Panel className="animate-rise rounded-3xl p-8">
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-8" />
              </span>
              <h1 className="text-2xl font-extrabold">حساب FitLytix ساخته شد</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                اگر تأیید ایمیل فعال باشد، لینک تأیید برای شما ارسال شده است. سپس می‌توانید وارد شوید و ارزیابی را شروع کنید.
              </p>
              <Button variant="hero" size="lg" className="mt-6 w-full" onClick={() => navigate({ to: "/login" })}>
                ورود به FitLytix
              </Button>
            </div>
          </Panel>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell minimal>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-16">
        <Panel className="animate-rise rounded-3xl p-8">
          <h1 className="text-2xl font-extrabold">ساخت حساب FitLytix</h1>
          <p className="mt-1 text-sm text-muted-foreground">اطلاعات شما در دیتابیس مستقل FitLytix ذخیره می‌شود.</p>
          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <Field id="fn" label="نام" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} placeholder="نام" />
            <Field id="ln" label="نام خانوادگی" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} placeholder="نام خانوادگی" />
            <Field id="mobile" label="شماره موبایل" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="0912 000 0000" ltr className="sm:col-span-2" />
            <Field id="email" label="ایمیل" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="you@example.com" ltr type="email" />
            <Field id="pw" label="رمز عبور" value={form.password} onChange={(v) => setForm({ ...form, password: v })} placeholder="••••••••" ltr type="password" />
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button type="submit" variant="hero" size="lg" className="mt-2 w-full sm:col-span-2" disabled={loading}>
              {loading ? "در حال ساخت حساب..." : "ساخت حساب"} <ShieldCheck />
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            حساب دارید؟ <Link to="/login" className="text-primary hover:underline">ورود</Link>
          </p>
        </Panel>
      </div>
    </MarketingShell>
  );
}

function Field({
  id, label, value, onChange, placeholder, ltr, type = "text", className,
}: {
  id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; ltr?: boolean; type?: string; className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder} dir={ltr ? "ltr" : undefined} className={`h-11 ${ltr ? "font-display" : ""}`} required />
    </div>
  );
}
