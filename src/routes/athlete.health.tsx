import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/layout/AppShell";
import { MockBadge, PageHeader, Panel, SectionHeading } from "@/components/domain/primitives";
import { HealthDataPanel } from "@/components/domain/health-data";
import { HealthTrendsPanel } from "@/components/domain/health-trends";
import { PROVIDER_LABEL } from "@/domain/types";

export const Route = createFileRoute("/athlete/health")({
  head: () => ({
    meta: [
      { title: "دستگاه‌ها و داده سلامت — FitLytix" },
      {
        name: "description",
        content: "وضعیت ساعت و اپ سلامت، و ثبت دستی خواب، HRV و ضربان استراحت.",
      },
      { property: "og:title", content: "دستگاه‌ها و داده سلامت — FitLytix" },
      {
        property: "og:description",
        content: "وضعیت ساعت و اپ سلامت، و ثبت دستی خواب، HRV و ضربان استراحت.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HealthPage,
  validateSearch: z.object({
    // Dev-only design preview for the trends panel, which otherwise renders nothing
    // at all without a session - and a session needs the host database.
    // The token is a word, not "1": TanStack Router pre-parses search params as
    // JSON, so ?demo=1 arrives as the NUMBER 1 and could never match a z.enum of
    // strings. Same reason ?body=empty and ?slides=demo use words.
    demo: z.enum(["on"]).optional().catch(undefined),
  }),
});

type SessionUser = { id: string; firstName: string; lastName: string };
type RecentRow = {
  metricType: string;
  label: string;
  unit: string;
  value: number | null;
  at: string;
  source: string | null;
  excluded: boolean;
};
type RecentState = "loading" | "ready" | "unauthenticated" | "error";

const nf = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 });

/**
 * Source label. An unknown source is shown as-is rather than mapped onto a
 * provider name it does not have.
 */
function sourceLabel(source: string | null): string {
  if (source === null) return "نامشخص";
  const known = PROVIDER_LABEL[source as keyof typeof PROVIDER_LABEL];
  return typeof known === "string" ? known : source === "manual" ? "ثبتِ دستی" : source;
}

/** ISO timestamp shown as "YYYY-MM-DD HH:MM" without inventing a timezone shift. */
function formatAt(iso: string): string {
  return iso.length >= 16 ? iso.slice(0, 16).replace("T", " ") : iso || "—";
}

function HealthPage() {
  const { demo } = Route.useSearch();
  const demoDesign = demo === "on" && import.meta.env.DEV;
  // P35: identity comes from the session, not from demoAthlete. The page used to
  // read the mock service keyed to "ath_001" and show his rows to whoever opened
  // it; now it asks the server, which resolves the user from the cookie.
  const [me, setMe] = useState<SessionUser | null>(null);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [recentState, setRecentState] = useState<RecentState>("loading");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          user?: SessionUser;
        } | null;
        if (alive && res.ok && json?.ok && json.user) setMe(json.user);
      } catch {
        // Not signed in, or the server is unreachable. Either way there is no
        // identity to claim, and none is invented.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      setRecentState("loading");
      try {
        const res = await fetch("/api/athlete/health", { credentials: "include" });
        if (!alive) return;
        if (res.status === 401) {
          setRecentState("unauthenticated");
          return;
        }
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          recent?: RecentRow[];
        } | null;
        if (!res.ok || !json?.ok || !Array.isArray(json.recent)) {
          setRecentState("error");
          return;
        }
        setRecent(json.recent);
        setRecentState("ready");
      } catch {
        if (alive) setRecentState("error");
      }
    })();
    return () => {
      alive = false;
    };
  }, [version]);
  return (
    <AppShell
      mode="athlete"
      userName={me ? `${me.firstName} ${me.lastName}`.trim() || "کاربر" : "وارد نشده"}
      userRole="داده سلامت"
      userId={me?.id ?? null}
    >
      <PageHeader
        eyebrow="سلامت"
        title="ساعت و داده‌های سلامت"
        description="با اتصال داده‌های سلامت و تمرین، FitLytix می‌تواند شناخت دقیق‌تری از تمرین، خواب، ریکاوری و عملکردت داشته باشد. اتصال مستقیم در مرحله بعدی فعال می‌شود."
        actions={<MockBadge label="اتصالِ ساعت هنوز واقعی نیست؛ ثبتِ دستی واقعی است" />}
      />
      {/* P35: real trends from health_metrics, with an honest state per metric. */}
      <HealthTrendsPanel version={version} demo={demoDesign} className="mb-4" />
      {/* Provider connections are still in-memory and no OAuth exists, so this
          panel is keyed to the real user id and starts empty rather than showing
          the demo athlete's devices. */}
      <HealthDataPanel
        athleteId={me?.id ?? ""}
        empty={!me}
        version={version}
        onChanged={() => setVersion((x) => x + 1)}
      />
      <Panel>
        <SectionHeading
          title="آخرین ثبت‌ها"
          subtitle="هر ثبت یک رکوردِ جدا در پایگاهِ داده، با منبع و زمانِ خودش"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-muted-foreground">
                <th className="py-2 text-start">داده</th>
                <th className="text-start">مقدار</th>
                <th className="text-start">منبع</th>
                <th className="text-start">زمان</th>
              </tr>
            </thead>
            <tbody>
              {recentState === "loading" && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    در حالِ خواندنِ ثبت‌ها…
                  </td>
                </tr>
              )}
              {recentState === "unauthenticated" && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    برایِ دیدنِ ثبت‌هایت وارد شو. تا وارد نشوی چیزی نشان نمی‌دهیم - نه داده‌یِ خودت،
                    نه داده‌یِ دیگری.
                  </td>
                </tr>
              )}
              {recentState === "error" && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-destructive">
                    خواندنِ ثبت‌ها ممکن نشد. این خطایِ اتصال است، نه «ثبتی نداری».
                  </td>
                </tr>
              )}
              {recentState === "ready" && recent.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-muted-foreground">
                    هنوز هیچ ثبتی نداری. اولین اندازه‌گیری را از «ثبتِ دستی» وارد کن تا از همان لحظه
                    داده‌یِ واقعی داشته باشی.
                  </td>
                </tr>
              )}
              {recentState === "ready" &&
                recent.map((m, index) => (
                  <tr
                    key={`${m.metricType}-${m.at}-${index}`}
                    className="border-t border-border/60"
                  >
                    <td className="py-2">{m.label}</td>
                    <td className="num">
                      {m.value === null ? "—" : `${nf.format(m.value)} ${m.unit}`}
                      {/* P40: an excluded value stays visible and named. Hiding it
                          would destroy the evidence needed to work out why it was
                          recorded; showing it unlabelled would let it be read as
                          trustworthy. */}
                      {m.excluded && (
                        <span className="ms-2 text-[10px] text-warning" data-excluded="true">
                          غیرِمعقول - در محاسبه نیست
                        </span>
                      )}
                    </td>
                    <td className="text-xs text-muted-foreground">{sourceLabel(m.source)}</td>
                    <td className="num text-xs text-muted-foreground">{formatAt(m.at)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
