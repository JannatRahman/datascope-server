export const ROLES = {
  ADMINISTRATOR: "Administrator",
  DATA_ANALYST: "Data Analyst",
  VIEWER: "Viewer",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES] | string;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null | undefined;
  roleId?: string | null | undefined;
  roleName: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthenticatedSession {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
  userId: string;
}

export interface CachedSessionPayload {
  user: AuthenticatedUser;
  session: AuthenticatedSession;
}
