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
const typeorm_1 = require("typeorm");
const dotenv = __importStar(require("dotenv"));
const User_1 = require("./entity/User");
const Leave_1 = require("./entity/Leave");
const LeaveType_1 = require("./entity/LeaveType");
const LeaveBalance_1 = require("./entity/LeaveBalance");
const Role_1 = require("./entity/Role");
const LeaveApproval_1 = require("./entity/LeaveApproval");
// Load environment variables
dotenv.config(); // Ensure this is called
const isSSL = process.env.SSL === "REQUIRED";
console.log("Value of process.env.DB_NAME:", process.env.DB_NAME); // <-- Add this log
const dataSourceOptions = {
    type: "mysql", // <-- Ensure this is "mysql"
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USER, // <-- Ensure this is DB_USER
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, // <-- Ensure this is DB_NAME
    ssl: isSSL ? { rejectUnauthorized: false } : undefined,
    synchronize: false, // Set to true for development/testing, false for production
    logging: true, // Set to true to see SQL queries
    entities: [User_1.User, Leave_1.Leave, LeaveType_1.LeaveType, LeaveBalance_1.LeaveBalance, Role_1.Role, LeaveApproval_1.LeaveApproval],
    migrations: [],
    subscribers: [],
    seeds: ["src/database/seeds/**/*{.ts,.js}"],
    factories: ["src/database/factories/**/*{.ts,.js}"],
};
console.log("DataSource Options object:", dataSourceOptions); // <-- Add this log
exports.AppDataSource = new typeorm_1.DataSource(dataSourceOptions);
// ... rest of the file ...
