import { Request, Response, NextFunction } from "express";

export const ROLES = {
  ADMINISTRATOR: "Administrator",
  DATA_ANALYST: "Data Analyst",
  VIEWER: "Viewer",
} as const;

export type RoleType = (typeof ROLES)[keyof typeof ROLES] | string;

/**
 * Middleware factory to enforce Role-Based Access Control.
 * Checks req.user.roleName populated by authMiddleware.
 */
export function requireRole(...allowedRoles: RoleType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Authentication required",
      });
    }

    const userRole = req.user.roleName || ROLES.VIEWER;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of [${allowedRoles.join(", ")}]. Current role: '${userRole}'.`,
      });
    }

    return next();
  };
}

/** Administrator role only */
export const requireAdministrator = requireRole(ROLES.ADMINISTRATOR);

/** Administrator or Data Analyst */
export const requireDataAnalyst = requireRole(
  ROLES.ADMINISTRATOR,
  ROLES.DATA_ANALYST
);

/** Any authenticated role (Administrator, Data Analyst, Viewer) */
export const requireViewer = requireRole(
  ROLES.ADMINISTRATOR,
  ROLES.DATA_ANALYST,
  ROLES.VIEWER
);
