import "reflect-metadata";
import { DataSource, DataSourceOptions } from "typeorm";
import * as dotenv from "dotenv";
import { SeederOptions } from 'typeorm-extension';


// Load environment variables
dotenv.config(); // Ensure this is called
//const isSSL = process.env.SSL ==="REQUIRED"
//console.log("Value of process.env.DB_NAME:", process.env.DB_NAME); // <-- Add this log

const dataSourceOptions: DataSourceOptions & SeederOptions = {
    type: "mysql", // <-- Ensure this is "mysql"
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USER, // <-- Ensure this is DB_USER
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, // <-- Ensure this is DB_NAME
    ssl: process.env.SSL === "REQUIRED" ? { rejectUnauthorized: false } : undefined,
    synchronize: false,// Set to true for development/testing, false for production
    logging: process.env.NODE_ENV === 'development' ? ['query', 'error', 'log'] : ['error'],
    entities: [process.env.NODE_ENV === 'production' ? 'dist/entity/**/*.js' : 'src/entity/**/*.ts'],
    migrations: [],
    subscribers: [],
    seeds: ["src/database/seeds/**/*{.ts,.js}"],
    factories: ["src/database/factories/**/*{.ts,.js}"],
};

//console.log("DataSource Options object:", dataSourceOptions); // <-- Add this log

export const AppDataSource = new DataSource(dataSourceOptions);

// ... rest of the file ...