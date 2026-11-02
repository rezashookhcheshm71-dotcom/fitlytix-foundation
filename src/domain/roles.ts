/**
 * Role rules (P39).
 *
 * UserRole declares four roles and ten coach screens exist, but registration
 * hardcoded "athlete" - so four roles were declared and exactly one was
 * reachable. P39 lets a person choose athlete or coach at registration.
 *
 * These rules live in the domain layer rather than the repository so they can be
 * imported and tested without a database. The type-only import of UserRole is
 * erased at compile time, which is what keeps this module loadable from a plain
 * Node test.
 */
import type { UserRole } from "@/lib/auth.server";

/**
 * Roles a public registration endpoint may create.
 *
 * `head_coach` and `admin` are deliberately absent. They are granted by an
 * existing administrator, never self-selected, so a public form must not be able
 * to produce one.
 */
export const REGISTERABLE_ROLES: readonly UserRole[] = ["athlete", "coach"];

/** Every role the type system knows, for asserting the gate stays a subset. */
export const ALL_ROLES: readonly UserRole[] = ["athlete", "coach", "head_coach", "admin"];

/**
 * True when `value` may be created by registration.
 *
 * This is a guard, not a coercion: it returns false for privileged roles rather
 * than mapping them down to "athlete". Silently rewriting a rejected role would
 * hide an escalation attempt, and would also be a small fabrication - recording a
 * choice the person did not make.
 */
export function isRegisterableRole(value: unknown): value is UserRole {
  return typeof value === "string" && (REGISTERABLE_ROLES as readonly string[]).includes(value);
}

/** Roles the gate refuses. Used by tests so the exclusion list cannot silently shrink. */
export const NON_REGISTERABLE_ROLES: readonly UserRole[] = ALL_ROLES.filter(
  (role) => !(REGISTERABLE_ROLES as readonly string[]).includes(role),
);
