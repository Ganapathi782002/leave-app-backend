import express, { RequestHandler } from "express";
import { Brackets, In } from "typeorm";

import { AppDataSource } from "../data-source";
import { LeaveType } from "../entity/LeaveType";
import { LeaveBalance } from "../entity/LeaveBalance";
import { Leave, LeaveStatus } from "../entity/Leave";
import { User } from "../entity/User";
import { LeaveApproval, ApprovalAction } from "../entity/LeaveApproval";
import {
  roleInitialBalances,
  ADMIN_ROLE_ID,
  EMPLOYEE_ROLE_ID,
  MANAGER_ROLE_ID,
  INTERN_ROLE_ID,
} from "../constants";
import moment from 'moment';
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";
// Import the role middleware if you decide to use it here instead of inline check
// import { authorizeRole } from '../middleware/roleMiddleware';

const router: express.Router = express.Router();

// Get TypeORM Repositories
const leaveTypeRepository = AppDataSource.getRepository(LeaveType);
const leaveBalanceRepository = AppDataSource.getRepository(LeaveBalance);
const leaveRepository = AppDataSource.getRepository(Leave);
const userRepository = AppDataSource.getRepository(User);
const leaveApprovalRepository = AppDataSource.getRepository(LeaveApproval);

const calculateCalendarLeaveDays = (startDate: Date, endDate: Date): number => {
  // Accept Date objects
  if (startDate > endDate) {
    return 0;
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffInMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffInMs / msPerDay) + 1; // Add 1 to include the end day
};

const areDateRangesOverlapping = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date
): boolean => {
  // Overlap exists if the first range starts before the second range ends
  // AND the first range ends after the second range starts.
  return start1 <= end2 && end1 >= start2;
};

const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
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

// Interfaces for request and response bodies
interface ApplyLeaveRequestBody {
  type_id: number;
  start_date: string; // ISO string format
  end_date: string; // ISO string format
  reason: string;
}

interface ApplyLeaveSuccessResponse {
  message: string;
  leaveId: number;
  initialStatus: LeaveStatus;
  requiredApprovals: number;
}

interface UpdateLeaveStatusRequestBody {
  status: "Approved" | "Rejected"; // The new status (Approved, Rejected, Cancelled)
  comments?: string; // Add optional comments for approval/rejection
}

interface UpdateLeaveStatusSuccessResponse {
  message: string;
  leaveId: number;
  newStatus: LeaveStatus;
}

interface LeaveDetailsResponse extends Leave {}

interface ErrorResponse {
  message: string;
}

interface CalendarEventResponse {
  leave_id: number;
  title: string; // user name for calendar display
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  userName: string;
  userEmail: string;
  leaveTypeName: string;
  status: string;
}

