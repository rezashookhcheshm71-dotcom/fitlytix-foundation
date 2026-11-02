/**
 * P39 role-gate tests.
 *
 * The gate is security-relevant, not cosmetic: registration is a public endpoint,
 * so the set of roles it may create is the difference between a coach signing up
 * and anyone appointing themselves an administrator. These tests pin both
 * directions - what is allowed, and what must stay refused.
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  ALL_ROLES,
  NON_REGISTERABLE_ROLES,
  REGISTERABLE_ROLES,
  isRegisterableRole,
} from "../src/domain/roles.ts";

test("1. athlete and coach are registerable", () => {
  assert.equal(isRegisterableRole("athlete"), true);
  assert.equal(isRegisterableRole("coach"), true);
});

test("2. head_coach and admin are REFUSED - never self-assignable", () => {
  assert.equal(isRegisterableRole("head_coach"), false, "a public form must not create head_coach");
  assert.equal(isRegisterableRole("admin"), false, "a public form must not create admin");
});

test("3. the registerable set is exactly athlete + coach", () => {
  assert.deepEqual([...REGISTERABLE_ROLES].sort(), ["athlete", "coach"]);
});

test("4. the refusal list cannot silently shrink", () => {
  // If someone adds a privileged role to REGISTERABLE_ROLES, this fails. That is
  // the point: widening who can self-register must be a deliberate, visible act.
  assert.deepEqual([...NON_REGISTERABLE_ROLES].sort(), ["admin", "head_coach"]);
});

test("5. registerable roles are a subset of every known role", () => {
  assert.deepEqual([...ALL_ROLES].sort(), ["admin", "athlete", "coach", "head_coach"]);
  for (const role of REGISTERABLE_ROLES) {
    assert.ok(ALL_ROLES.includes(role), `${role} must be a declared UserRole`);
  }
});

test("6. non-string and unknown values are refused, not coerced", () => {
  for (const value of [
    undefined,
    null,
    "",
    0,
    1,
    true,
    {},
    [],
    ["athlete"],
    "ATHLETE",
    " Athlete",
  ]) {
    assert.equal(isRegisterableRole(value), false, `refuse ${JSON.stringify(value)}`);
  }
});

test("7. the gate does not downgrade: refusing is not the same as returning athlete", () => {
  // A coercing gate would map "admin" to "athlete" and hide the attempt. This one
  // returns a boolean, so the caller must decide - and both the repository and the
  // API choose to reject with a 400 rather than record a role nobody asked for.
  assert.equal(typeof isRegisterableRole("admin"), "boolean");
  assert.equal(isRegisterableRole("admin"), false);
});
