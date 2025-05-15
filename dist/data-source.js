"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppDataSource = void 0;
// src/data-source.ts
require("reflect-metadata");
const typeorm_1 = require("typeorm"); // Keep DataSourceOptions
const dotenv = __importStar(require("dotenv"));
const User_1 = require("./entity/User");
const Leave_1 = require("./entity/Leave");
const LeaveType_1 = require("./entity/LeaveType");
const LeaveBalance_1 = require("./entity/LeaveBalance");
const Role_1 = require("./entity/Role");
const LeaveApproval_1 = require("./entity/LeaveApproval");
// Load environment variables
dotenv.config();
// Define the options object, explicitly typing it as a combination of DataSourceOptions and SeederOptions
const dataSourceOptions = {
    type: "postgres", // or your database type
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "5432"),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    synchronize: false, // Set to true for development/testing, false for production
    logging: true, // Set to true to see SQL queries
    entities: [User_1.User, Leave_1.Leave, LeaveType_1.LeaveType, LeaveBalance_1.LeaveBalance, Role_1.Role, LeaveApproval_1.LeaveApproval], // List all your entities here
    migrations: [], // Add your migration paths here later
    subscribers: [],
    // --- Add these for TypeORM Seeding ---
    seeds: ["src/database/seeds/**/*{.ts,.js}"], // Path to your seed files
    factories: ["src/database/factories/**/*{.ts,.js}"], // Path to your factory files (optional for now)
    // --- End TypeORM Seeding Config ---
};
// Pass the options object to the DataSource constructor
exports.AppDataSource = new typeorm_1.DataSource(dataSourceOptions); // <-- Use the typed options object