const getLeaveTypesHandler: RequestHandler<
  {}, // Req Params
  LeaveType[] | ErrorResponse,
  {}, 
  {} 
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.user_id; // Get user ID from token
  const userRoleId = req.user?.role_id; // Get user Role ID from token

  // console.log(
  //   `--- Inside getLeaveTypesHandler for User ID: ${userId}, Role ID: ${userRoleId} ---`
  // ); // Log handler entry // Defensive check if user or role info is missing after protect middleware

  if (!userId || userRoleId === undefined) {
    console.warn(
      `getLeaveTypesHandler: Authentication failed or role missing. User ID: ${userId}, Role ID: ${userRoleId}`
    ); // Log auth failure
    res
      .status(401)
      .json({ message: "User not authenticated or role missing." });
    return;
  }

  try {
    // Fetch ALL active/relevant leave types from the database
    // Consider adding a filter here later if some types are inactive or soft-deleted
    const allLeaveTypes = await leaveTypeRepository.find({
      order: { name: "ASC" },
    });
    // console.log(
    //   "getLeaveTypesHandler: Fetched all leave types:",
    //   allLeaveTypes.map((lt) => ({ id: lt.type_id, name: lt.name }))
    // ); // Log all fetched types with ID/Name

    let applyableLeaveTypes: LeaveType[] = [];

    // Determine applyable leave types based on user role
    // For non-Admin roles, filter based on the roleInitialBalances mapping
    if (userRoleId !== ADMIN_ROLE_ID) {
      // Use the IMPORTED roleInitialBalances mapping here
      const rulesForRole = roleInitialBalances[userRoleId];
      // console.log(
      //   `getLeaveTypesHandler: Rules found in roleInitialBalances for Role ID ${userRoleId}:`,
      //   rulesForRole
      // ); // Log rules for the role

      // Get the list of leave type names allowed for this role based on the mapping
      const allowedLeaveTypeNames = (rulesForRole || []).map(
        (rule) => rule.leaveTypeName
      );
      // console.log(
      //   `getLeaveTypesHandler: Allowed leave type names derived from rules for Role ID ${userRoleId}:`,
      //   allowedLeaveTypeNames
      // ); // Log allowed names

      // Filter the fetched leave types to include only those whose name is in the allowed list
      applyableLeaveTypes = allLeaveTypes.filter((type) => {
        const isApplyable = allowedLeaveTypeNames.includes(type.name);
        // console.log(`getLeaveTypesHandler: Checking type "${type.name}" (ID: ${type.type_id}) - Is Applyable for Role ${userRoleId}? ${isApplyable}`); // Detailed filtering decision log (can be noisy)
        return isApplyable;
      });

      // console.log(
      //   `getLeaveTypesHandler: Filtered applyable leave types for Role ID ${userRoleId}:`,
      //   applyableLeaveTypes.map((lt) => ({ id: lt.type_id, name: lt.name }))
      // ); // Log filtered types
    } else {
      // For Admin role, they typically don't apply for leave this way.
      // Returning an empty list is suitable for the 'Apply Leave' page for Admins.
      applyableLeaveTypes = [];
      // console.log(
      //   `getLeaveTypesHandler: User is Admin (Role ID ${userRoleId}). Returning empty list for applyable types.`
      // ); // Log Admin case
    } // Send the filtered list of applyable leave types back

    res.status(200).json(applyableLeaveTypes);
    // console.log(
    //   `getLeaveTypesHandler: Sent ${applyableLeaveTypes.length} applyable leave types.`
    // ); // Log count of sent types
  } catch (error) {
    console.error(
      `getLeaveTypesHandler: Error fetching leave types for user ${userId}:`,
      error
    ); // Log any errors
    res
      .status(500)
      .json({ message: "Internal server error fetching leave types" });
  }
};

router.get("/types", protect, getLeaveTypesHandler);

