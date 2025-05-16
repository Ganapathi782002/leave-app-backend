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
exports.LeaveApproval = exports.ApprovalAction = void 0;
// leave-app-backend-ts/src/entity/LeaveApproval.ts
const typeorm_1 = require("typeorm");
const Leave_1 = require("./Leave"); // Import the Leave entity
const User_1 = require("./User"); // Import the User entity (for the approver)
// Define the possible actions for an approval record
var ApprovalAction;
(function (ApprovalAction) {
    ApprovalAction["Approved"] = "Approved";
    ApprovalAction["Rejected"] = "Rejected";
    ApprovalAction["Reviewed"] = "Reviewed";
})(ApprovalAction || (exports.ApprovalAction = ApprovalAction = {}));
let LeaveApproval = class LeaveApproval {
    approval_id; // Unique ID for each approval record
    leave_id;
    approver_id;
    action; // TypeScript type: ApprovalAction Enum value
    comments; // TypeScript type: string or null
    approved_at; // Timestamp when the action was taken
    // Define the Many-to-One relationship with Leave
    // An approval record belongs to one Leave request
    leave; // TypeScript type: Leave entity
    // Define the Many-to-One relationship with User (the approver)
    // An approval record is associated with one User (the approver)
    approver; // TypeScript type: User entity
};
exports.LeaveApproval = LeaveApproval;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }),
    __metadata("design:type", Number)
], LeaveApproval.prototype, "approval_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }) // Foreign key column for the leave request
    ,
    __metadata("design:type", Number)
], LeaveApproval.prototype, "leave_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "int" }) // Foreign key column for the user who took the action (the approver)
    ,
    __metadata("design:type", Number)
], LeaveApproval.prototype, "approver_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "enum", enum: ApprovalAction, default: ApprovalAction.Reviewed }) // Action taken (Approved, Rejected, etc.)
    ,
    __metadata("design:type", String)
], LeaveApproval.prototype, "action", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "text", nullable: true }) // Optional comments from the approver
    ,
    __metadata("design:type", Object)
], LeaveApproval.prototype, "comments", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], LeaveApproval.prototype, "approved_at", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Leave_1.Leave, (leave) => leave.approvals) // 'approvals' is the inverse side property in Leave entity
    ,
    (0, typeorm_1.JoinColumn)({ name: "leave_id" }) // Explicitly specify the foreign key column name
    ,
    __metadata("design:type", Leave_1.Leave)
], LeaveApproval.prototype, "leave", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => User_1.User, (user) => user.leaveApprovalsTaken) // You might want a property on User to see approvals they've done
    ,
    (0, typeorm_1.JoinColumn)({ name: "approver_id" }) // Explicitly specify the foreign key column name
    ,
    __metadata("design:type", User_1.User)
], LeaveApproval.prototype, "approver", void 0);
exports.LeaveApproval = LeaveApproval = __decorate([
    (0, typeorm_1.Entity)("leave_approvals") // Maps this class to the 'leave_approvals' table
], LeaveApproval);
