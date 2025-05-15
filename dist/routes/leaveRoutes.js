"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// leave-app-backend-ts/src/routes/leaveRoutes.ts
const express_1 = __importDefault(require("express"));
const data_source_1 = require("../data-source");
const LeaveType_1 = require("../entity/LeaveType");
const LeaveBalance_1 = require("../entity/LeaveBalance");
const Leave_1 = require("../entity/Leave");
const User_1 = require("../entity/User");
const LeaveApproval_1 = require("../entity/LeaveApproval"); // <-- Uncommented
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
// Import the role middleware if you decide to use it here instead of inline check
// import { authorizeRole } from '../middleware/roleMiddleware';
const router = express_1.default.Router();
exports.router = router;
// --- Define Role IDs (Adjust these based on your 'roles' table) ---
// It's better to fetch these from the DB or configuration in a real app,
// but keeping them here for now as you had them.
const ADMIN_ROLE_ID = 1;
const EMPLOYEE_ROLE_ID = 2; // Full-time Employee
const MANAGER_ROLE_ID = 3;
const INTERN_ROLE_ID = 4;
// --- End Role IDs ---
// Get TypeORM Repositories
const leaveTypeRepository = data_source_1.AppDataSource.getRepository(LeaveType_1.LeaveType);
const leaveBalanceRepository = data_source_1.AppDataSource.getRepository(LeaveBalance_1.LeaveBalance);
const leaveRepository = data_source_1.AppDataSource.getRepository(Leave_1.Leave);
const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
const leaveApprovalRepository = data_source_1.AppDataSource.getRepository(LeaveApproval_1.LeaveApproval); // <-- Uncommented
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
    try {
        const leaveTypes = await leaveTypeRepository.find({
            order: { name: "ASC" },
        });
        res.status(200).json(leaveTypes);
        return;
    }
    catch (error) {
        console.error("Error fetching leave types:", error);
        res
            .status(500)
            .json({ message: "Internal server error fetching leave types" });
        return;
    }
};
router.get("/types", authMiddleware_1.default, getLeaveTypesHandler);
// --- POST /api/leaves - Apply for Leave (Protected Route) ---
const applyLeaveHandler = async (req, res) => {
    const user_id = req.user?.user_id;
    const user_role_id = req.user?.role_id; // Get the user's role ID
    if (user_id === undefined || user_role_id === undefined) {
        console.error("User ID or Role ID not found on request after protect middleware.");
        res
            .status(401)
            .json({ message: "Authentication failed or user info missing." });
        return;
    }
    const { type_id, start_date, end_date, reason } = req.body; // Basic Validation
    if (type_id === undefined || !start_date || !end_date || !reason) {
        res.status(400).json({
            message: "Leave type, start date, end date, and reason are required",
        });
        return;
    }
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    const currentYear = new Date().getFullYear();
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        res.status(400).json({ message: "Invalid date format" });
        return;
    }
    if (startDateObj > endDateObj) {
        res.status(400).json({ message: "Start date cannot be after end date" });
        return;
    } // Check if leave dates are in the current or future year (adjust logic if multi-year is allowed)
    if (startDateObj.getFullYear() < currentYear) {
        // Check only start date year for simplicity
        res.status(400).json({
            message: `Leave start date must be in the current or future year (${currentYear})`,
        });
        return;
    }
    if (endDateObj.getFullYear() > startDateObj.getFullYear() + 1) {
        // Prevent leave spanning too many years? Adjust logic
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
        const requestedDays = calculateCalendarLeaveDays(startDateObj, endDateObj); // Use calendar days for initial duration check
        if (requestedDays <= 0) {
            res
                .status(400)
                .json({ message: "Leave duration must be at least one day" });
            return;
        }
        console.log(`User ${user_id} applying for ${requestedDays} days of ${leaveTypeName} (Type ID: ${selectedTypeId})`); // --- NEW: Role-based Leave Type Check --- // Assuming Interns (ROLE_ID 4) can ONLY apply for Loss of Pay (need LeaveType ID for this) // Let's assume Loss of Pay has type_id 5 for this example - adjust if different
        const LOSS_OF_PAY_TYPE_ID = 5; // TODO: Define this based on your LeaveTypes data or fetch dynamically
        if (user_role_id === INTERN_ROLE_ID &&
            selectedTypeId !== LOSS_OF_PAY_TYPE_ID) {
            res
                .status(403)
                .json({ message: "Interns can only apply for Loss of Pay leave." });
            return;
        } // Add checks for other roles if certain leave types are restricted (e.g., only Managers can apply for Sabbatical) // --- End Role-based Leave Type Check --- // --- Modified: Check leave balance based on role and leave type --- // Only check balance if it's a balance-based leave type AND the user is NOT an Intern (or other roles that bypass balance checks)
        if (is_balance_based && user_role_id !== INTERN_ROLE_ID) {
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
            const availableDays = userBalance.total_days - userBalance.used_days; // Check against calendar days for initial application validation
            if (requestedDays > availableDays) {
                res.status(400).json({
                    message: `Insufficient balance for ${leaveTypeName}. Available: ${availableDays.toFixed(2)}, Requested: ${requestedDays.toFixed(2)}`,
                });
                return;
            }
            console.log(`Balance check passed for non-Intern. Available: ${availableDays.toFixed(2)}, Requested: ${requestedDays.toFixed(2)}`);
        }
        else if (is_balance_based && user_role_id === INTERN_ROLE_ID) {
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
            } // If auto-approved above, consider logging an immediate 'auto-approval' action in leave_approvals table? // For simplicity, let's handle all logging in the status update handler for now.
        } // --- End Modified Initial Status Determination ---
        const newLeave = new Leave_1.Leave();
        newLeave.user_id = user_id;
        newLeave.type_id = selectedTypeId;
        newLeave.start_date = startDateObj; // Store as Date objects
        newLeave.end_date = endDateObj; // Store as Date objects
        newLeave.reason = reason;
        newLeave.status = initialStatus;
        newLeave.required_approvals = requiredApprovals; // TODO: Add fields for submitted_by_id if different from user_id (e.g., HR submitting on behalf)
        const savedLeave = await leaveRepository.save(newLeave); // If auto-approved, immediately update balance and log approval? // Let's handle this in the status update handler by calling it internally // Or have a dedicated service function that saveLeave calls and then handles post-save logic // For now, just save and return success. Balance update happens via status change.
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
        res
            .status(500)
            .json({ message: "Internal server error during leave submission" });
        return;
    }
};
router.post("/", authMiddleware_1.default, applyLeaveHandler);
// --- GET /api/leaves/balance - Get authenticated user's leave balances (Protected Route) ---
// This route currently fetches stored balances (total_days, used_days).
// The frontend calculates available (Total - Used).
// This is generally fine. If you needed calculated available from backend,
// you'd calculate total_days - used_days before sending the response.
// ... (getUserLeaveBalancesHandler and router.get('/balance', protect, ...)) ...
// --- GET /api/leaves/my - Get authenticated user's leave requests (history) (Protected Route) ---
// ... (getUserLeaveHistoryHandler and router.get('/my', protect, ...)) ...
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
    // Role check is done inside the handler. Consider using authorizeRole middleware instead for consistency.
    const user_role_id = req.user?.role_id;
    const approver_id = req.user?.user_id; // Get the approver's user ID from the token
    const comments = req.body.comments || null; // Get comments from request body // Ensure the approver is authenticated and has an ID
    if (!approver_id) {
        res.status(401).json({ message: "Approver user ID not found on request." });
        return;
    }
    if (user_role_id !== MANAGER_ROLE_ID && user_role_id !== ADMIN_ROLE_ID) {
        res.status(403).json({
            message: "Forbidden: You do not have permission to update leave status.",
        });
        return;
    }
    const leaveId = parseInt(req.params.id, 10); // Get the leave ID from URL parameters
    const { status } = req.body; // Get the new status from the request body // Basic validation
    if (isNaN(leaveId)) {
        res.status(400).json({ message: "Invalid leave ID provided." });
        return;
    } // Validate the provided status against the LeaveStatus enum
    if (!Object.values(Leave_1.LeaveStatus).includes(status)) {
        res.status(400).json({
            message: `Invalid status provided. Must be one of: ${Object.values(Leave_1.LeaveStatus).join(", ")}`,
        });
        return;
    }
    try {
        // Find the leave request by ID
        // Use findOne to get a single entity
        // Load relations needed for logic (e.g., leaveType for is_balance_based)
        const leaveRequest = await leaveRepository.findOne({
            where: { leave_id: leaveId },
            relations: ["leaveType", "user"], // Eager load related entities if needed for logic
        });
        if (!leaveRequest) {
            res.status(404).json({ message: "Leave request not found." });
            return;
        } // --- Approval/Rejection Logic --- // TODO: Implement more complex approval logic here: // - Check current status (e.g., prevent updating status from Rejected back to Pending by a manager) // - Handle multi-level approvals if required_approvals > 1 (e.g., increment an approval count) // For now, a simple status update:
        const oldStatus = leaveRequest.status;
        leaveRequest.status = status;
        const updatedLeave = await leaveRepository.save(leaveRequest); // Save the updated leave request // --- Leave Balance Update Logic (Triggered ONLY on Approval/Revert of Balance-Based Leave) ---
        if (updatedLeave.leaveType.is_balance_based) {
            // Only proceed if it's balance-based
            const leaveDuration = calculateWorkingDays(updatedLeave.start_date, updatedLeave.end_date); // <-- USE NEW HELPER HERE // Logic for APPROVAL (Status changes TO Approved)
            if (oldStatus !== Leave_1.LeaveStatus.Approved &&
                updatedLeave.status === Leave_1.LeaveStatus.Approved) {
                console.log(`Leave request ${updatedLeave.leave_id} approved. Updating balance for user ${updatedLeave.user_id}, type ${updatedLeave.type_id}, year ${updatedLeave.start_date.getFullYear()}`);
                const userBalance = await leaveBalanceRepository.findOne({
                    where: {
                        user_id: updatedLeave.user_id,
                        type_id: updatedLeave.type_id,
                        year: updatedLeave.start_date.getFullYear(), // Balance is tied to the START date's year
                    },
                });
                if (userBalance) {
                    userBalance.used_days += leaveDuration; // <-- Add working days
                    await leaveBalanceRepository.save(userBalance);
                    console.log(`Balance updated for user ${userBalance.user_id}, type ${userBalance.type_id}, year ${userBalance.year}. New used_days: ${userBalance.used_days}`);
                }
                else {
                    console.error(`Warning: Leave balance not found for user ${updatedLeave.user_id}, type ${updatedLeave.type_id}, year ${updatedLeave.start_date.getFullYear()} after leave approval.`); // TODO: Implement error handling or logging for this scenario
                } // --- Log Approval Action --- // Log when status changes TO Approved
                if (leaveApprovalRepository && approver_id) {
                    const newApproval = new LeaveApproval_1.LeaveApproval();
                    newApproval.leave_id = updatedLeave.leave_id;
                    newApproval.approver_id = approver_id;
                    newApproval.action = LeaveApproval_1.ApprovalAction.Approved; // Action is Approved
                    newApproval.comments = comments;
                    await leaveApprovalRepository.save(newApproval);
                    console.log(`Approval action logged for leave ${updatedLeave.leave_id} by approver ${approver_id}`);
                }
                else {
                    console.warn(`Could not log approval action for leave ${updatedLeave.leave_id}. Repository or approver_id missing.`);
                } // --- End Log Approval Action ---
            } // Logic for REVERTING from Approved (e.g., Cancelled, Rejected after being Approved)
            else if (oldStatus === Leave_1.LeaveStatus.Approved &&
                updatedLeave.status !== Leave_1.LeaveStatus.Approved) {
                console.log(`Leave request ${updatedLeave.leave_id} status changed from Approved to ${updatedLeave.status}. Reverting balance for user ${updatedLeave.user_id}, type ${updatedLeave.type_id}, year ${updatedLeave.start_date.getFullYear()}`);
                const userBalance = await leaveBalanceRepository.findOne({
                    where: {
                        user_id: updatedLeave.user_id,
                        type_id: updatedLeave.type_id,
                        year: updatedLeave.start_date.getFullYear(),
                    },
                });
                if (userBalance) {
                    userBalance.used_days -= leaveDuration; // <-- Subtract working days // Ensure used_days doesn't go below zero
                    if (userBalance.used_days < 0)
                        userBalance.used_days = 0;
                    await leaveBalanceRepository.save(userBalance);
                    console.log(`Balance reverted for user ${userBalance.user_id}, type ${userBalance.type_id}, year ${userBalance.year}. New used_days: ${userBalance.used_days}`);
                }
                else {
                    console.error(`Warning: Leave balance not found for user ${updatedLeave.user_id}, type ${updatedLeave.type_id}, year ${updatedLeave.start_date.getFullYear()} when attempting to revert balance.`); // TODO: Implement error handling or logging for this scenario
                } /* // --- Log Revert Action (from Approved) --- // Log when status changes from Approved to something else // This is commented out as you might only want to log the initial decision. Uncomment if needed.
                if (leaveApprovalRepository && approver_id) {
                  const newApproval = new LeaveApproval();
                  newApproval.leave_id = updatedLeave.leave_id;
                  newApproval.approver_id = approver_id;
                  // Determine action type based on the new status
                  newApproval.action = (updatedLeave.status === LeaveStatus.Rejected) ? ApprovalAction.Rejected : ApprovalAction.Reviewed; // Log as Rejected or Reviewed (e.g., Cancelled by Admin/Manager)
                  newApproval.comments = comments;
                  await leaveApprovalRepository.save(newApproval);
                  console.log(`Revert action logged for leave ${updatedLeave.leave_id} by approver ${approver_id}`);
                } else {
                  console.warn(`Could not log revert action for leave ${updatedLeave.leave_id}. Repository or approver_id missing.`);
                }
                */ // --- End Log Revert Action ---
            } // TODO: Add logic for other status transitions if they impact balance (e.g., Pending to Cancelled by employee)
        }
        else {
            console.log(`Leave type ${updatedLeave.leaveType.name} is not balance-based. Skipping balance update logic.`);
        } // --- End Leave Balance Update Logic --- // --- Log Other Status Changes (e.g., Pending to Rejected or Pending to Cancelled by Manager/Admin) ---
        // Log rejection from Pending or cancellation from Pending *by Manager/Admin*
        // Note: Employee initiated cancellation from Pending would need different logic/endpoint
        if (oldStatus === Leave_1.LeaveStatus.Pending &&
            (updatedLeave.status === Leave_1.LeaveStatus.Rejected ||
                updatedLeave.status === Leave_1.LeaveStatus.Cancelled)) {
            console.log(`Leave request ${updatedLeave.leave_id} status changed from ${oldStatus} to ${updatedLeave.status}. Logging action.`);
            // Only log if it's a Manager or Admin performing the action
            if ((user_role_id === MANAGER_ROLE_ID || user_role_id === ADMIN_ROLE_ID) &&
                leaveApprovalRepository &&
                approver_id) {
                const newApproval = new LeaveApproval_1.LeaveApproval();
                newApproval.leave_id = updatedLeave.leave_id;
                newApproval.approver_id = approver_id;
                // Determine action type: Rejected or Reviewed (e.g., Cancelled)
                newApproval.action =
                    updatedLeave.status === Leave_1.LeaveStatus.Rejected
                        ? LeaveApproval_1.ApprovalAction.Rejected
                        : LeaveApproval_1.ApprovalAction.Reviewed; // Use Reviewed or add Cancelled to Enum
                newApproval.comments = comments;
                await leaveApprovalRepository.save(newApproval);
                console.log(`${updatedLeave.status} action logged for leave ${updatedLeave.leave_id} by approver ${approver_id}`);
            }
            else {
                console.warn(`Could not log ${updatedLeave.status} action for leave ${updatedLeave.leave_id}. Approver role/repo/id missing.`);
            }
        } // Respond with success message and the updated status
        res.status(200).json({
            message: `Leave request ${leaveId} status updated to ${updatedLeave.status}`,
            leaveId: updatedLeave.leave_id,
            newStatus: updatedLeave.status,
        });
        return;
    }
    catch (error) {
        console.error(`Error updating leave request ${leaveId} status:`, error);
        res
            .status(500)
            .json({ message: "Internal server error updating leave request status" });
        return;
    }
};
// Use ':id' parameter in the route path
// Consider applying authorizeRole middleware here for cleaner route definition
// router.put('/status/:id', protect, authorizeRole(['Manager', 'Admin']), updateLeaveStatusHandler); // Example with middleware
router.put("/status/:id", authMiddleware_1.default, updateLeaveStatusHandler); // Using inline role check for now