const applyLeaveHandler: RequestHandler<
  {}, // Req Params
  ApplyLeaveSuccessResponse | ErrorResponse,
  ApplyLeaveRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const user_id = req.user?.user_id;
  const user_role_id = req.user?.role_id;

  if (user_id === undefined || user_role_id === undefined) {
    console.error(
      "User ID or Role ID not found on request after protect middleware."
    );
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
    console.warn(
      `User ${user_id}: Attempted to apply for leave with a past start date: ${start_date}`
    );
    res
      .status(400)
      .json({ message: "Leave start date cannot be in the past." });
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
      message:
        "Leave duration cannot span across multiple years (excluding next year)",
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

    const {
      type_id: selectedTypeId,
      name: leaveTypeName,
      requires_approval,
      is_balance_based,
    } = leaveTypeDetails;

    const requestedDays = calculateCalendarLeaveDays(startDateObj, endDateObj);
    if (requestedDays <= 0) {
      res
        .status(400)
        .json({ message: "Leave duration must be at least one day" });
      return;
    }
    // console.log(
    //   `User ${user_id} applying for ${requestedDays} calendar days of ${leaveTypeName} (Type ID: ${selectedTypeId})`
    // );

    // Find any existing Pending or Approved leaves for this user
    const existingLeaves = await leaveRepository.find({
      where: {
        user_id: user_id,
        status: In(["Pending", "Approved"] as LeaveStatus[]), // <-- Use In operator here
      },
    });

    // Check for overlap with each existing leave
    for (const existingLeave of existingLeaves) {
      const existingStartDate = new Date(existingLeave.start_date);
      const existingEndDate = new Date(existingLeave.end_date);

      if (
        isNaN(existingStartDate.getTime()) ||
        isNaN(existingEndDate.getTime())
      ) {
        console.warn(
          `Skipping overlap check for invalid existing leave dates (ID: ${existingLeave.leave_id})`
        );
        continue; // Skip this existing leave if its dates are invalid
      }

      if (
        areDateRangesOverlapping(
          startDateObj,
          endDateObj,
          existingStartDate,
          existingEndDate
        )
      ) {
        // Overlap found! Return an error response
        // console.log(
        //   `Overlap detected for user ${user_id}: New leave ${startDateObj.toISOString()} to ${endDateObj.toISOString()} overlaps with existing leave ${existingStartDate.toISOString()} to ${existingEndDate.toISOString()} (ID: ${
        //     existingLeave.leave_id
        //   })`
        // );
        res.status(400).json({
          message: `Your requested leave dates (${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}) overlap with an existing leave request (Status: ${
            existingLeave.status
          }, Dates: ${existingStartDate.toLocaleDateString()} - ${existingEndDate.toLocaleDateString()}).`,
        });
        return; // Stop processing and return the error
      }
    }
    // console.log(
    //   `No overlap detected for user ${user_id}. Proceeding with application.`
    // );

    const allowedLeaveTypeNamesForRole = (
      roleInitialBalances[user_role_id] || []
    ).map((rule) => rule.leaveTypeName);
    const leaveTypeIsApplyableForRole =
      allowedLeaveTypeNamesForRole.includes(leaveTypeName);

    if (!leaveTypeIsApplyableForRole) {
      console.warn(
        `User ${user_id} (Role ID: ${user_role_id}) attempted to apply for '${leaveTypeName}' (Type ID: ${selectedTypeId}), which is not allowed for this role.`
      );
      res
        .status(403)
        .json({ message: `You cannot apply for '${leaveTypeName}' leave.` });
      return;
    }
    // console.log(
    //   `User ${user_id} (Role ID: ${user_role_id}) applying for '${leaveTypeName}' (Type ID: ${selectedTypeId}). This type is allowed for this role.`
    // );

    // Add checks for other roles if certain leave types are restricted (e.g., only Managers can apply for Sabbatical) // --- End Role-based Leave Type Check --- // --- Modified: Check leave balance based on role and leave type --- // Only check balance if it's a balance-based leave type AND the user is NOT an Intern (or other roles that bypass balance checks)
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

      // IMPORTANT: Parse strings to numbers for calculation
      const availableDays =
        parseFloat(userBalance.total_days as string) -
        parseFloat(userBalance.used_days as string);

      if (requestedDays > availableDays) {
        res.status(400).json({
          message: `Insufficient balance for ${leaveTypeName}. Available: ${availableDays.toFixed(
            2
          )}, Requested: ${requestedDays.toFixed(2)}`,
        });
        return;
      }
      // console.log(
      //   `Balance check passed for non-Intern. Available: ${availableDays.toFixed(
      //     2
      //   )}, Requested: ${requestedDays.toFixed(2)}`
      // );
    } else if (is_balance_based && user_role_id === INTERN_ROLE_ID) {
      // Interns should not be applying for balance-based leave types other than LoP (handled by the check above)
      // If they somehow reach here trying to apply for balance-based leave, it's an error
      res.status(403).json({
        message: `Interns cannot apply for balance-based leave types.`,
      });
      return;
    } else if (!is_balance_based) {
      // console.log(
      //   `${leaveTypeName} is not balance-based. Skipping balance check.`
      // ); // Loss of Pay (if it's not balance-based) will fall here and bypass balance check, which is correct for Interns.
    }

    let initialStatus: LeaveStatus = LeaveStatus.Pending;
    let requiredApprovals: number = 1; // Default to 1 if requires_approval is true and no specific rule matches

    if (!requires_approval) {
      initialStatus = LeaveStatus.Approved; // Auto-approve if leave type doesn't require approval (like Emergency Leave)
      requiredApprovals = 0; // 0 approvals needed if auto-approved
      // console.log(
      //   `${leaveTypeName} does not require approval. Setting status to Approved.`
      // );
    } else {
      const workingDaysForApprovalRule = calculateWorkingDays(
        startDateObj,
        endDateObj
      ); // Use working days for this rule example
      if (workingDaysForApprovalRule > 5) {
        requiredApprovals = 2;
        // console.log(
        //   `Leave duration > 5 working days (${workingDaysForApprovalRule}) and requires approval. Setting required approvals to 2.`
        // );
      } else {
        requiredApprovals = 1;
        // console.log(
        //   `Leave duration <= 5 working days (${workingDaysForApprovalRule}) and requires approval. Setting required approvals to 1.`
        // );
      }
    }
    const newLeave = new Leave();
    newLeave.user_id = user_id;
    newLeave.type_id = selectedTypeId;
    newLeave.start_date = startDateObj; // Store as Date objects
    newLeave.end_date = endDateObj; // Store as Date objects
    newLeave.reason = reason;
    newLeave.status = initialStatus;
    newLeave.required_approvals = requiredApprovals;
    const savedLeave = await leaveRepository.save(newLeave); // If auto-approved, immediately update balance and log approval?

    res.status(201).json({
      message: "Leave request submitted successfully",
      leaveId: savedLeave.leave_id,
      initialStatus: savedLeave.status,
      requiredApprovals: savedLeave.required_approvals,
    });
    return;
  } catch (error: unknown) {
    console.error("Error submitting leave request:", error);
    let errorMessage = "An unexpected error occurred during leave submission.";
    if (error instanceof Error) {
      // Use the error message from the Error object
      errorMessage = error.message;
    } else if (typeof error === "string") {
      // Handle cases where the thrown error is a string
      errorMessage = error;
    } // Provide a more user-friendly error message if it's a known issue (like overlap validation error)
    res.status(500).json({
      message: errorMessage || "Internal server error during leave submission",
    }); // Use error.message for validation errors
    return;
  }
};

