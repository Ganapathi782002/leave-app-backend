import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./data-source"; // Your TypeORM data source
import { Request, Response, NextFunction } from "express";
// Import your routers
import { router as authRoutes } from "./routes/authRoutes"; // <-- Import authRoutes
import { router as leaveRoutes } from "./routes/leaveRoutes";
import { router as managerRoutes } from "./routes/managerRoutes"; // <-- Import managerRoutes
import { adminRoutes } from "./routes/adminRoutes"; // <-- Import the new adminRoutes

dotenv.config({ path: path.resolve(__dirname, "../../.env") }); // Adjust path if needed

const app = express();
const port = parseInt(process.env.PORT || "5000", 10);
const host = "0.0.0.0";

// Middleware
app.use(cors()); // Or configure specific origins
app.use(express.json()); // For parsing application/json

app.use((req: Request, res: Response, next: NextFunction) => {
  next(); // Pass the request to the next middleware or router
});

// Database Initialization
AppDataSource.initialize()
  .then(() => {
    // console.log("TypeORM Data Source has been initialized!");

    // Mount your routers
    app.use("/api/auth", authRoutes);
    app.use("/api/leaves", leaveRoutes);
    app.use("/api/manager", managerRoutes);
    app.use("/api/admin", adminRoutes); 

    // Basic route for testing server
    app.get("/", (req, res) => {
      res.send("Leave Management Backend API");
    });

    // Start the server
    app.listen(port, host, () => {
      // console.log(`Server running at http://${host}:${port}`);
    });
  })
  .catch((error) =>
    console.error("Error during TypeORM initialization:", error)
  );
