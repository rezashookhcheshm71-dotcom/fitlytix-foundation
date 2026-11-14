#!/usr/bin/env node
/**
 * End-to-end check of the recommendation pipeline against a RUNNING FitLytix server
 * and its real MySQL database.
 *
 *   E2E_EMAIL=... E2E_PASSWORD=... E2E_BASE_URL=https://app.fitlytix.ir npm run e2e:plan
 *
 * What it proves (the parts that cannot be tested statically):
 *   1. login/registration + session cookie work,
 *   2. POST /api/assessment stores the answers the model actually reads,
 *   3. a plan is generated automatically right after the assessment,
 *   4. GET /api/plan returns that plan and (with migration 004) it is persisted,
 *   5. POST /api/plan honours an explicit cycle-length override,
 *   6. /api/plan-diagnose reports which migrations/signals are in place.
 *
 * Environment:
 *   E2E_BASE_URL   default http://127.0.0.1:3000
 *   E2E_EMAIL      required (an existing account, or one to create)
 *   E2E_PASSWORD   required
 *   E2E_REGISTER   "1" to register the account when login fails
 *   E2E_SPORT      crossfit | hyrox | functional | bodybuilding | running (default crossfit)
 *
 * Exit codes: 0 all good, 1 assertions failed, 2 configuration problem.
 */

const BASE = (process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL?.trim() ?? "";
const PASSWORD = process.env.E2E_PASSWORD ?? "";
const REGISTER = process.env.E2E_REGISTER === "1";
const SPORT = process.env.E2E_SPORT ?? "crossfit";

if (!EMAIL || !PASSWORD) {
  console.error("E2E_EMAIL و E2E_PASSWORD را تنظیم کنید.");
  console.error("مثال: E2E_EMAIL=test@fitlytix.ir E2E_PASSWORD=… npm run e2e:plan");
  process.exit(2);
}

const SPORT_TEMPLATES = {
  crossfit: "crossfit-foundation",
  hyrox: "hyrox-foundation",
  functional: "functional-foundation",
  bodybuilding: "bodybuilding-foundation",
  running: "running-foundation",
};

const COMMON_ANSWERS = {
  "common.profile.age": 31,
  "common.profile.height_cm": 180,
  "common.profile.weight_kg": 82,
  "common.profile.training_history": "option_3",
  "common.goals.primary": "option_1",
  "common.schedule.sessions_per_week": "option_3",
  "common.schedule.minutes_per_session": "option_3",
  "common.recovery.sleep_hours": 7.5,
  "common.recovery.stress": 2,
  "common.safety.pain": "option_1",
  "common.body.condition": "option_3",
  "common.access.environment": "option_2",
};

const SPORT_ANSWERS = {
  crossfit: {
    "crossfit.history.duration": "option_3",
    "crossfit.schedule.sessions": 4,
    "crossfit.level.skill": "option_3",
    "crossfit.level.goal": "option_2",
    "crossfit.strength.back_squat_1rm": 140,
    "crossfit.strength.deadlift_1rm": 170,
    "crossfit.skill.gymnastics": ["option_2", "option_3"],
    "crossfit.engine.row_2k": "7:20",
  },
  hyrox: {
    "hyrox.race.experience": "option_2",
    "hyrox.running.5k_time": "24:30",
    "hyrox.running.10k_time": "51:00",
    "hyrox.stations.ski_1k": "4:10",
    "hyrox.stations.row_1k": "3:55",
    "hyrox.stations.wall_balls": 60,
  },
  functional: {
    "functional.environment.access": ["option_1", "option_2"],
    "functional.conditioning.preference": "option_3",
    "functional.movement.overhead": "option_3",
    "functional.strength.core": "option_3",
  },
  bodybuilding: {
    "bodybuilding.lifts.bench_press": 90,
    "bodybuilding.lifts.squat": 120,
    "bodybuilding.lifts.rdl": 130,
    "bodybuilding.cardio.frequency": "option_2",
    "bodybuilding.equipment.access": ["option_1", "option_2"],
  },
  running: {
    "running.records.5k": "24:30",
    "running.records.10k": "51:00",
    "running.records.half": "1:56:00",
    "running.training.zones": "option_3",
    "running.pace.easy": "5:45",
  },
};

let cookie = "";
const results = [];

function record(ok, label, detail = "") {
  results.push({ ok, label, detail });
  if (!ok) process.exitCode = 1;
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function call(path, init = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      accept: "application/json",
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...init.headers,
    },
    redirect: "follow",
  });

  const setCookie =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  if (setCookie.length > 0) {
    const pairs = setCookie.map((entry) => String(entry).split(";")[0]).filter(Boolean);
    if (pairs.length > 0) cookie = pairs.join("; ");
  }

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