router.post("/", protect, applyLeaveHandler);

const getUserLeaveBalancesHandler: RequestHandler<
  {},
  any | ErrorResponse, // Res Body (replace 'any' with a specific interface for balances later)
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
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
  } catch (error) {
    console.error("Error fetching user leave balances:", error);
    res
      .status(500)
      .json({ message: "Internal server error fetching leave balances" });
    return;
  }
};

router.get("/balance", protect, getUserLeaveBalancesHandler);

const getUserLeaveHistoryHandler: RequestHandler<
  {}, // Req Params
  any | ErrorResponse, // Res Body (replace 'any' with a specific interface for leaves later)
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
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
  } catch (error) {
    console.error("Error fetching user leave history:", error);
    res
      .status(500)
      .json({ message: "Internal server error fetching leave history" });
    return;
  }
};

router.get("/my", protect, getUserLeaveHistoryHandler);

const updateLeaveStatusHandler: RequestHandler<
  { id: string }, // Req Params (expecting leave ID in the URL)
  UpdateLeaveStatusSuccessResponse | ErrorResponse,
  UpdateLeaveStatusRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  // Use AuthenticatedRequest type if available

  // Assuming req.user is populated by the 'protect' middleware
  const loggedInUser = req.user;
  const manager_user_id = loggedInUser?.user_id; // The user performing the action
  const manager_role_id = loggedInUser?.role_id; // The role of the user performing the action

  const leaveId = parseInt(req.params.id, 10);
  // Use the modified interface type here:
  const { status } = req.body as UpdateLeaveStatusRequestBody; // Get the status sent by the manager ('Approved' or 'Rejected') from the request body
  const comments = req.body.comments || null; // Get comments from request body

  // console.log(
  //   `--- User ${manager_user_id} (Role: ${manager_role_id}) attempting to update status of leave ${leaveId} via /api/leaves/status/:id ---`
  // );
  if (
    !loggedInUser ||
    !manager_user_id ||
    manager_role_id !== MANAGER_ROLE_ID
  ) {
    console.error(
      `User ${manager_user_id} with role ${manager_role_id} attempted to use Manager status update endpoint.`
    );
    res
      .status(403)
      .json({
        message:
          "Forbidden: Only managers can perform this action on this endpoint.",
      });
    return;
  }

  try {
    const leaveRequest = await leaveRepository.findOne({
      where: {
        leave_id: leaveId,
        status: LeaveStatus.Pending, // Managers only process leaves initially 'Pending' from direct reports
      },
      relations: ["user", "leaveType"], // Ensure user and leaveType are loaded
    });

    // If leave request is not found, or is not in 'Pending' status (already processed)
    if (!leaveRequest) {
      console.warn(
        `Manager ${manager_user_id}: Leave request ${leaveId} not found or is not in 'Pending' status.`
      );
      res
        .status(404)
        .json({
          message: "Leave request not found or has already been processed.",
        });
      return;
    }
    if (
      !leaveRequest.user ||
      leaveRequest.user.manager_id !== manager_user_id
    ) {
      console.warn(
        `Manager ${manager_user_id} attempted to process leave ${leaveId} submitted by user ${
          leaveRequest.user?.user_id || "N/A"
        } who does not report to them.`
      );
      res
        .status(403)
        .json({
          message:
            "You are not authorized to approve/reject this leave request.",
        });
      return;
    }

    // --- Implement the 5-Day Multi-Level Approval Logic for Manager Approval ---
    const submittingUserRoleId = leaveRequest.user.role_id; // Role of the user who submitted the leave
    const leaveDuration = calculateWorkingDays(
      new Date(leaveRequest.start_date),
      new Date(leaveRequest.end_date)
    ); // Use your LOCAL calculateWorkingDays

    // console.log(
    //   `Manager ${manager_user_id}: Processing leave ${leaveId} (submitted by user role ${submittingUserRoleId}, duration ${leaveDuration} working days), Manager action: ${status}.`
    // );

    let newStatus: LeaveStatus; // Variable to hold the determined new status

    if (status === "Approved") {
      // The manager is APPROVING the request.
      // Check if it's from an Employee or Intern AND the duration is > 5 working days
      if (
        (submittingUserRoleId === EMPLOYEE_ROLE_ID ||
          submittingUserRoleId === INTERN_ROLE_ID) &&
        leaveDuration > 5
      ) {
        // It's a long leave from an Employee/Intern. Manager approval means it goes to Admin next.
        newStatus = LeaveStatus.Awaiting_Admin_Approval;
        // console.log(
        //   `Leave ${leaveId} (long Employee/Intern leave) Manager approved -> status set to '${newStatus}'.`
        // );

        // NO balance update here. Balance is updated only on final 'Approved' status by Admin.
      } else {
        // It's a short leave (<= 5 days) from an Employee/Intern.
        // Manager approval is the FINAL approval for these cases via this endpoint.
        newStatus = LeaveStatus.Approved;
        // console.log(
        //   `Leave ${leaveId} (short Employee/Intern leave) Manager approved -> status set to '${newStatus}'.`
        // );

        // --- Apply Leave Balance Logic here (as Manager approval is final for these cases) ---
        try {
          const leaveType = leaveRequest.leaveType; // Already eager loaded

          if (!leaveType) {
            console.error(
              `Manager ${manager_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`
            );
            // Log error, decide how to handle. For now, proceed without balance update.
          } else if (leaveType.requires_approval) {
            const leaveYear = new Date(leaveRequest.start_date).getFullYear(); // Assuming balance is yearly

            let userBalance = await leaveBalanceRepository.findOne({
              where: {
                user_id: leaveRequest.user_id,
                type_id: leaveRequest.type_id,
                year: leaveYear,
              },
            });

            if (userBalance) {
              // Use the calculated working days for the leave duration
              const actualWorkingDaysOnLeave = leaveDuration; // It's already calculated

              // Convert Decimal strings to numbers before calculation
              const currentUsedDays = parseFloat(userBalance.used_days as any);

              // Deduct the working days from the balance
              const updatedUsedDays =
                currentUsedDays + actualWorkingDaysOnLeave;

              userBalance.used_days = updatedUsedDays.toFixed(2).toString(); // Update used days (store back as string)

              await leaveBalanceRepository.save(userBalance); // Save updated balance
              // console.log(
              //   `Manager ${manager_user_id}: Updated leave balance for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Used days now: ${userBalance.used_days}`
              // );
            } else {
              console.error(
                `Manager ${manager_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`
              );
              // Log error, decide how to handle. For now, proceed without balance update.
            }
          } else {
            // console.log(
            //   `Manager ${manager_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`
            // );
          }
        } catch (balanceError: any) {
          // Explicitly type balanceError
          console.error(
            `Manager ${manager_user_id}: Error during leave balance update for leave ${leaveId}:`,
            balanceError
          );
          // Log error, decide how to handle (e.g., rollback status, alert admin).
          // For now, log the error and allow leave approval to proceed.
        }
        // --- End Leave Balance Logic ---
      }
    } else if (status === "Rejected") {
      // The manager is REJECTING the request. This is a final status.
      newStatus = LeaveStatus.Rejected;
      // console.log(
      //   `Leave ${leaveId} rejected by Manager -> status set to '${newStatus}'.`
      // );
      // No balance update needed for rejection
    } else {
      // Should not happen due to the interface type, but defensive
      console.error(
        `Manager ${manager_user_id}: Unexpected status '${status}' received for leave ${leaveId}.`
      );
      res
        .status(500)
        .json({ message: "Internal server error: Unexpected input status." });
      return; // Exit the handler
    }
    // --- End 5-Day Multi-Level Approval Logic for Manager ---

    // Update the leave request object with the determined new status and processor details
    leaveRequest.status = newStatus; // Set the status based on the logic above
    leaveRequest.processed_by_id = manager_user_id; // Store the manager's user ID
    leaveRequest.processed_at = new Date(); // Record processing timestamp

    if (leaveApprovalRepository && manager_user_id) {
      try {
        const newApproval = new LeaveApproval();
        newApproval.leave_id = leaveRequest.leave_id; // Use the leave ID from the updated request
        newApproval.approver_id = manager_user_id; // The manager's user ID
        // Determine the action type for the log based on the NEW status
        if (newStatus === LeaveStatus.Awaiting_Admin_Approval) {
          // Manager "approved" but it's pending Admin
          newApproval.action = ApprovalAction.Approved; // Log Manager's action as Approved
        } else if (newStatus === LeaveStatus.Approved) {
          // Manager's approval was final
          newApproval.action = ApprovalAction.Approved; // Log Manager's action as Approved
        } else if (newStatus === LeaveStatus.Rejected) {
          // Manager rejected
          newApproval.action = ApprovalAction.Rejected; // Log Manager's action as Rejected
        } else {
          // Should not happen with current logic, but defensive
          console.warn(
            `Manager ${manager_user_id}: Unexpected new status '${newStatus}' for logging leave ${leaveId}.`
          );
          // You might log it as a 'Reviewed' action if your enum supports it
          // newApproval.action = ApprovalAction.Reviewed;
        }
        newApproval.comments = comments; // Include comments if provided

        await leaveApprovalRepository.save(newApproval);
        // console.log(
        //   `Manager ${manager_user_id}: Action '${newApproval.action}' logged for leave ${leaveRequest.leave_id} by approver ${manager_user_id}.`
        // );
      } catch (logError) {
        console.error(
          `Manager ${manager_user_id}: Error logging approval action for leave ${leaveId}:`,
          logError
        );
        // Log the error, but don't necessarily fail the status update itself
      }
    } else {
      console.warn(
        `Manager ${manager_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or manager_user_id missing.`
      );
    }
    await leaveRepository.save(leaveRequest);

    // console.log(
    //   `Leave request ${leaveId} final status after Manager processing: ${leaveRequest.status}.`
    // );

    // Send success response back to the frontend
    res.status(200).json({
      message: `Leave request ${leaveId} status updated to ${leaveRequest.status}`,
      leaveId: leaveRequest.leave_id,
      newStatus: leaveRequest.status, // Return the *actual* new status that was set
    });
    return; // Explicit return
  } catch (error: any) {
    // Explicitly type catch error
    console.error(
      `Manager ${manager_user_id}: Error processing leave request ID ${leaveId}:`,
      error
    );
    // More granular error handling can be added based on the type of error
    res
      .status(500)
      .json({ message: "Internal server error processing leave request." });
    return; // Explicit return
  }
};

