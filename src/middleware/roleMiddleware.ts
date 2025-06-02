import { Request, Response, NextFunction, RequestHandler } from "express"; // <-- Import RequestHandler
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { Role } from "../entity/Role";
import { AuthenticatedRequest } from "./authMiddleware";

/**
 * Middleware to authorize access based on user roles.
 * Requires authentication middleware to run first and attach req.user.
 * @param allowedRoleNames An array of role names (strings) that are allowed to access the route.
 * @returns Express middleware function.
 */
export const authorizeRole = (
  allowedRoleNames: string[],
): RequestHandler<any, any, any, any> => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ message: "Authentication required." });
      return;
    }

    const userRoleId = req.user.role_id;

    try {
      const roleRepository = AppDataSource.getRepository(Role);

      const userRole = await roleRepository.findOne({
        where: { role_id: userRoleId },
        select: ["name"],
      });

      if (!userRole) {
        console.error(
          `Role ID ${userRoleId} not found for user ${req.user.user_id}`,
        );
        res
          .status(500)
          .json({ message: "Internal server error (user role not found)." });
        return;
      }

      const userRoleName = userRole.name;

      if (allowedRoleNames.includes(userRoleName)) {
        next();
      } else {
        res
          .status(403)
          .json({ message: "Forbidden - Insufficient role privileges." });
        return;
      }
    } catch (error) {
      console.error("Error in authorizeRole middleware:", error);
      next(error);
    }
  };
};
