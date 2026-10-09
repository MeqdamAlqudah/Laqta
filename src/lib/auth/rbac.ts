// Role-based access control as a single Policy table (spec section 7 "Roles").
// Keeping every permission in one map makes authorization auditable.
import type { Role } from "./token";

export type Permission =
  | "lead:read"
  | "lead:read_all" // every lead in the org, not just own/unassigned
  | "lead:update"
  | "lead:assign"
  | "lead:create"
  | "lead:anonymize"
  | "lead:export"
  | "lead:read_contact" // phone/email/message (viewer only sees approved fields)
  | "dashboard:read"
  | "settings:manage"
  | "users:manage"
  | "integrations:manage";

const POLICY: Record<Role, Permission[]> = {
  ADMIN: [
    "lead:read", "lead:read_all", "lead:update", "lead:assign", "lead:create", "lead:anonymize",
    "lead:export", "lead:read_contact", "dashboard:read", "settings:manage", "users:manage",
    "integrations:manage",
  ],
  MANAGER: [
    "lead:read", "lead:read_all", "lead:update", "lead:assign", "lead:create", "lead:export",
    "lead:read_contact", "dashboard:read",
  ],
  AGENT: ["lead:read", "lead:update", "lead:create", "lead:read_contact", "dashboard:read"],
  VIEWER: ["lead:read", "lead:read_all", "dashboard:read"],
};

export function can(role: Role, permission: Permission): boolean {
  return POLICY[role]?.includes(permission) ?? false;
}

export const ROLES: Role[] = ["ADMIN", "MANAGER", "AGENT", "VIEWER"];
