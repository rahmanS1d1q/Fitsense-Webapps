import { Request, Response, NextFunction } from "express";
import { JwtPayload } from "./auth.middleware";

type Role = JwtPayload["role"];

/**
 * Role-based access control middleware.
 * Returns HTTP 403 if the user's role is not in the allowed list.
 * Requirements: 2.6
 */
export function rbacMiddleware(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      res
        .status(401)
        .json({
          error: { code: "UNAUTHORIZED", message: "Not authenticated" },
        });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res
        .status(403)
        .json({
          error: { code: "FORBIDDEN", message: "Insufficient permissions" },
        });
      return;
    }

    next();
  };
}
