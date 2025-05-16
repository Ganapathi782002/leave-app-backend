"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeaveBalance = void 0;
// leave-app-backend-ts/src/entity/LeaveBalance.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User"); // Import related entities
const LeaveType_1 = require("./LeaveType");
let LeaveBalance = class LeaveBalance {
    // Use 'export' keyword
    balance_id; // TypeScript type: number
    user_id; // TypeScript type: number
    type_id; // TypeScript type: number
    year; // TypeScript type: number
    total_days; // TypeScript type: number (JavaScript represents decimals as numbers)
    used_days; // TypeScript type: number
    available_days;
    // Define the Many-to-One relationship with User
    // The inverse side on the User entity is the 'leaveBalances' property
    user; // TypeScript type: User entity
    // Define the Many-to-One relationship with LeaveType
    // The inverse side on the LeaveType entity is the 'leaveBalances' property
    leaveType; // TypeScript type: LeaveType entity
};
exports.LeaveBalance = LeaveBalance;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }),
    __metadata("design:type", Number)
], LeaveBalance.prototype, "balance_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }) // Foreign key column
    ,
    __metadata("design:type", Number)
], LeaveBalance.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }) // Foreign key column
    ,
    __metadata("design:type", Number)
], LeaveBalance.prototype, "type_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], LeaveBalance.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 2 }) // Decimal with precision and scale
    ,
    __metadata("design:type", String)
], LeaveBalance.prototype, "total_days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "decimal", precision: 5, scale: 2, default: 0.0 }),
    __metadata("design:type", String)
], LeaveBalance.prototype, "used_days", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 5, scale: 2, default: '0.00' }),
    __metadata("design:type", String)
], LeaveBalance.prototype, "available_days", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.leaveBalances),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }) // Explicitly specify the foreign key column name
    ,
    __metadata("design:type", User_1.User)
], LeaveBalance.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => LeaveType_1.LeaveType, (leaveType) => leaveType.leaveBalances),
    (0, typeorm_1.JoinColumn)({ name: "type_id" }) // Explicitly specify the foreign key column name
    ,
    __metadata("design:type", LeaveType_1.LeaveType)
], LeaveBalance.prototype, "leaveType", void 0);
exports.LeaveBalance = LeaveBalance = __decorate([
    (0, typeorm_1.Entity)("leave_balances") // Maps this class to the 'leave_balances' table
], LeaveBalance);
