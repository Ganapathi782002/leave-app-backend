import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import { SeederOptions } from "typeorm-extension";

dotenv.config();
//const isSSL = process.env.SSL ==="REQUIRED"

const dataSourceOptions: DataSourceOptions & SeederOptions = {
  type: "mysql",
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || "3306"),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl:
    process.env.SSL === "REQUIRED" ? { rejectUnauthorized: false } : undefined,
  synchronize: false,
  logging:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "log"]
      : ["error"],
  entities: [
    process.env.NODE_ENV === "production"
      ? "dist/entity/**/*.js"
      : "src/entity/**/*.ts",
  ],
  migrations: [],
  subscribers: [],
  seeds: ["src/database/seeds/**/*{.ts,.js}"],
  factories: ["src/database/factories/**/*{.ts,.js}"],
};

export const AppDataSource = new DataSource(dataSourceOptions);
