import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { MarketingShell } from "@/components/layout/MarketingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MockBadge, Panel } from "@/components/domain/primitives";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "ورود — FitLytix" },
      { name: "description", content: "ورود به حساب ورزشکار یا مربی FitLytix." },
      { property: "og:title", content: "ورود — FitLytix" },
      { property: "og:description", content: "ورود به حساب ورزشکار یا مربی FitLytix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  return (
    <MarketingShell minimal>
      <div className="mx-auto flex w-full max-w-md flex-col px-4 py-16">
        <Panel className="animate-rise rounded-3xl p-8">
          <MockBadge label="احراز هویت هنوز متصل نیست" className="mb-4" />
          <h1 className="text-2xl font-extrabold">ورود به FitLytix</h1>
          <p className="mt-1 text-sm text-muted-foreground">با موبایل یا ایمیل وارد شوید.</p>
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              // TODO(backend): replace with real identity-layer sign-in
              navigate({ to: "/athlete/dashboard" });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="id">موبایل یا ایمیل</Label>
              <Input id="id" placeholder="0912 000 0000" dir="ltr" className="h-11 font-display" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw">رمز عبور</Label>
              <Input id="pw" type="password" placeholder="••••••••" dir="ltr" className="h-11" />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full">ورود</Button>
          </form>
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <Link to="/register" className="text-primary hover:underline">حساب ندارید؟ ثبت‌نام</Link>
            <Link to="/coach" className="hover:text-foreground">ورود مربی (نمایشی)</Link>
          </div>
        </Panel>
      </div>
    </MarketingShell>
  );
}
