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
exports.Leave = exports.LeaveStatus = void 0;
// leave-app-backend-ts/src/entity/Leave.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User");
const LeaveType_1 = require("./LeaveType");
const LeaveApproval_1 = require("./LeaveApproval"); // <-- Import the new entity
// Define the possible values for the status ENUM
var LeaveStatus;
(function (LeaveStatus) {
    LeaveStatus["Pending"] = "Pending";
    LeaveStatus["Approved"] = "Approved";
    LeaveStatus["Rejected"] = "Rejected";
    LeaveStatus["Cancelled"] = "Cancelled";
    LeaveStatus["Awaiting_Admin_Approval"] = "Awaiting_Admin_Approval";
})(LeaveStatus || (exports.LeaveStatus = LeaveStatus = {}));
let Leave = class Leave {
    leave_id;
    user_id;
    type_id;
    start_date;
    end_date;
    reason;
    status;
    required_approvals;
    applied_at;
    updated_at; // Define the Many-to-One relationship with User
    processed_by_id; // ID of the user who last processed this request
    processed_at; // Timestamp when the request was last processed
    user; // Define the Many-to-One relationship with LeaveType
    leaveType; // --- ADD THIS One-to-Many relationship with LeaveApproval --- // A Leave request can have many approval records // The inverse side on the LeaveApproval entity is the 'leave' property
    processedBy;
    approvals; // Property name for the list of approval records
};
exports.Leave = Leave;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }),
    __metadata("design:type", Number)
], Leave.prototype, "leave_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], Leave.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }),
    __metadata("design:type", Number)
], Leave.prototype, "type_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", Date)
], Leave.prototype, "start_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "date" }),
    __metadata("design:type", Date)
], Leave.prototype, "end_date", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text" }),
    __metadata("design:type", String)
], Leave.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: LeaveStatus, default: LeaveStatus.Pending }),
    __metadata("design:type", String)
], Leave.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int", default: 1 }),
    __metadata("design:type", Number)
], Leave.prototype, "required_approvals", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Leave.prototype, "applied_at", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: "timestamp",
        default: () => "CURRENT_TIMESTAMP",
        onUpdate: "CURRENT_TIMESTAMP",
    }),
    __metadata("design:type", Date)
], Leave.prototype, "updated_at", void 0);
__decorate([
    (0, typeorm_1.Column)({ nullable: true }) // processed_by_id can be null initially (when status is Pending)
    ,
    __metadata("design:type", Object)
], Leave.prototype, "processed_by_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", nullable: true }) // processed_at can be null initially
    ,
    __metadata("design:type", Object)
], Leave.prototype, "processed_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.leaves),
    (0, typeorm_1.JoinColumn)({ name: "user_id" }),
    __metadata("design:type", User_1.User)
], Leave.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => LeaveType_1.LeaveType, (leaveType) => leaveType.leaves),
    (0, typeorm_1.JoinColumn)({ name: "type_id" }),
    __metadata("design:type", LeaveType_1.LeaveType)
], Leave.prototype, "leaveType", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, { createForeignKeyConstraints: false }) // Adjust options based on your DB constraints
    ,
    (0, typeorm_1.JoinColumn)({ name: "processed_by_id" }),
    __metadata("design:type", User_1.User)
], Leave.prototype, "processedBy", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => LeaveApproval_1.LeaveApproval, (leaveApproval) => leaveApproval.leave),
    __metadata("design:type", Array)
], Leave.prototype, "approvals", void 0);
exports.Leave = Leave = __decorate([
    (0, typeorm_1.Entity)("leaves")
], Leave);
