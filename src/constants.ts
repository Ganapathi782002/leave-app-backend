export const ADMIN_ROLE_ID = 1;
export const EMPLOYEE_ROLE_ID = 2;
export const MANAGER_ROLE_ID = 3;
export const INTERN_ROLE_ID = 4;

// --- Initial Leave Balances Mapping by Role ---
export const roleInitialBalances: { [roleId: number]: { leaveTypeName: string; initialDays: number }[] } = {
    [EMPLOYEE_ROLE_ID]: [ // Role 2
        { leaveTypeName: 'Casual Leave', initialDays: 15 }, // Example: 15 days casual
        { leaveTypeName: 'Sick Leave', initialDays: 15 },    // Example: 15 days sick
    ],
    [MANAGER_ROLE_ID]: [ // Role 3
        { leaveTypeName: 'Casual Leave', initialDays: 15 }, // Assuming same as Employee for applying
        { leaveTypeName: 'Sick Leave', initialDays: 15 },
    ],
    [INTERN_ROLE_ID]: [ // Role 4
        { leaveTypeName: 'Loss of Pay', initialDays: 999999 }
    ],
    // ADMIN_ROLE_ID typically doesn't apply for leave this way.
    // If Admins can apply for specific leave types, you'd define them here or in a separate mapping.
};