router.put("/status/:id", protect, updateLeaveStatusHandler); // Using inline role check for now

const cancelLeaveHandler: RequestHandler<
  { id: string }, // Expect leave ID in URL params
  UpdateLeaveStatusSuccessResponse | ErrorResponse, // Response body
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
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
      console.warn(
        `User ${userId} attempted to cancel leave ID ${leaveId} which they do not own.`
      );
      res.status(403).json({
        message: "Forbidden: You can only cancel your own leave requests.",
      });
      return;
    } // --- Status Check: Ensure the leave is in Pending status ---

    if (leaveRequest.status !== LeaveStatus.Pending) {
      res.status(400).json({
        message: `Cannot cancel leave request with status '${leaveRequest.status}'. Only pending leaves can be cancelled.`,
      });
      return;
    } // --- Update Status to Cancelled ---

    const oldStatus = leaveRequest.status; // Should be 'Pending' based on check above
    leaveRequest.status = LeaveStatus.Cancelled; // Save the updated leave request

    const cancelledLeave = await leaveRepository.save(leaveRequest);

    res.status(200).json({
      message: `Leave request ${leaveId} cancelled successfully.`,
      leaveId: cancelledLeave.leave_id,
      newStatus: cancelledLeave.status,
    });
    return;
  } catch (error) {
    console.error(`Error cancelling leave request ${leaveId}:`, error);
    res
      .status(500)
      .json({ message: "Internal server error cancelling leave request" });
    return;
  }
};

