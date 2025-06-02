export const ADMIN_ROLE_ID = 1;
export const EMPLOYEE_ROLE_ID = 2;
export const MANAGER_ROLE_ID = 3;
export const INTERN_ROLE_ID = 4;

export const roleInitialBalances: {
  [roleId: number]: { leaveTypeName: string; initialDays: number }[];
} = {
  [EMPLOYEE_ROLE_ID]: [
    // Role 2
    { leaveTypeName: "Casual Leave", initialDays: 15 },
    { leaveTypeName: "Sick Leave", initialDays: 15 },
  ],
  [MANAGER_ROLE_ID]: [
    // Role 3
    { leaveTypeName: "Casual Leave", initialDays: 15 }, // Assuming same as Employee for applying
    { leaveTypeName: "Sick Leave", initialDays: 15 },
  ],
  [INTERN_ROLE_ID]: [
    // Role 4
    { leaveTypeName: "Loss of Pay", initialDays: 999999 },
  ],
};
