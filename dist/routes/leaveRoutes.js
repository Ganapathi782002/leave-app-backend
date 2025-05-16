"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// leave-app-backend-ts/src/routes/leaveRoutes.ts
const express_1 = __importDefault(require("express"));
// Keep differenceInCalendarDays if you use it elsewhere, otherwise remove
const typeorm_1 = require("typeorm");
const data_source_1 = require("../data-source");
const LeaveType_1 = require("../entity/LeaveType");
const LeaveBalance_1 = require("../entity/LeaveBalance");
const Leave_1 = require("../entity/Leave");
const User_1 = require("../entity/User");
const LeaveApproval_1 = require("../entity/LeaveApproval");
const constants_1 = require("../constants");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
// Import the role middleware if you decide to use it here instead of inline check
// import { authorizeRole } from '../middleware/roleMiddleware';
const router = express_1.default.Router();
exports.router = router;
// Get TypeORM Repositories
const leaveTypeRepository = data_source_1.AppDataSource.getRepository(LeaveType_1.LeaveType);
const leaveBalanceRepository = data_source_1.AppDataSource.getRepository(LeaveBalance_1.LeaveBalance);
const leaveRepository = data_source_1.AppDataSource.getRepository(Leave_1.Leave);
const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
const leaveApprovalRepository = data_source_1.AppDataSource.getRepository(LeaveApproval_1.LeaveApproval);
// Helper function to calculate calendar days of leave (includes weekends/holidays)
// Keep this if you need calendar days for display purposes, otherwise remove
const calculateCalendarLeaveDays = (startDate, endDate) => {
    // Accept Date objects
    if (startDate > endDate) {
        return 0;
    }
    const msPerDay = 1000 * 60 * 60 * 24;
    const diffInMs = endDate.getTime() - startDate.getTime();
    return Math.ceil(diffInMs / msPerDay) + 1; // Add 1 to include the end day
};
const areDateRangesOverlapping = (start1, end1, start2, end2) => {
    // Overlap exists if the first range starts before the second range ends
    // AND the first range ends after the second range starts.
    return start1 <= end2 && end1 >= start2;
};
// --- Helper function to calculate WORKING days (excluding weekends) ---
const calculateWorkingDays = (startDate, endDate) => {
    let count = 0;
    const currentDate = new Date(startDate.getTime()); // Create a mutable copy // Loop through each day from start_date to end_date
    while (currentDate <= endDate) {
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday // Check if the current day is NOT a Saturday (6) and NOT a Sunday (0)
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            count++; // It's a working day
        } // Move to the next day
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
};
// --- GET /api/leaves/types - Get available leave types (Protected Route) ---
const getLeaveTypesHandler = async (req, res) => {
    const userId = req.user?.user_id; // Get user ID from token
    const userRoleId = req.user?.role_id; // Get user Role ID from token
    console.log(`--- Inside getLeaveTypesHandler for User ID: ${userId}, Role ID: ${userRoleId} ---`); // Log handler entry
    // Defensive check if user or role info is missing after protect middleware
    if (!userId || userRoleId === undefined) {
        console.warn(`getLeaveTypesHandler: Authentication failed or role missing. User ID: ${userId}, Role ID: ${userRoleId}`); // Log auth failure
        res.status(401).json({ message: "User not authenticated or role missing." });
        return;
    }
    try {
        // Fetch ALL active/relevant leave types from the database
        // Consider adding a filter here later if some types are inactive or soft-deleted
        const allLeaveTypes = await leaveTypeRepository.find({
            order: { name: "ASC" },
        });
        console.log("getLeaveTypesHandler: Fetched all leave types:", allLeaveTypes.map(lt => ({ id: lt.type_id, name: lt.name }))); // Log all fetched types with ID/Name
        let applyableLeaveTypes = [];
        // Determine applyable leave types based on user role
        // For non-Admin roles, filter based on the roleInitialBalances mapping
        if (userRoleId !== constants_1.ADMIN_ROLE_ID) {
            // Use the IMPORTED roleInitialBalances mapping here
            const rulesForRole = constants_1.roleInitialBalances[userRoleId];
            console.log(`getLeaveTypesHandler: Rules found in roleInitialBalances for Role ID ${userRoleId}:`, rulesForRole); // Log rules for the role
            // Get the list of leave type names allowed for this role based on the mapping
            const allowedLeaveTypeNames = (rulesForRole || []).map(rule => rule.leaveTypeName);
            console.log(`getLeaveTypesHandler: Allowed leave type names derived from rules for Role ID ${userRoleId}:`, allowedLeaveTypeNames); // Log allowed names
            // Filter the fetched leave types to include only those whose name is in the allowed list
            applyableLeaveTypes = allLeaveTypes.filter(type => {
                const isApplyable = allowedLeaveTypeNames.includes(type.name);
                // console.log(`getLeaveTypesHandler: Checking type "${type.name}" (ID: ${type.type_id}) - Is Applyable for Role ${userRoleId}? ${isApplyable}`); // Detailed filtering decision log (can be noisy)
                return isApplyable;
            });
            console.log(`getLeaveTypesHandler: Filtered applyable leave types for Role ID ${userRoleId}:`, applyableLeaveTypes.map(lt => ({ id: lt.type_id, name: lt.name }))); // Log filtered types
        }
        else {
            // For Admin role, they typically don't apply for leave this way.
            // Returning an empty list is suitable for the 'Apply Leave' page for Admins.
            applyableLeaveTypes = [];
            console.log(`getLeaveTypesHandler: User is Admin (Role ID ${userRoleId}). Returning empty list for applyable types.`); // Log Admin case
        }
        // Send the filtered list of applyable leave types back
        res.status(200).json(applyableLeaveTypes);
        console.log(`getLeaveTypesHandler: Sent ${applyableLeaveTypes.length} applyable leave types.`); // Log count of sent types
    }
    catch (error) {
        console.error(`getLeaveTypesHandler: Error fetching leave types for user ${userId}:`, error); // Log any errors
        res
            .status(500)
            .json({ message: "Internal server error fetching leave types" });
    }
};
router.get("/types", authMiddleware_1.default, getLeaveTypesHandler);
// --- POST /api/leaves - Apply for Leave (Protected Route) ---
// In src/routes/leaveRoutes.ts
// --- POST /api/leaves - Apply for Leave (Protected Route) ---
const applyLeaveHandler = async (req, res) => {
    const user_id = req.user?.user_id;
    const user_role_id = req.user?.role_id;
    if (user_id === undefined || user_role_id === undefined) {
        console.error("User ID or Role ID not found on request after protect middleware.");
        res
            .status(401)
            .json({ message: "Authentication failed or user info missing." });
        return;
    }
    const { type_id, start_date, end_date, reason } = req.body;
    if (type_id === undefined || !start_date || !end_date || !reason) {
        res.status(400).json({
            message: "Leave type, start date, end date, and reason are required",
        });
        return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    startDateObj.setHours(0, 0, 0, 0);
    endDateObj.setHours(0, 0, 0, 0);
    const currentYear = new Date().getFullYear();
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({ message: "Invalid date format" });
        return;
    }
    if (startDateObj < today) {
        console.warn(`User ${user_id}: Attempted to apply for leave with a past start date: ${start_date}`);
        res.status(400).json({ message: "Leave start date cannot be in the past." });
        return; // Stop execution if validation fails
    }
    if (startDateObj > endDateObj) {
        res.status(400).json({ message: "Start date cannot be after end date" });
        return;
    } // Check if leave dates are in the current or future year (adjust logic if multi-year is allowed)
    if (startDateObj.getFullYear() < currentYear) {
        res.status(400).json({
            message: `Leave start date must be in the current or future year (${currentYear})`,
        });
        return;
    }
    if (endDateObj.getFullYear() > startDateObj.getFullYear() + 1) {
        res.status(400).json({
            message: "Leave duration cannot span across multiple years (excluding next year)",
        });
        return;
    }
    try {
        const leaveTypeDetails = await leaveTypeRepository.findOne({
            where: { type_id: type_id },
            select: ["type_id", "name", "requires_approval", "is_balance_based"],
        });
        if (!leaveTypeDetails) {
            res.status(400).json({ message: "Invalid leave type selected" });
            return;
        }
        const { type_id: selectedTypeId, name: leaveTypeName, requires_approval, is_balance_based, } = leaveTypeDetails;
        const requestedDays = calculateCalendarLeaveDays(startDateObj, endDateObj);
        if (requestedDays <= 0) {
            res
                .status(400)
                .json({ message: "Leave duration must be at least one day" });
            return;
        }
        console.log(`User ${user_id} applying for ${requestedDays} calendar days of ${leaveTypeName} (Type ID: ${selectedTypeId})`);
        // --- NEW: Overlap Validation Check ---
        // Find any existing Pending or Approved leaves for this user
        const existingLeaves = await leaveRepository.find({
            where: {
                user_id: user_id,
                status: (0, typeorm_1.In)(['Pending', 'Approved']) // <-- Use In operator here
            }
        });
        // Check for overlap with each existing leave
        for (const existingLeave of existingLeaves) {
            const existingStartDate = new Date(existingLeave.start_date);
            const existingEndDate = new Date(existingLeave.end_date);
            if (isNaN(existingStartDate.getTime()) || isNaN(existingEndDate.getTime())) {
                console.warn(`Skipping overlap check for invalid existing leave dates (ID: ${existingLeave.leave_id})`);
                continue; // Skip this existing leave if its dates are invalid
            }
            if (areDateRangesOverlapping(startDateObj, endDateObj, existingStartDate, existingEndDate)) {
                // Overlap found! Return an error response
                console.log(`Overlap detected for user ${user_id}: New leave ${startDateObj.toISOString()} to ${endDateObj.toISOString()} overlaps with existing leave ${existingStartDate.toISOString()} to ${existingEndDate.toISOString()} (ID: ${existingLeave.leave_id})`);
                res.status(400).json({
                    message: `Your requested leave dates (${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}) overlap with an existing leave request (Status: ${existingLeave.status}, Dates: ${existingStartDate.toLocaleDateString()} - ${existingEndDate.toLocaleDateString()}).`
                });
                return; // Stop processing and return the error
            }
        }
        console.log(`No overlap detected for user ${user_id}. Proceeding with application.`); // --- NEW: Role-based Leave Type Check --- // Assuming Interns (ROLE_ID 4) can ONLY apply for Loss of Pay (need LeaveType ID for this) // Let's assume Loss of Pay has type_id 5 for this example - adjust if different
        // --- End Overlap Validation Check ---
        const allowedLeaveTypeNamesForRole = (constants_1.roleInitialBalances[user_role_id] || []).map(rule => rule.leaveTypeName);
        const leaveTypeIsApplyableForRole = allowedLeaveTypeNamesForRole.includes(leaveTypeName);
        if (!leaveTypeIsApplyableForRole) {
            console.warn(`User ${user_id} (Role ID: ${user_role_id}) attempted to apply for '${leaveTypeName}' (Type ID: ${selectedTypeId}), which is not allowed for this role.`);
            res.status(403).json({ message: `You cannot apply for '${leaveTypeName}' leave.` });
            return;
        }
        console.log(`User ${user_id} (Role ID: ${user_role_id}) applying for '${leaveTypeName}' (Type ID: ${selectedTypeId}). This type is allowed for this role.`);
        // Add checks for other roles if certain leave types are restricted (e.g., only Managers can apply for Sabbatical) // --- End Role-based Leave Type Check --- // --- Modified: Check leave balance based on role and leave type --- // Only check balance if it's a balance-based leave type AND the user is NOT an Intern (or other roles that bypass balance checks)
        if (is_balance_based && user_role_id !== constants_1.INTERN_ROLE_ID) {
            // Check balance for non-Interns on balance-based leave
            const userBalance = await leaveBalanceRepository.findOne({
                where: {
                    user_id: user_id,
                    type_id: selectedTypeId,
                    year: startDateObj.getFullYear(), // Balance is tied to the START date's year
                },
                select: ["total_days", "used_days"],
            });
            if (!userBalance) {
                res.status(400).json({
                    message: `Leave balance not found for ${leaveTypeName} for the year ${startDateObj.getFullYear()}. Please contact HR.`,
                });
                return;
            }
            // IMPORTANT: Parse strings to numbers for calculation
            const availableDays = parseFloat(userBalance.total_days) -
                parseFloat(userBalance.used_days);
            if (requestedDays > availableDays) {
                res.status(400).json({
                    message: `Insufficient balance for ${leaveTypeName}. Available: ${availableDays.toFixed(2)}, Requested: ${requestedDays.toFixed(2)}`,
                });
                return;
            }
            console.log(`Balance check passed for non-Intern. Available: ${availableDays.toFixed(2)}, Requested: ${requestedDays.toFixed(2)}`);
        }
        else if (is_balance_based && user_role_id === constants_1.INTERN_ROLE_ID) {
            // Interns should not be applying for balance-based leave types other than LoP (handled by the check above)
            // If they somehow reach here trying to apply for balance-based leave, it's an error
            res.status(403).json({
                message: `Interns cannot apply for balance-based leave types.`,
            });
            return;
        }
        else if (!is_balance_based) {
            console.log(`${leaveTypeName} is not balance-based. Skipping balance check.`); // Loss of Pay (if it's not balance-based) will fall here and bypass balance check, which is correct for Interns.
        } // --- End Modified Leave Balance Check --- // --- Modified: Determine initial status and required approval based on leave type property ---
        let initialStatus = Leave_1.LeaveStatus.Pending;
        let requiredApprovals = 1; // Default to 1 if requires_approval is true and no specific rule matches
        if (!requires_approval) {
            initialStatus = Leave_1.LeaveStatus.Approved; // Auto-approve if leave type doesn't require approval (like Emergency Leave)
            requiredApprovals = 0; // 0 approvals needed if auto-approved
            console.log(`${leaveTypeName} does not require approval. Setting status to Approved.`);
        }
        else {
            // requires_approval is true
            // Example rule: Leave requests > 5 *working* days require 2 approvals
            // Use working days for approval rule if appropriate
            // This rule could be based on working days or calendar days - clarify based on requirement
            const workingDaysForApprovalRule = calculateWorkingDays(startDateObj, endDateObj); // Use working days for this rule example
            if (workingDaysForApprovalRule > 5) {
                requiredApprovals = 2;
                console.log(`Leave duration > 5 working days (${workingDaysForApprovalRule}) and requires approval. Setting required approvals to 2.`);
            }
            else {
                requiredApprovals = 1;
                console.log(`Leave duration <= 5 working days (${workingDaysForApprovalRule}) and requires approval. Setting required approvals to 1.`);
            }
        } // --- End Modified Initial Status Determination ---
        const newLeave = new Leave_1.Leave();
        newLeave.user_id = user_id;
        newLeave.type_id = selectedTypeId;
        newLeave.start_date = startDateObj; // Store as Date objects
        newLeave.end_date = endDateObj; // Store as Date objects
        newLeave.reason = reason;
        newLeave.status = initialStatus;
        newLeave.required_approvals = requiredApprovals; // TODO: Add fields for submitted_by_id if different from user_id (e.g., HR submitting on behalf)
        const savedLeave = await leaveRepository.save(newLeave); // If auto-approved, immediately update balance and log approval?
        // We decided to handle balance updates and logging in the status update handler.
        // If initialStatus is Approved, the status update handler logic for Approved status
        // would need to be called from here or a separate service/utility function.
        // For now, we rely on the manager approval flow for Approved status balance/log.
        // If you need auto-approval to trigger balance updates/logs immediately,
        // you'll need to refactor this part to call the balance update/logging logic here
        // when initialStatus is Approved.
        res.status(201).json({
            message: "Leave request submitted successfully",
            leaveId: savedLeave.leave_id,
            initialStatus: savedLeave.status,
            requiredApprovals: savedLeave.required_approvals,
        });
        return;
    }
    catch (error) {
        console.error("Error submitting leave request:", error);
        let errorMessage = "An unexpected error occurred during leave submission.";
        if (error instanceof Error) {
            // Use the error message from the Error object
            errorMessage = error.message;
        }
        else if (typeof error === 'string') {
            // Handle cases where the thrown error is a string
            errorMessage = error;
        } // Provide a more user-friendly error message if it's a known issue (like overlap validation error)
        res
            .status(500)
            .json({
            message: errorMessage || "Internal server error during leave submission",
        }); // Use error.message for validation errors
        return;
    }
};
router.post("/", authMiddleware_1.default, applyLeaveHandler);
const getUserLeaveBalancesHandler = async (req, res) => {
    // This handler fetches leave balances for the logged-in user.
    const userId = req.user?.user_id; // Get user ID from the authenticated request
    if (!userId) {
        res
            .status(401)
            .json({ message: "User not authenticated or user ID missing." });
        return;
    }
    try {
        // --- Implement the logic to fetch leave balances for the user ---
        // Example: Fetch balances for the current year
        const currentYear = new Date().getFullYear();
        const userBalances = await leaveBalanceRepository.find({
            where: { user_id: userId, year: currentYear },
            // Optional: Load relations if needed for the frontend display (e.g., leave type name)
            relations: ["leaveType"],
        });
        // --- Send the fetched balances back to the frontend ---
        // The frontend will typically calculate 'available days' (total - used) itself
        res.status(200).json(userBalances);
        return;
    }
    catch (error) {
        console.error("Error fetching user leave balances:", error);
        res
            .status(500)
            .json({ message: "Internal server error fetching leave balances" });
        return;
    }
};
router.get("/balance", authMiddleware_1.default, getUserLeaveBalancesHandler); // Register the /balance route
// --- GET /api/leaves/my - Get authenticated user's leave requests (history) (Protected Route) ---
const getUserLeaveHistoryHandler = async (req, res) => {
    // This handler fetches all leave requests submitted by the logged-in user.
    const userId = req.user?.user_id; // Get user ID from the authenticated request
    if (!userId) {
        res
            .status(401)
            .json({ message: "User not authenticated or user ID missing." });
        return;
    }
    try {
        // --- Implement the logic to fetch leave requests for the user ---
        const userLeaves = await leaveRepository.find({
            where: { user_id: userId },
            // Optional: Load relations if needed (e.g., leave type name)
            relations: ["leaveType"],
            order: { applied_at: "DESC" }, // Order by application date, newest first
        });
        // --- Send the fetched leave history back to the frontend ---
        res.status(200).json(userLeaves);
        return;
    }
    catch (error) {
        console.error("Error fetching user leave history:", error);
        res
            .status(500)
            .json({ message: "Internal server error fetching leave history" });
        return;
    }
};
router.get("/my", authMiddleware_1.default, getUserLeaveHistoryHandler);
// --- GET /api/leaves/:id - Get details of a specific leave request by ID (Protected Route) ---
// ... (getLeaveDetailsHandler and router.get('/:id', protect, ...)) ...
// --- GET /api/leaves/pending-approvals - Get ALL pending leave requests (Protected, potentially Admin only) ---
// This handler currently fetches *all* pending leaves regardless of who reports to whom.
// Consider removing this route or repurposing it for Admin only.
// The manager-specific fetch logic is in the /api/manager/pending-requests handler we created.
// If you keep this route, you should apply the authorizeRole middleware here.
/*
const getAllPendingApprovalsHandler: RequestHandler< // ... (type annotations) ...
    {}, Leave[] | ErrorResponse, {}, {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
    const user_role_id = req.user?.role_id; // Get user role

    // --- Role Check (Admin Only) ---
    if (user_role_id !== ADMIN_ROLE_ID) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to view all pending approvals.' });
    }
    // --- End Role Check ---

    try {
        const pendingLeaves = await leaveRepository.find({
            where: { status: LeaveStatus.Pending }, // Filter by Pending status
            relations: ['user', 'leaveType'], // Eager load related User and LeaveType entities
            order: { applied_at: 'ASC' } // Order by application date (oldest first for review)
        });

        res.status(200).json(pendingLeaves);
        return;

    } catch (error) {
        console.error('Error fetching all pending leave requests:', error);
        res.status(500).json({ message: 'Internal server error fetching all pending leave requests' });
        return;
    }
};
// router.get('/pending-approvals', protect, authorizeRole(['Admin']), getAllPendingApprovalsHandler); // Example with middleware
*/
// --- PUT /api/leaves/:id/status - Update leave request status (Protected, Manager/Admin Only) ---
// Use RequestHandler type with explicit types for req params, req body, and res body
const updateLeaveStatusHandler = async (req, res) => {
    // Assuming req.user is populated by the 'protect' middleware
    const loggedInUser = req.user;
    const manager_user_id = loggedInUser?.user_id; // The user performing the action
    const manager_role_id = loggedInUser?.role_id; // The role of the user performing the action
    const leaveId = parseInt(req.params.id, 10);
    // Use the modified interface type here:
    const { status } = req.body; // Get the status sent by the manager ('Approved' or 'Rejected') from the request body
    const comments = req.body.comments || null; // Get comments from request body
    console.log(`--- User ${manager_user_id} (Role: ${manager_role_id}) attempting to update status of leave ${leaveId} via /api/leaves/status/:id ---`);
    // --- Role Check: Only Managers can use this specific handler logic ---
    // This handler is ONLY for Managers approving/rejecting direct reports via this endpoint.
    // Admins will use a separate endpoint (in adminRoutes.ts) or different logic flow if they use this endpoint.
    if (!loggedInUser || !manager_user_id || manager_role_id !== constants_1.MANAGER_ROLE_ID) {
        console.error(`User ${manager_user_id} with role ${manager_role_id} attempted to use Manager status update endpoint.`);
        res.status(403).json({ message: "Forbidden: Only managers can perform this action on this endpoint." });
        return;
    }
    // Validate incoming status from request body (redundant if using strict TypeScript + interface, but defensive)
    // The UpdateLeaveStatusRequestBody interface already restricts this to 'Approved' | 'Rejected'
    // if (status !== 'Approved' && status !== 'Rejected') { ... validation code from before ... }
    try {
        // Find the leave request. ONLY allow managers to update requests that are currently 'Pending'.
        // Eager load 'user' to check the submitting user's role and manager_id.
        // Eager load 'leaveType' for balance update logic.
        const leaveRequest = await leaveRepository.findOne({
            where: {
                leave_id: leaveId,
                status: Leave_1.LeaveStatus.Pending // Managers only process leaves initially 'Pending' from direct reports
            },
            relations: ["user", "leaveType"], // Ensure user and leaveType are loaded
        });
        // If leave request is not found, or is not in 'Pending' status (already processed)
        if (!leaveRequest) {
            console.warn(`Manager ${manager_user_id}: Leave request ${leaveId} not found or is not in 'Pending' status.`);
            res.status(404).json({ message: "Leave request not found or has already been processed." });
            return;
        }
        // --- Manager's Direct Report Authorization Check ---
        // Verify that the user who submitted this leave request actually reports to the logged-in manager.
        // This is a critical security check for a manager's approval endpoint.
        // Assuming your User entity has a 'manager_id' column which is the user_id of their manager.
        if (!leaveRequest.user || leaveRequest.user.manager_id !== manager_user_id) {
            console.warn(`Manager ${manager_user_id} attempted to process leave ${leaveId} submitted by user ${leaveRequest.user?.user_id || 'N/A'} who does not report to them.`);
            res.status(403).json({ message: "You are not authorized to approve/reject this leave request." });
            return;
        }
        // --- End Direct Report Authorization Check ---
        // --- Implement the 5-Day Multi-Level Approval Logic for Manager Approval ---
        const submittingUserRoleId = leaveRequest.user.role_id; // Role of the user who submitted the leave
        // Note: This handler is for Manager processing direct reports.
        // Call your local calculateWorkingDays function here, passing Date objects
        const leaveDuration = calculateWorkingDays(new Date(leaveRequest.start_date), new Date(leaveRequest.end_date)); // Use your LOCAL calculateWorkingDays
        console.log(`Manager ${manager_user_id}: Processing leave ${leaveId} (submitted by user role ${submittingUserRoleId}, duration ${leaveDuration} working days), Manager action: ${status}.`);
        let newStatus; // Variable to hold the determined new status
        if (status === 'Approved') {
            // The manager is APPROVING the request.
            // Check if it's from an Employee or Intern AND the duration is > 5 working days
            if ((submittingUserRoleId === constants_1.EMPLOYEE_ROLE_ID || submittingUserRoleId === constants_1.INTERN_ROLE_ID) &&
                leaveDuration > 5) {
                // It's a long leave from an Employee/Intern. Manager approval means it goes to Admin next.
                newStatus = Leave_1.LeaveStatus.Awaiting_Admin_Approval;
                console.log(`Leave ${leaveId} (long Employee/Intern leave) Manager approved -> status set to '${newStatus}'.`);
                // NO balance update here. Balance is updated only on final 'Approved' status by Admin.
            }
            else {
                // It's a short leave (<= 5 days) from an Employee/Intern.
                // Manager approval is the FINAL approval for these cases via this endpoint.
                newStatus = Leave_1.LeaveStatus.Approved;
                console.log(`Leave ${leaveId} (short Employee/Intern leave) Manager approved -> status set to '${newStatus}'.`);
                // --- Apply Leave Balance Logic here (as Manager approval is final for these cases) ---
                // Copy your existing logic to update the used_days in the LeaveBalance table if balance-based.
                // Use leaveRequest.user_id, leaveRequest.type_id, leaveRequest.start_date (for year), actualWorkingDaysOnLeave (which is leaveDuration here), leaveRequest.leaveType?.is_balance_based
                try {
                    const leaveType = leaveRequest.leaveType; // Already eager loaded
                    if (!leaveType) {
                        console.error(`Manager ${manager_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`);
                        // Log error, decide how to handle. For now, proceed without balance update.
                    }
                    else if (leaveType.requires_approval) {
                        const leaveYear = new Date(leaveRequest.start_date).getFullYear(); // Assuming balance is yearly
                        let userBalance = await leaveBalanceRepository.findOne({
                            where: { user_id: leaveRequest.user_id, type_id: leaveRequest.type_id, year: leaveYear }
                        });
                        if (userBalance) {
                            // Use the calculated working days for the leave duration
                            const actualWorkingDaysOnLeave = leaveDuration; // It's already calculated
                            // Convert Decimal strings to numbers before calculation
                            const currentUsedDays = parseFloat(userBalance.used_days);
                            // Deduct the working days from the balance
                            const updatedUsedDays = currentUsedDays + actualWorkingDaysOnLeave;
                            userBalance.used_days = updatedUsedDays.toFixed(2).toString(); // Update used days (store back as string)
                            await leaveBalanceRepository.save(userBalance); // Save updated balance
                            console.log(`Manager ${manager_user_id}: Updated leave balance for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Used days now: ${userBalance.used_days}`);
                        }
                        else {
                            console.error(`Manager ${manager_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`);
                            // Log error, decide how to handle. For now, proceed without balance update.
                        }
                    }
                    else {
                        console.log(`Manager ${manager_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`);
                    }
                }
                catch (balanceError) { // Explicitly type balanceError
                    console.error(`Manager ${manager_user_id}: Error during leave balance update for leave ${leaveId}:`, balanceError);
                    // Log error, decide how to handle (e.g., rollback status, alert admin).
                    // For now, log the error and allow leave approval to proceed.
                }
                // --- End Leave Balance Logic ---
            }
        }
        else if (status === 'Rejected') {
            // The manager is REJECTING the request. This is a final status.
            newStatus = Leave_1.LeaveStatus.Rejected;
            console.log(`Leave ${leaveId} rejected by Manager -> status set to '${newStatus}'.`);
            // No balance update needed for rejection
        }
        else {
            // Should not happen due to the interface type, but defensive
            console.error(`Manager ${manager_user_id}: Unexpected status '${status}' received for leave ${leaveId}.`);
            res.status(500).json({ message: "Internal server error: Unexpected input status." });
            return; // Exit the handler
        }
        // --- End 5-Day Multi-Level Approval Logic for Manager ---
        // Update the leave request object with the determined new status and processor details
        leaveRequest.status = newStatus; // Set the status based on the logic above
        leaveRequest.processed_by_id = manager_user_id; // Store the manager's user ID
        leaveRequest.processed_at = new Date(); // Record processing timestamp
        // --- Log Approval/Rejection Action ---
        // Log this action in the LeaveApproval table
        if (leaveApprovalRepository && manager_user_id) {
            try {
                const newApproval = new LeaveApproval_1.LeaveApproval();
                newApproval.leave_id = leaveRequest.leave_id; // Use the leave ID from the updated request
                newApproval.approver_id = manager_user_id; // The manager's user ID
                // Determine the action type for the log based on the NEW status
                if (newStatus === Leave_1.LeaveStatus.Awaiting_Admin_Approval) {
                    // Manager "approved" but it's pending Admin
                    newApproval.action = LeaveApproval_1.ApprovalAction.Approved; // Log Manager's action as Approved
                }
                else if (newStatus === Leave_1.LeaveStatus.Approved) {
                    // Manager's approval was final
                    newApproval.action = LeaveApproval_1.ApprovalAction.Approved; // Log Manager's action as Approved
                }
                else if (newStatus === Leave_1.LeaveStatus.Rejected) {
                    // Manager rejected
                    newApproval.action = LeaveApproval_1.ApprovalAction.Rejected; // Log Manager's action as Rejected
                }
                else {
                    // Should not happen with current logic, but defensive
                    console.warn(`Manager ${manager_user_id}: Unexpected new status '${newStatus}' for logging leave ${leaveId}.`);
                    // You might log it as a 'Reviewed' action if your enum supports it
                    // newApproval.action = ApprovalAction.Reviewed;
                }
                newApproval.comments = comments; // Include comments if provided
                await leaveApprovalRepository.save(newApproval);
                console.log(`Manager ${manager_user_id}: Action '${newApproval.action}' logged for leave ${leaveRequest.leave_id} by approver ${manager_user_id}.`);
            }
            catch (logError) {
                console.error(`Manager ${manager_user_id}: Error logging approval action for leave ${leaveId}:`, logError);
                // Log the error, but don't necessarily fail the status update itself
            }
        }
        else {
            console.warn(`Manager ${manager_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or manager_user_id missing.`);
        }
        // --- End Log Approval/Rejection Action ---
        // Save the leave request with the final determined status and processor details
        // This is the SINGLE save operation after all logic is determined.
        await leaveRepository.save(leaveRequest);
        console.log(`Leave request ${leaveId} final status after Manager processing: ${leaveRequest.status}.`);
        // Send success response back to the frontend
        res.status(200).json({
            message: `Leave request ${leaveId} status updated to ${leaveRequest.status}`,
            leaveId: leaveRequest.leave_id,
            newStatus: leaveRequest.status // Return the *actual* new status that was set
        });
        return; // Explicit return
    }
    catch (error) { // Explicitly type catch error
        console.error(`Manager ${manager_user_id}: Error processing leave request ID ${leaveId}:`, error);
        // More granular error handling can be added based on the type of error
        res.status(500).json({ message: "Internal server error processing leave request." });
        return; // Explicit return
    }
};
// Use ':id' parameter in the route path
// Consider applying authorizeRole middleware here for cleaner route definition
// router.put('/status/:id', protect, authorizeRole(['Manager', 'Admin']), updateLeaveStatusHandler); // Example with middleware
router.put("/status/:id", authMiddleware_1.default, updateLeaveStatusHandler); // Using inline role check for now
// TODO: Add other leave-related routes here later (e.g., Admin routes for managing types/balances)
// In src/routes/leaveRoutes.ts, add this code block
// --- PUT /api/leaves/:id/cancel - Cancel a leave request (Protected Route) ---
const cancelLeaveHandler = async (req, res) => {
    // Ensure the user is authenticated and has a user ID
    const userId = req.user?.user_id;
    if (!userId) {
        res.status(401).json({ message: "User not authenticated." });
        return;
    }
    const leaveId = parseInt(req.params.id, 10); // Get leave ID from URL // Basic validation for leave ID
    if (isNaN(leaveId)) {
        res.status(400).json({ message: "Invalid leave ID provided." });
        return;
    }
    try {
        // Find the leave request by ID
        const leaveRequest = await leaveRepository.findOne({
            where: { leave_id: leaveId }, // Optional: Load related user/type if needed for checks/logs // relations: ['user', 'leaveType']
        }); // Check if the leave request exists
        if (!leaveRequest) {
            res.status(404).json({ message: "Leave request not found." });
            return;
        } // --- Security Check: Ensure the user owns this leave request ---
        if (leaveRequest.user_id !== userId) {
            // Log this attempt for security monitoring
            console.warn(`User ${userId} attempted to cancel leave ID ${leaveId} which they do not own.`);
            res.status(403).json({
                message: "Forbidden: You can only cancel your own leave requests.",
            });
            return;
        } // --- Status Check: Ensure the leave is in Pending status ---
        if (leaveRequest.status !== Leave_1.LeaveStatus.Pending) {
            res.status(400).json({
                message: `Cannot cancel leave request with status '${leaveRequest.status}'. Only pending leaves can be cancelled.`,
            });
            return;
        } // --- Update Status to Cancelled ---
        const oldStatus = leaveRequest.status; // Should be 'Pending' based on check above
        leaveRequest.status = Leave_1.LeaveStatus.Cancelled; // Save the updated leave request
        const cancelledLeave = await leaveRepository.save(leaveRequest); // TODO: Add logic here if cancelling a PENDING leave should revert any 'reserved' balance // (You might implement balance reservation when applying later) // --- Log Cancellation Action (Optional but recommended) --- // Send success response
        // If you allow cancelling auto-approved leaves, you'd need balance reversion logic here too.
        // For now, cancelling from Pending doesn't impact used_days.
        // You could log this in the leave_approvals table with an 'Cancelled' action by the user themselves
        // Example (requires ApprovalAction enum update and LeaveApproval entity/repo):
        /*
             if (leaveApprovalRepository) {
                 const newApprovalLog = new LeaveApproval();
                 newApprovalLog.leave_id = cancelledLeave.leave_id;
                 newApprovalLog.approver_id = userId; // User who cancelled
                 newApprovalLog.action = ApprovalAction.Cancelled; // Assuming you add 'Cancelled' to ApprovalAction enum
                 newApprovalLog.comments = comments || 'Cancelled by employee'; // Add comments if needed
                 await leaveApprovalRepository.save(newApprovalLog);
                 console.log(`Cancellation action logged for leave ${cancelledLeave.leave_id} by user ${userId}`);
             }
            */
        res.status(200).json({
            message: `Leave request ${leaveId} cancelled successfully.`,
            leaveId: cancelledLeave.leave_id,
            newStatus: cancelledLeave.status,
        });
        return;
    }
    catch (error) {
        console.error(`Error cancelling leave request ${leaveId}:`, error);
        res
            .status(500)
            .json({ message: "Internal server error cancelling leave request" });
        return;
    }
};
// Register the new route using a PUT request with the leave ID parameter
router.put("/my/:id/cancel", authMiddleware_1.default, cancelLeaveHandler); // Note: Using '/my/:id/cancel' path under '/api/leaves' -> /api/leaves/my/:id/cancel