// Register the new route using a PUT request with the leave ID parameter
router.put("/my/:id/cancel", protect, cancelLeaveHandler);

const getLeaveAvailabilityHandler: RequestHandler<
    {}, // Req Params
    CalendarEventResponse[] | ErrorResponse,
    {},
    {} 
> = async (req: AuthenticatedRequest, res): Promise<void> => {
    const user = req.user;

    if (!user) {
        res.status(401).json({ message: "Unauthorized: User not authenticated." });
        return;
    }

    try {
        const leaveRepository = AppDataSource.getRepository(Leave);
        const userRepository = AppDataSource.getRepository(User);

        // Start with the base query builder and the initial status filter
        let queryBuilder = leaveRepository
            .createQueryBuilder("leave")
            .leftJoinAndSelect("leave.user", "user")
            .leftJoinAndSelect("leave.leaveType", "leaveType")
            .select([
                "leave.leave_id",
                "leave.start_date",
                "leave.end_date",
                "leave.status",
                "user.user_id",
                "user.name",
                "user.email",
                "leaveType.name",
            ])
            .where("leave.status = :statusApproved", { statusApproved: LeaveStatus.Approved }); // Initial WHERE clause with named parameter

        // Role-based filtering
        if (user.role_id === ADMIN_ROLE_ID) {
            // No additional WHERE clause for admin, they see all approved leaves
        } else if (user.role_id === MANAGER_ROLE_ID) {
            // Managers view leaves of their direct reports AND their own leaves
            queryBuilder.andWhere(new Brackets(qb => {
                qb.where("user.manager_id = :managerId", { managerId: user.user_id }) // Direct reports
                  .orWhere("user.user_id = :currentUserId", { currentUserId: user.user_id }); // Manager's own leaves
            }));
        } else if (user.role_id === EMPLOYEE_ROLE_ID || user.role_id === INTERN_ROLE_ID) {
            console.log(`Backend: Calendar Request by User ID: ${user.user_id}, Role ID: ${user.role_id}`);

            const currentUserDetails = await userRepository.findOne({
                where: { user_id: user.user_id },
                select: ["user_id", "manager_id"], // Only select user_id and manager_id for efficiency
            });

            console.log(`Backend: Retrieved currentUserDetails for ${user.user_id}:`, currentUserDetails);

            if (!currentUserDetails) {
                console.warn(`User ${user.user_id} not found in DB for calendar availability check.`);
                res.status(404).json({ message: "Current user details not found." });
                return;
            }

            queryBuilder.andWhere(new Brackets(qb => {
                // Condition 1: Current user's own leaves
                qb.where("user.user_id = :currentUserId", { currentUserId: user.user_id });

                // Condition 2: Leaves of their manager
                if (currentUserDetails.manager_id) {
                    qb.orWhere("user.user_id = :managerOfCurrentUser", { managerOfCurrentUser: currentUserDetails.manager_id });
                }

                // Condition 3: Leaves of their direct teammates (peers under the same manager, excluding themselves)
                if (currentUserDetails.manager_id) {
                    qb.orWhere("(user.manager_id = :sameManagerId AND user.user_id != :excludeSelfId)", {
                        sameManagerId: currentUserDetails.manager_id,
                        excludeSelfId: user.user_id,
                    });
                }
            }));

        } else {
            res.status(403).json({ message: "Forbidden: Your role does not permit viewing this calendar." });
            return;
        }

        const rawLeaveEvents = await queryBuilder.getRawMany();

        // ... (rest of the code for formatting and sending response, unchanged from previous version) ...
        const formattedEvents: CalendarEventResponse[] = rawLeaveEvents.map((row: any) => {
            console.log(`Backend Formatting Log - Original row.leave_start_date: ${row.leave_start_date}`);
            console.log(`Backend Formatting Log - Original row.leave_end_date: ${row.leave_end_date}`);

            const startDateFormatted = row.leave_start_date ? moment(row.leave_start_date).format('YYYY-MM-DD') : '';
            const endDateFormatted = row.leave_end_date ? moment(row.leave_end_date).format('YYYY-MM-DD') : '';

            console.log(`Backend Formatting Log - Formatted Start Date: ${startDateFormatted}`);
            console.log(`Backend Formatting Log - Formatted End Date: ${endDateFormatted}`);

            return {
                leave_id: row.leave_leave_id,
                title: row.user_name,
                start: startDateFormatted,
                end: endDateFormatted,
                userName: row.user_name,
                userEmail: row.user_email,
                leaveTypeName: row.leaveType_name,
                status: row.leave_status,
            };
        });

        res.json(formattedEvents);
        return;

    } catch (error) {
        console.error("Error fetching leave availability:", error);
        res.status(500).json({ message: "Internal Server Error" });
        return;
    }
};

router.get("/calendar/leave-availability", protect, getLeaveAvailabilityHandler);

export { router };
