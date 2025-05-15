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
exports.Role = void 0;
// leave-app-backend-ts/src/entity/Role.ts
const typeorm_1 = require("typeorm");
const User_1 = require("./User"); // Import related entity
let Role = class Role {
    // --- Change PrimaryColumn to PrimaryGeneratedColumn if using AUTO_INCREMENT in DB ---
    role_id;
    name;
    description;
    created_at;
    users;
};
exports.Role = Role;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: "int" }) // Use PrimaryGeneratedColumn for auto-incrementing PK
    ,
    __metadata("design:type", Number)
], Role.prototype, "role_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 50, unique: true }),
    __metadata("design:type", String)
], Role.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "varchar", length: 255, nullable: true }),
    __metadata("design:type", Object)
], Role.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" }),
    __metadata("design:type", Date)
], Role.prototype, "created_at", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => User_1.User, (user) => user.role),
    __metadata("design:type", Array)
], Role.prototype, "users", void 0);
exports.Role = Role = __decorate([
    (0, typeorm_1.Entity)("roles")
], Role);
