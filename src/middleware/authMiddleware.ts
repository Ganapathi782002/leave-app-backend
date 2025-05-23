import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key"; // TODO: Use a strong secret in production

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role_id: number;
    [key: string]: any; // Allow for other properties
  };
}

// Middleware function to protect routes
// Use the standard Express middleware signature and explicitly declare void return
const protect = (
  req: Request, // Use standard Request type
  res: Response,
  next: NextFunction
): void => {

  let token; // Check for token in Authorization header (Bearer token)

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header (remove "Bearer ")
      token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
          console.error("Token verification failed:", err);
          // Use return here to stop execution in this callback path
          return res
            .status(401)
            .json({ message: "Not authorized, token failed" });
        }

        // Cast decoded payload and attach to the request object
        // Use the AuthenticatedRequest type via casting
        (req as AuthenticatedRequest).user =
          decoded as AuthenticatedRequest["user"]; // Safer casting

        // Call next middleware/route handler
        next();
      });
    } catch (error) {
      console.error("Error processing token:", error); // Catch errors *before* jwt.verify callback
      res
        .status(500)
        .json({ message: "Internal server error during token processing" });
    }
  } else {
    // If no token is found in the header
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

// Export the middleware function as default
export default protect;
