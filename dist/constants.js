"use strict";
// src/constants.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleInitialBalances = exports.INTERN_ROLE_ID = exports.MANAGER_ROLE_ID = exports.EMPLOYEE_ROLE_ID = exports.ADMIN_ROLE_ID = void 0;
// --- Define Role IDs (These must match your database 'roles' table exact role_id values) ---
exports.ADMIN_ROLE_ID = 1;
exports.EMPLOYEE_ROLE_ID = 2;
exports.MANAGER_ROLE_ID = 3;
exports.INTERN_ROLE_ID = 4;
// --- End Role IDs ---
// --- Initial Leave Balances Mapping by Role ---
// This also implicitly defines which leave types are 'initializable' and often 'applyable' for each role.
// Consider creating a separate mapping if applyable types differ significantly from initializable types.
exports.roleInitialBalances = {
    [exports.EMPLOYEE_ROLE_ID]: [
        { leaveTypeName: 'Casual Leave', initialDays: 15 }, // Example: 15 days casual
        { leaveTypeName: 'Sick Leave', initialDays: 15 }, // Example: 15 days sick
    ],
    [exports.MANAGER_ROLE_ID]: [
        { leaveTypeName: 'Casual Leave', initialDays: 15 }, // Assuming same as Employee for applying
        { leaveTypeName: 'Sick Leave', initialDays: 15 },
    ],
    [exports.INTERN_ROLE_ID]: [
        { leaveTypeName: 'Loss of Pay', initialDays: 999999 }
    ],
    // ADMIN_ROLE_ID typically doesn't apply for leave this way.
    // If Admins can apply for specific leave types, you'd define them here or in a separate mapping.
};
// You might add other constants here later
