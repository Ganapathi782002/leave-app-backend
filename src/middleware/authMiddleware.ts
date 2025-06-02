import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key";

export interface AuthenticatedRequest extends Request {
  user?: {
    user_id: number;
    role_id: number;
    [key: string]: any;
  };
}

const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
          console.error("Token verification failed:", err);
          // Use return here to stop execution in this callback path
          return res
            .status(401)
            .json({ message: "Not authorized, token failed" });
        }

        (req as AuthenticatedRequest).user =
          decoded as AuthenticatedRequest["user"];

        // Call next middleware/route handler
        next();
      });
    } catch (error) {
      console.error("Error processing token:", error);
      res
        .status(500)
        .json({ message: "Internal server error during token processing" });
    }
  } else {
    res.status(401).json({ message: "Not authorized, no token" });
  }
};

export default protect;
