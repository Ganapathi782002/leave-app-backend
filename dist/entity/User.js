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
exports.User = void 0;
// leave-app-backend-ts/src/entity/User.ts
const typeorm_1 = require("typeorm");
const Role_1 = require("./Role");
const Leave_1 = require("./Leave");
const LeaveBalance_1 = require("./LeaveBalance");
// We will also need to import the LeaveApproval entity later
let User = class User {
    user_id;
    name;
    email;
    password_hash;
    role_id;
    // --- ADD THIS COLUMN FOR THE MANAGER ID ---
    manager_id; // TypeScript type reflects nullable column
    // --- ADD THIS FOR CREATED/UPDATED TIMESTAMPS ---
    // (Using TypeORM's @CreateDateColumn and @UpdateDateColumn is often cleaner)
    created_at;
    updated_at;
    // --- OR using TypeORM decorators ---
    // @CreateDateColumn()
    // createdAt!: Date;
    // @UpdateDateColumn()
    // updatedAt!: Date;
    // (Requires importing @CreateDateColumn and @UpdateDateColumn from typeorm)
    // Define the Many-to-One relationship with Role
    role;
    // Define the relationship to the user's manager
    // Many users report to One manager
    manager; // TypeScript type: User entity or null
    // Define the relationship to the users who report to this manager
    // One manager can have Many reports
    reports; // TypeScript type: Array of User entities
    // Define the One-to-Many relationship with Leave
    leaves;
    // Define the One-to-Many relationship with LeaveBalance
    leaveBalances;
    leaveApprovalsTaken;
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }),
    __metadata("design:type", Number)
], User.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255 }),
    __metadata("design:type", String)
], User.prototype, "password_hash", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], User.prototype, "role_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", nullable: true }) // nullable: true because not all users have a manager
    ,
    __metadata("design:type", Object)
], User.prototype, "manager_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], User.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], User.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Role_1.Role, (role) => role.users),
    (0, typeorm_1.JoinColumn)({ name: "role_id" }),
    __metadata("design:type", Role_1.Role)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User, (manager) => manager.reports),
    (0, typeorm_1.JoinColumn)({ name: "manager_id" }) // Link this relationship to the manager_id column
    ,
    __metadata("design:type", Object)
], User.prototype, "manager", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => User, (user) => user.manager),
    __metadata("design:type", Array)
], User.prototype, "reports", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => Leave_1.Leave, (leave) => leave.user),
    __metadata("design:type", Array)
], User.prototype, "leaves", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => LeaveBalance_1.LeaveBalance, (leaveBalance) => leaveBalance.user) // Corrected syntax here
    ,
    __metadata("design:type", Array)
], User.prototype, "leaveBalances", void 0);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)("users")
], User);
