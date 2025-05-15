"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// leave-app-backend-ts/src/routes/managerRoutes.ts
const express_1 = require("express");
// Corrected import path for the controller
const managerController_1 = require("../controllers/managerController");
// Corrected import based on your authMiddleware.ts using a default export named 'protect'
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware")); // <-- Import 'protect' as the default export
// Corrected import path for the role middleware
const roleMiddleware_1 = require("../middleware/roleMiddleware"); // Assuming authorizeRole is a named export factory
const router = (0, express_1.Router)();
exports.router = router;
const managerController = new managerController_1.ManagerController(); // Create an instance of the controller
// --- Middleware for Manager Routes ---
// Apply authentication middleware to all manager routes
// Use the correct middleware name 'protect'
router.use(authMiddleware_1.default); // This line should now work with the corrected protect signature
router.use((0, roleMiddleware_1.authorizeRole)(['Manager', 'Admin']));
// --- Routes ---
// GET /api/manager/pending-requests
// Fetches all pending leave requests submitted by employees reporting to this manager
router.get("/pending-requests", managerController.getPendingLeaveRequests);
