"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Ensure AuthenticatedRequest is defined and accessible (e.g., imported or in a global .d.ts)
// If you exported it from managerController, import it here:
// If you defined it here and added 'export', then no extra import needed here
// Assuming it's defined and exported below:
const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key"; // TODO: Use a strong secret in production
// --- End AuthenticatedRequest definition ---
// Middleware function to protect routes
// Use the standard Express middleware signature and explicitly declare void return
const protect = (req, // Use standard Request type
res, next) => {
    // <-- Explicitly declare return type as void
    let token; // Check for token in Authorization header (Bearer token)
    if (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")) {
        try {
            // Get token from header (remove "Bearer ")
            token = req.headers.authorization.split(" ")[1]; // Verify token using callback
            jsonwebtoken_1.default.verify(token, jwtSecret, (err, decoded) => {
                if (err) {
                    console.error("Token verification failed:", err);
                    // Use return here to stop execution in this callback path
                    return res
                        .status(401)
                        .json({ message: "Not authorized, token failed" });
                }
                // Cast decoded payload and attach to the request object
                // Use the AuthenticatedRequest type via casting
                req.user =
                    decoded; // Safer casting
                // Call next middleware/route handler
                next();
            });
        }
        catch (error) {
            console.error("Error processing token:", error); // Catch errors *before* jwt.verify callback
            res
                .status(500)
                .json({ message: "Internal server error during token processing" });
        }
    }
    else {
        // If no token is found in the header
        res.status(401).json({ message: "Not authorized, no token" });
    }
};
// Export the middleware function as default
exports.default = protect;
