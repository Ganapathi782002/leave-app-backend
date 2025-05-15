"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// leave-app-backend-ts/src/server.ts
require("reflect-metadata");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const data_source_1 = require("./data-source");
// Import your route files
const authRoutes_1 = require("./routes/authRoutes");
const leaveRoutes_1 = require("./routes/leaveRoutes");
const managerRoutes_1 = require("./routes/managerRoutes"); // <-- Import manager routes
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
data_source_1.AppDataSource.initialize()
    .then(() => {
    console.log("TypeORM Data Source has been initialized!");
    app.get("/", (req, res) => {
        res.send("Leave Management System Backend is running!");
    });
    app.use("/api/auth", authRoutes_1.router);
    app.use("/api/leaves", leaveRoutes_1.router); // --- Mount the new manager routes ---
    app.use("/api/manager", managerRoutes_1.router); // <-- Mount manager routes // TODO: Add other route groups later (e.g., /api/admin, /api/users)
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
})
    .catch((error) => {
    console.error("Error during TypeORM Data Source initialization:", error);
    process.exit(1);
});
