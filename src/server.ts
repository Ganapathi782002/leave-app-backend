import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { AppDataSource } from "./data-source";
import { Request, Response, NextFunction } from "express";
import { router as authRoutes } from "./routes/authRoutes";
import { router as leaveRoutes } from "./routes/leaveRoutes";
import { router as managerRoutes } from "./routes/managerRoutes";
import { adminRoutes } from "./routes/adminRoutes";
import teamRoutes from "./routes/teamRoutes";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = parseInt(process.env.PORT || "5000", 10);
const host = "0.0.0.0";

app.use(cors());
app.use(express.json());

app.use((req: Request, res: Response, next: NextFunction) => {
  next();
});

AppDataSource.initialize()
  .then(() => {
    // Mounting routers
    app.use("/api/auth", authRoutes);
    app.use("/api/leaves", leaveRoutes);
    app.use("/api/manager", managerRoutes);
    app.use("/api/admin", adminRoutes);
    app.use("/api/team", teamRoutes);

    // Basic route for testing server
    app.get("/", (req, res) => {
      res.send("Leave Management Backend API");
    });

    app.listen(port, host, () => {
      // console.log(`Server running at http://${host}:${port}`);
    });
  })
  .catch((error) =>
    console.error("Error during TypeORM initialization:", error),
  );
