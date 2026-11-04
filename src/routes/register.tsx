import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SPORTS } from "@/domain/sports";
import { Panel } from "@/components/domain/primitives";
import { signUpWithEmail } from "@/lib/auth";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

const ROLE_OPTIONS = [
  { value: "athlete" as const, label: "ورزشکار" },
  { value: "coach" as const, label: "مربی" },
];

const ROLE_HINT: Record<"athlete" | "coach", string> = {
  athlete: "برنامه، سنجش و داشبوردِ شخصیِ خودتان را می‌گیرید.",
  coach: "به ابزارِ مربی‌گری دسترسی پیدا می‌کنید. نقش‌هایِ مدیریتی تنها توسطِ مدیر اعطا می‌شوند.",
};

// Built from the sports registry, so a sport added there becomes selectable here
// with no further change and no duplicated list to drift.
const SPORT_OPTIONS = Object.values(SPORTS).map((sport) => ({ id: sport.id, name: sport.name }));

export const Route = createFileRoute("/register")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "ثبت‌نام — FitLytix" },
      { name: "description", content: "ساخت حساب مستقل FitLytix." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  // P39: the role is chosen, never assumed. The API previously hardcoded
  // "athlete", which is why four roles were declared and only one was reachable.
  const [role, setRole] = useState<"athlete" | "coach">("athlete");
  // P39/F2: null means "not chosen". Nothing is preselected here, because a
  // default is exactly the fabrication migration 003 removed from the schema.
  const [primarySport, setPrimarySport] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    password: "",
  });
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error: authError } = await signUpWithEmail({ ...form, role, primarySport });
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

    setLoading(false);

    if (redirect && redirect.startsWith("/")) {
      window.location.href = redirect;
      return;
    }

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
                نشست کاربری شما فعال شد. اکنون می‌توانید ارزیابی عمومی را تکمیل کنید یا وارد داشبورد
                شوید.
              </p>
              <Button
                variant="hero"
                size="lg"
                className="mt-6 w-full"
                onClick={() => navigate({ to: role === "coach" ? "/coach" : "/assessment/common" })}
              >
                {role === "coach" ? "رفتن به ابزارِ مربی" : "شروع ارزیابی عمومی"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="mt-3 w-full"
                onClick={() => navigate({ to: "/athlete/dashboard", search: {} })}
              >
                ورود به داشبورد ورزشکار
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
          <p className="mt-1 text-sm text-muted-foreground">
            اطلاعات شما در دیتابیس مستقل FitLytix ذخیره می‌شود.
          </p>
          <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
            <div className="sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-white">نقشِ شما</span>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setRole(opt.value)}
                    aria-pressed={role === opt.value}
                    // Uses the semantic tokens the rest of the product uses for a
                    // selected control (border-primary + bg-primary-soft). An
                    // earlier revision here said "border-ember bg-ember/15", and
                    // there is no ember colour token - only bg-gradient-ember and
                    // text-gradient-ember utilities - so both classes generated no
                    // CSS at all and the selected button differed from the
                    // unselected one by text opacity alone.
                    className={`rounded-xl border px-4 py-2.5 text-start text-sm transition ${
                      role === opt.value
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-white/50">{ROLE_HINT[role]}</p>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="sport">
                {role === "coach" ? "رشته‌یِ تخصصی" : "رشته‌یِ ورزشی"}{" "}
                <span className="text-white/40">(اختیاری)</span>
              </Label>
              <select
                id="sport"
                value={primarySport ?? ""}
                onChange={(e) => setPrimarySport(e.target.value === "" ? null : e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white"
              >
                {/* An explicit "not chosen" entry keeps absence visible rather than
                    letting a preselected sport look like a decision the user made. */}
                <option value="">فعلاً انتخاب نمی‌کنم</option>
                {SPORT_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.name}
                  </option>
                ))}
              </select>
            </div>
            <Field
              id="fn"
              label="نام"
              value={form.firstName}
              onChange={(v) => setForm({ ...form, firstName: v })}
              placeholder="نام"
            />
            <Field
              id="ln"
              label="نام خانوادگی"
              value={form.lastName}
              onChange={(v) => setForm({ ...form, lastName: v })}
              placeholder="نام خانوادگی"
            />
            <Field
              id="mobile"
              label="شماره موبایل"
              value={form.phone}
              onChange={(v) => setForm({ ...form, phone: v })}
              placeholder="0912 000 0000"
              ltr
              className="sm:col-span-2"
            />
            <Field
              id="email"
              label="ایمیل"
              value={form.email}
              onChange={(v) => setForm({ ...form, email: v })}
              placeholder="you@example.com"
              ltr
              type="email"
            />
            <Field
              id="pw"
              label="رمز عبور"
              value={form.password}
              onChange={(v) => setForm({ ...form, password: v })}
              placeholder="••••••••"
              ltr
              type="password"
            />
            {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="mt-2 w-full sm:col-span-2"
              disabled={loading}
            >
              {loading ? "در حال ساخت حساب..." : "ساخت حساب"} <ShieldCheck />
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            حساب دارید؟{" "}
            <Link
              to="/login"
              search={redirect ? { redirect } : {}}
              className="text-primary hover:underline"
            >
              ورود
            </Link>
          </p>
        </Panel>
      </div>
    </MarketingShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  ltr,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ltr?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        dir={ltr ? "ltr" : undefined}
        className={`h-11 ${ltr ? "font-display" : ""}`}
        required
      />
    </div>
  );
}
