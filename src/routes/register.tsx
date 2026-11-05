import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Contact,
  Dumbbell,
  KeyRound,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  UserRound,
  Users,
} from "lucide-react";
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
  { value: "athlete" as const, label: "ورزشکار", icon: Dumbbell },
  { value: "coach" as const, label: "مربی", icon: Users },
];

const ROLE_HINT: Record<"athlete" | "coach", string> = {
  athlete: "برنامه، سنجش و داشبوردِ شخصیِ خودتان را می‌گیرید.",
  coach: "به ابزارِ مربی‌گری دسترسی پیدا می‌کنید. نقش‌هایِ مدیریتی تنها توسطِ مدیر اعطا می‌شوند.",
};

// Built from the sports registry, so a sport added there becomes selectable here
// with no further change and no duplicated list to drift.
const SPORT_OPTIONS = Object.values(SPORTS).map((sport) => ({ id: sport.id, name: sport.name }));

// Three steps, each answering one question, instead of one long flat form. The
// submission semantics are unchanged: every field still lands in the same state
// object and signUpWithEmail is called exactly once, at the last step.
const STEPS = [
  { id: "role", title: "نقشِ شما", subtitle: "ورزشکار هستی یا مربی؟", icon: UserRound },
  { id: "identity", title: "هویتِ شما", subtitle: "نام و راهِ تماس.", icon: Contact },
  { id: "access", title: "دسترسیِ شما", subtitle: "ایمیل و رمز عبور.", icon: KeyRound },
] as const;

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
  const [step, setStep] = useState(0);

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

  // Per-step gating. Step 0 is always valid because the role has a value by
  // construction; the other two require their fields to be filled. This replaces
  // relying on the browser's `required`, which cannot see inputs that a wizard
  // has unmounted on an earlier step.
  const stepValid = [
    true,
    form.firstName.trim() !== "" && form.lastName.trim() !== "" && form.phone.trim() !== "",
    form.email.trim() !== "" && form.password.trim() !== "",
  ];

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    // Safety net: if someone reaches submit with an incomplete earlier step,
    // send them back to it rather than posting a half-filled payload.
    const firstInvalid = stepValid.findIndex((v) => !v);
    if (firstInvalid !== -1) {
      setStep(firstInvalid);
      setError("لطفاً گام‌های پیشین را کامل کنید.");
      return;
    }
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
          <Panel variant="raised" className="animate-rise rounded-3xl p-8">
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

  const last = step === STEPS.length - 1;
  // `step` is bounded to 0..STEPS.length-1 by construction (it only moves via the
  // two buttons below), but indexing a tuple with a plain number is possibly
  // undefined under noUncheckedIndexedAccess, so fall back to the first station.
  const current = STEPS[step] ?? STEPS[0];

  return (
    <MarketingShell minimal>
      <div className="mx-auto flex w-full max-w-xl flex-col px-4 py-14">
        <Panel variant="raised" className="animate-rise overflow-hidden rounded-3xl">
          {/* Step indicator: three numbered, iconed stations on a hairline. Done
              steps collapse to a check so progress reads at a glance. */}
          <ol className="flex items-center gap-2 border-b border-border/60 bg-card/40 px-6 py-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const state = i < step ? "done" : i === step ? "active" : "todo";
              return (
                <li key={s.id} className="flex flex-1 items-center gap-2">
                  <span
                    className={`inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition ${
                      state === "active"
                        ? "border-primary bg-primary text-primary-foreground"
                        : state === "done"
                          ? "border-success/50 bg-success/15 text-success"
                          : "border-border bg-card text-muted-foreground"
                    }`}
                  >
                    {state === "done" ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  <span
                    className={`hidden text-xs font-semibold sm:block ${
                      state === "active" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.title}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="mx-1 h-px flex-1 bg-border/60" aria-hidden />
                  )}
                </li>
              );
            })}
          </ol>

          <div className="p-6 sm:p-8">
            <p className="num text-[10px] font-bold text-primary">
              گام {step + 1} از {STEPS.length}
            </p>
            <h1 className="mt-1 text-xl font-extrabold">{current.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{current.subtitle}</p>

            <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
              {step === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLE_OPTIONS.map((opt) => {
                      const Icon = opt.icon;
                      return (
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
                          className={`flex flex-col items-start gap-2 rounded-xl border px-4 py-3 text-start transition ${
                            role === opt.value
                              ? "border-primary bg-primary-soft text-primary"
                              : "border-border bg-card text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          <Icon className="size-5" />
                          <span className="text-sm font-semibold">{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-white/50">{ROLE_HINT[role]}</p>

                  <div>
                    <Label htmlFor="sport">
                      {role === "coach" ? "رشته‌یِ تخصصی" : "رشته‌یِ ورزشی"}{" "}
                      <span className="text-white/40">(اختیاری)</span>
                    </Label>
                    <select
                      id="sport"
                      value={primarySport ?? ""}
                      onChange={(e) =>
                        setPrimarySport(e.target.value === "" ? null : e.target.value)
                      }
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
                </>
              )}

              {step === 1 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="fn"
                    label="نام"
                    value={form.firstName}
                    onChange={(v) => setForm({ ...form, firstName: v })}
                    placeholder="نام"
                    icon={<User className="size-4" />}
                  />
                  <Field
                    id="ln"
                    label="نام خانوادگی"
                    value={form.lastName}
                    onChange={(v) => setForm({ ...form, lastName: v })}
                    placeholder="نام خانوادگی"
                    icon={<User className="size-4" />}
                  />
                  <Field
                    id="mobile"
                    label="شماره موبایل"
                    value={form.phone}
                    onChange={(v) => setForm({ ...form, phone: v })}
                    placeholder="0912 000 0000"
                    ltr
                    icon={<Phone className="size-4" />}
                    className="sm:col-span-2"
                  />
                </div>
              )}

              {step === 2 && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="email"
                    label="ایمیل"
                    value={form.email}
                    onChange={(v) => setForm({ ...form, email: v })}
                    placeholder="you@example.com"
                    ltr
                    type="email"
                    icon={<Mail className="size-4" />}
                    className="sm:col-span-2"
                  />
                  <Field
                    id="pw"
                    label="رمز عبور"
                    value={form.password}
                    onChange={(v) => setForm({ ...form, password: v })}
                    placeholder="••••••••"
                    ltr
                    type="password"
                    icon={<Lock className="size-4" />}
                    className="sm:col-span-2"
                  />
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="mt-2 flex items-center gap-2">
                {step > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={() => setStep(step - 1)}
                    disabled={loading}
                  >
                    <ArrowRight className="size-4" /> بازگشت
                  </Button>
                )}
                {!last ? (
                  <Button
                    type="button"
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    disabled={!stepValid[step]}
                    onClick={() => setStep(step + 1)}
                  >
                    ادامه <ArrowLeft className="size-4" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? "در حال ساخت حساب..." : "ساخت حساب"}{" "}
                    <ShieldCheck className="size-4" />
                  </Button>
                )}
              </div>
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
          </div>
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
  icon,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ltr?: boolean;
  type?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {/* The wrapper takes the input's direction so the logical inset/padding
          below resolve against the same edge the text starts from: `start` is
          left inside an ltr field and right inside an rtl one. Positioning the
          icon by `start` alone would put it on the wrong side of an ltr field. */}
      <div className="relative" dir={ltr ? "ltr" : undefined}>
        {icon && (
          <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-muted-foreground">
            {icon}
          </span>
        )}
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type={type}
          placeholder={placeholder}
          dir={ltr ? "ltr" : undefined}
          className={`h-11 ${icon ? "ps-10" : ""} ${ltr ? "font-display" : ""}`}
        />
      </div>
    </div>
  );
}
