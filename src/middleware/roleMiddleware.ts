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
  allowedRoleNames: string[]
): RequestHandler<any, any, any, any> => {
  // <-- Add return type annotation for the factory
  // The returned async function, explicitly typed as RequestHandler returning Promise<void>
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // <-- Add : Promise<void> here
    // 1. Check if user is authenticated (auth middleware should handle this, but double-check)
    if (!req.user) {
      // This should ideally be caught by the preceding protect middleware,
      // but as a safeguard:
      res.status(401).json({ message: "Authentication required." });
      return; // Explicitly return void
    }

    const userRoleId = req.user.role_id;

    try {
      const roleRepository = AppDataSource.getRepository(Role); // 2. Fetch the names of the user's role based on their role_id

      const userRole = await roleRepository.findOne({
        where: { role_id: userRoleId },
        select: ["name"], // Only need the role name
      });

      if (!userRole) {
        // This indicates a data inconsistency (user has a role_id that doesn't exist)
        console.error(
          `Role ID ${userRoleId} not found for user ${req.user.user_id}`
        );
        res
          .status(500)
          .json({ message: "Internal server error (user role not found)." });
        return; // Explicitly return void
      }

      const userRoleName = userRole.name; // 3. Check if the user's role name is in the list of allowed role names

      if (allowedRoleNames.includes(userRoleName)) {
        // User has an allowed role, proceed to the next middleware/route handler
        next();
      } else {
        // User's role is not allowed
        res
          .status(403)
          .json({ message: "Forbidden - Insufficient role privileges." });
        return; // Explicitly return void
      }
    } catch (error) {
      console.error("Error in authorizeRole middleware:", error);
      next(error); // Pass the error to the Express error handling middleware
    }
  };
};
