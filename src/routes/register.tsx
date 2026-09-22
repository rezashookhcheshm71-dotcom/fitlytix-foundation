import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { MockBadge, Panel } from "@/components/domain/primitives";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "ثبت‌نام — FitLytix" },
      { name: "description", content: "ساخت هویت مستقل FitLytix با تأیید موبایل." },
      { property: "og:title", content: "ثبت‌نام — FitLytix" },
      { property: "og:description", content: "ساخت هویت مستقل FitLytix با تأیید موبایل." },
    ],
  }),
  component: RegisterPage,
});

type Step = "details" | "otp" | "done";

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("details");
  const [otp, setOtp] = useState("");

  return (
    <MarketingShell minimal>
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-16">
        <Panel className="animate-rise rounded-3xl p-8">
          <div className="mb-6 flex items-center justify-between">
            <MockBadge label="OTP و ذخیره‌سازی شبیه‌سازی شده" />
            <div className="flex gap-1.5">
              {(["details", "otp", "done"] as Step[]).map((s) => (
                <span key={s} className={`h-1.5 w-8 rounded-full ${s === step || (step === "done") || (step === "otp" && s === "details") ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
          </div>

          {step === "details" && (
            <>
              <h1 className="text-2xl font-extrabold">ساخت حساب FitLytix</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                هویت شما در لایه مستقل FitLytix ذخیره می‌شود — نه در یک سیستم مدیریت محتوا.
              </p>
              <form
                className="mt-6 grid gap-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setStep("otp");
                }}
              >
                <Field id="fn" label="نام" placeholder="آرش" />
                <Field id="ln" label="نام خانوادگی" placeholder="کریمی" />
                <Field id="mobile" label="شماره موبایل" placeholder="0912 000 0000" ltr className="sm:col-span-2" />
                <Field id="email" label="ایمیل" placeholder="you@example.com" ltr type="email" />
                <Field id="pw" label="رمز عبور" placeholder="••••••••" ltr type="password" />
                <Button type="submit" variant="hero" size="lg" className="mt-2 w-full sm:col-span-2">
                  ارسال کد تأیید <ShieldCheck />
                </Button>
              </form>
              <p className="mt-4 text-center text-xs text-muted-foreground">
                حساب دارید؟ <Link to="/login" className="text-primary hover:underline">ورود</Link>
              </p>
            </>
          )}

          {step === "otp" && (
            <>
              <h1 className="text-2xl font-extrabold">تأیید شماره موبایل</h1>
              <p className="mt-1 text-sm text-muted-foreground">کد ۶ رقمی ارسال‌شده را وارد کنید. (هر کدی پذیرفته می‌شود — نمایشی)</p>
              <div className="my-8 flex justify-center" dir="ltr">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup className="gap-2">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <InputOTPSlot key={i} index={i} className="size-12 rounded-xl border border-border bg-card font-display text-lg first:rounded-s-xl last:rounded-e-xl" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button variant="hero" size="lg" className="w-full" disabled={otp.length < 6} onClick={() => setStep("done")}>
                تأیید و ادامه
              </Button>
              <button className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => setStep("details")}>
                ویرایش اطلاعات
              </button>
            </>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="size-8" />
              </span>
              <h1 className="text-2xl font-extrabold">هویت شما ساخته شد</h1>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                قدم بعدی: ارزیابی. این داده‌ها Fitness DNA شما را می‌سازند و به موتور مربی‌گری می‌رسند.
              </p>
              <Button variant="hero" size="lg" className="mt-6 w-full" onClick={() => navigate({ to: "/onboarding" })}>
                شروع ارزیابی
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </MarketingShell>
  );
}

function Field({
  id,
  label,
  placeholder,
  ltr,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  placeholder?: string;
  ltr?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} dir={ltr ? "ltr" : undefined} className={`h-11 ${ltr ? "font-display" : ""}`} required />
    </div>
  );
}
