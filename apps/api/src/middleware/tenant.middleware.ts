import { Request, Response, NextFunction } from "express";

/**
 * Validates that the clubId in the URL path matches the club_id in the JWT.
 * super_admin is exempt from this check.
 * Returns HTTP 403 if clubId does not match.
 * Requirements: 15.1, 15.3, 15.5
 */
export function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = req.user;

  if (!user) {
    res
      .status(401)
      .json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  // super_admin can access any club
  if (user.role === "super_admin") {
    next();
    return;
  }

  const clubIdFromUrl = req.params.clubId;

  if (!clubIdFromUrl) {
    next();
    return;
  }

  if (user.clubId !== clubIdFromUrl) {
    res
      .status(403)
      .json({
        error: {
          code: "FORBIDDEN",
          message: "Access to this club is not allowed",
        },
      });
    return;
  }

  next();
}