async function main() {
  console.log(`FitLytix recommendation e2e → ${BASE} (sport: ${SPORT})\n`);

  const health = await call("/api/health");
  record(health.status === 200, "GET /api/health", `HTTP ${health.status}`);
  if (health.status !== 200) return;

  const login = await call("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (login.status !== 200 && REGISTER) {
    const register = await call("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        firstName: "E2E",
        lastName: "Runner",
        phone: "09120000000",
        email: EMAIL,
        password: PASSWORD,
      }),
    });
    record(
      register.status === 200 || register.status === 201,
      "POST /api/auth/register",
      `HTTP ${register.status}`,
    );
    if (register.status !== 200 && register.status !== 201) {
      record(false, "ورود/ثبت‌نام", JSON.stringify(register.body).slice(0, 200));
      return;
    }
    const retry = await call("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
    record(retry.status === 200, "POST /api/auth/login (پس از ثبت‌نام)", `HTTP ${retry.status}`);
    if (retry.status !== 200) return;
  } else {
    record(login.status === 200, "POST /api/auth/login", `HTTP ${login.status}`);
    if (login.status !== 200) {
      if (login.status >= 500) {
        console.log(
          "   ⚠ سرور خطای ۵۰۰ داد: احتمالاً DB_* در محیط ست نشده یا MySQL در دسترس نیست. " +
            "ابتدا GET /api/db-test را چک کنید و لاگ سرور را ببینید.",
        );
      }
      record(false, "راهنما", "اگر حساب ندارید E2E_REGISTER=1 را اضافه کنید.");
      return;
    }
  }

  const common = await call("/api/assessment", {
    method: "POST",
    body: JSON.stringify({
      templateId: "common-foundation",
      answers: COMMON_ANSWERS,
      // measuredAt + source are required by bodyAnalysisInputSchema; omitting them made this
      // call fail with HTTP 400 before the body row was ever written.
      bodyAnalysis: {
        measuredAt: new Date().toISOString().slice(0, 10),
        source: "inbody",
        weightKg: 82,
        heightCm: 180,
        bodyFatPct: 18,
      },
      wearable: { intent: "no", providers: [] },
    }),
  });
  record(
    common.status === 200 && common.body?.ok === true,
    "POST /api/assessment (عمومی)",
    `HTTP ${common.status}`,
  );

  const sport = await call("/api/assessment", {
    method: "POST",
    body: JSON.stringify({
      templateId: SPORT_TEMPLATES[SPORT] ?? SPORT_TEMPLATES.crossfit,
      sport: SPORT,
      experienceLevel: "intermediate",
      answers: SPORT_ANSWERS[SPORT] ?? SPORT_ANSWERS.crossfit,
    }),
  });
  const sportOk = sport.status === 200 && sport.body?.ok === true;
  record(sportOk, `POST /api/assessment (${SPORT})`, `HTTP ${sport.status}`);
  if (sport.body?.plan) {
    record(true, "برنامه پس از ارزیابی خودکار ساخته شد", JSON.stringify(sport.body.plan));
  } else {
    record(
      false,
      "برنامه پس از ارزیابی ساخته نشد",
      "پاسخ assessment فیلد plan نداشت — لاگ سرور را ببینید.",
    );
  }

  const plan = await call("/api/plan");
  const planBody = plan.body ?? {};
  const okPlan = plan.status === 200 && planBody.ok === true && planBody.plan;
  record(
    okPlan,
    "GET /api/plan",
    okPlan
      ? `HTTP ${plan.status}`
      : `HTTP ${plan.status} ${JSON.stringify(planBody).slice(0, 160)}`,
  );

  if (okPlan) {
    const summary = planBody.plan;
    console.log(
      `   → ${summary.archetypeId} · ${summary.sessionsPerWeek}×${summary.sessionMinutes} دقیقه · ` +
        `${summary.durationMonths} ماه · ${summary.nutritionStrategyId} · ${summary.coachingMode} · ایمنی ${summary.safetyLevel}`,
    );
    record(
      [1, 3, 6, 12].includes(summary.durationMonths),
      "طول دوره معتبر است",
      String(summary.durationMonths),
    );
    record(
      planBody.meta?.persisted === true,
      "برنامه در دیتابیس ذخیره شد (migration 004)",
      planBody.meta?.persisted ? `snapshot=${planBody.meta.snapshotId}` : "meta.persisted=false",
    );
    record(
      Array.isArray(planBody.meta?.sourcesFa) && planBody.meta.sourcesFa.length > 0,
      "ورودی‌های واقعی خوانده شدند",
      (planBody.meta?.sourcesFa ?? []).join("، "),
    );
    record(
      Array.isArray(summary.explanations) && summary.explanations.length > 0,
      "توضیح‌پذیری فعال است",
      `${summary.explanations?.length ?? 0} توضیح`,
    );
  }

  const override = await call("/api/plan", {
    method: "POST",
    body: JSON.stringify({ regenerate: true, constraints: { durationMonths: 3 } }),
  });
  const overrideOk = override.status === 200 && override.body?.plan?.durationMonths === 3;
  record(
    overrideOk,
    "POST /api/plan با override سه‌ماهه",
    `durationMonths=${override.body?.plan?.durationMonths}`,
  );

  const diagnose = await call("/api/plan-diagnose");
  if (diagnose.status === 200 && diagnose.body?.ok) {
    const db = diagnose.body.database ?? {};
    console.log("\nوضعیت دیتابیس:");
    for (const [name, applied] of Object.entries(db.migrations ?? {})) {
      console.log(`   ${applied ? "✓" : "✗"} ${name}`);
    }
    const missingTables = Object.entries(db.tables ?? {})
      .filter(([, exists]) => !exists)
      .map(([name]) => name);
    if (missingTables.length > 0) console.log(`   جداول غایب: ${missingTables.join(", ")}`);
    const athlete = diagnose.body.athlete ?? {};
    console.log(
      `\nورودی‌های خوانده‌شده: ${(athlete.sourcesFa ?? []).join("، ") || "—"}\n` +
        `ورودی‌های غایب: ${(athlete.missingFa ?? []).join("، ") || "—"}\n` +
        `پاسخ‌های قابل‌استفاده: ${athlete.answersCount} · جلسات ۲۸ روز: ${athlete.sessions28d ?? "-"} · روزهای تغذیه: ${athlete.nutritionDays28d ?? "-"}`,
    );
    for (const hint of diagnose.body.hints ?? []) console.log(`   ⚠ ${hint}`);
    record(missingTables.length === 0, "همهٔ جداول لازم موجودند", missingTables.join(", ") || "ok");
    record(
      (athlete.answersCount ?? 0) > 0,
      "پاسخ‌های ارزیابی به ویژگی‌های مدل نگاشت شدند",
      `${athlete.answersCount} کلید`,
    );
  } else {
    record(false, "GET /api/plan-diagnose", `HTTP ${diagnose.status}`);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} بررسی موفق`);
  if (failed.length > 0) {
    console.log("بررسی‌های ناموفق:");
    for (const item of failed)
      console.log(`  - ${item.label}${item.detail ? ` (${item.detail})` : ""}`);
    process.exitCode = 1;
  } else {
    console.log("همهٔ بررسی‌ها موفق — مسیر ارزیابی → برنامه → ذخیره‌سازی سالم است.");
  }
}

main().catch((error) => {
  console.error("e2e failed unexpectedly:", error);
  process.exitCode = 1;
});
