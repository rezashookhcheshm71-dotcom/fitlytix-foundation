import { computeNudges } from "/home/user/fitlytix-foundation/src/services/athlete/nudges.ts";

const codes = (f: Parameters<typeof computeNudges>[0]) => computeNudges(f).map((n) => n.code).join(",");

const cases: [string, Parameters<typeof computeNudges>[0], string][] = [
  ["no plan", { hasPlan: false, planAgeDays: null, daysSinceSession: null, daysSinceCheckin: null, daysSinceNutrition: null, checkedInToday: false }, "plan_missing"],
  ["fresh plan, nothing logged", { hasPlan: true, planAgeDays: 0, daysSinceSession: null, daysSinceCheckin: null, daysSinceNutrition: null, checkedInToday: false }, "nothing_logged_3d,checkin_missing_today"],
  ["active athlete", { hasPlan: true, planAgeDays: 6, daysSinceSession: 1, daysSinceCheckin: 0, daysSinceNutrition: 1, checkedInToday: true }, "label_window_open"],
  ["stopped logging", { hasPlan: true, planAgeDays: 10, daysSinceSession: 4, daysSinceCheckin: 4, daysSinceNutrition: 4, checkedInToday: false }, "nothing_logged_3d,checkin_missing_today,nutrition_missing_3d,label_window_open"],
];

let failed = 0;
for (const [label, facts, expected] of cases) {
  const actual = codes(facts);
  const ok = actual === expected;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      esperado: ${expected}\n      actual  : ${actual}`);
}
console.log(failed === 0 ? "\nall nudge rules behave as intended" : `\n${failed} case(s) failed`);
process.exit(failed === 0 ? 0 : 1);
