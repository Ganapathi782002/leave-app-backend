"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const data_source_1 = require("./data-source"); // Your TypeORM data source
// Import your routers
const authRoutes_1 = require("./routes/authRoutes"); // <-- Import authRoutes
const leaveRoutes_1 = require("./routes/leaveRoutes");
const managerRoutes_1 = require("./routes/managerRoutes"); // <-- Import managerRoutes
const adminRoutes_1 = require("./routes/adminRoutes"); // <-- Import the new adminRoutes
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, "../../.env") }); // Adjust path if needed
const app = (0, express_1.default)();
const port = parseInt(process.env.PORT || "5000", 10);
const host = "0.0.0.0";
// Middleware
app.use((0, cors_1.default)()); // Or configure specific origins
app.use(express_1.default.json()); // For parsing application/json
app.use((req, res, next) => {
    // <-- Ensure Request, Response, NextFunction are imported from 'express'
    console.log("--- App Received Request:", req.method, req.originalUrl);
    next(); // Pass the request to the next middleware or router
});
// Database Initialization
data_source_1.AppDataSource.initialize()
    .then(() => {
    console.log("TypeORM Data Source has been initialized!");
    // Mount your routers
    app.use("/api/auth", authRoutes_1.router); // <-- Mount authRoutes (example path)
    app.use("/api/leaves", leaveRoutes_1.router);
    app.use("/api/manager", managerRoutes_1.router); // <-- Mount managerRoutes (example path)
    app.use("/api/admin", adminRoutes_1.adminRoutes); // <-- Mount the admin router
    // Basic route for testing server
    app.get("/", (req, res) => {
        res.send("Leave Management Backend API");
    });
    // Start the server
    app.listen(port, host, () => {
        console.log(`Server running at http://${host}:${port}`);
    });
})
    .catch((error) => console.error("Error during TypeORM initialization:", error));
