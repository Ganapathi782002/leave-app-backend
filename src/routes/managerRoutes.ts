// leave-app-backend-ts/src/routes/managerRoutes.ts
import { Router } from "express";
// Corrected import path for the controller
import { ManagerController } from "../controllers/managerController";

// Corrected import based on your authMiddleware.ts using a default export named 'protect'
import protect from "../middleware/authMiddleware"; // <-- Import 'protect' as the default export

// Corrected import path for the role middleware
import { authorizeRole } from "../middleware/roleMiddleware"; // Assuming authorizeRole is a named export factory


const router = Router();
const managerController = new ManagerController(); // Create an instance of the controller

// --- Middleware for Manager Routes ---
// Apply authentication middleware to all manager routes
// Use the correct middleware name 'protect'
router.use(protect); // This line should now work with the corrected protect signature

router.use(authorizeRole(['Manager','Admin']));
// --- Routes ---

// GET /api/manager/pending-requests
// Fetches all pending leave requests submitted by employees reporting to this manager
router.get("/pending-requests", managerController.getPendingLeaveRequests);

// TODO: Add routes for /approve/:leaveId and /reject/:leaveId later

export { router }; // Export the router instance