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
exports.LeaveType = void 0;
// leave-app-backend-ts/src/entity/LeaveType.ts
const typeorm_1 = require("typeorm");
const Leave_1 = require("./Leave"); // Import related entities
const LeaveBalance_1 = require("./LeaveBalance");
let LeaveType = class LeaveType {
    // Use 'export' keyword
    type_id; // TypeScript type: number
    name; // TypeScript type: string
    description; // TypeScript type: string or null
    requires_approval; // TypeScript type: boolean
    is_balance_based; // TypeScript type: boolean
    created_at; // TypeScript type: Date
    // Define the One-to-Many relationship with Leave
    // The inverse side on the Leave entity is the 'leaveType' property
    leaves; // TypeScript type: Array of Leave entities
    // Define the One-to-Many relationship with LeaveBalance
    // The inverse side on the LeaveBalance entity is the 'leaveType' property
    leaveBalances; // TypeScript type: Array of LeaveBalance entities
};
exports.LeaveType = LeaveType;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }),
    __metadata("design:type", Number)
], LeaveType.prototype, "type_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, unique: true }),
    __metadata("design:type", String)
], LeaveType.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], LeaveType.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], LeaveType.prototype, "requires_approval", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "boolean", default: true }),
    __metadata("design:type", Boolean)
], LeaveType.prototype, "is_balance_based", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], LeaveType.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Leave_1.Leave, (leave) => leave.leaveType),
    __metadata("design:type", Array)
], LeaveType.prototype, "leaves", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => LeaveBalance_1.LeaveBalance, (leaveBalance) => leaveBalance.leaveType),
    __metadata("design:type", Array)
], LeaveType.prototype, "leaveBalances", void 0);
exports.LeaveType = LeaveType = __decorate([
    (0, typeorm_1.Entity)("leave_types") // Maps this class to the 'leave_types' table
], LeaveType);
