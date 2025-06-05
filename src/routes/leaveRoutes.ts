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
import moment from "moment";
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
  if (startDate > endDate) {
    return 0;
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  const diffInMs = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffInMs / msPerDay) + 1;
};

const areDateRangesOverlapping = (
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean => {
  return start1 <= end2 && end1 >= start2;
};

const calculateWorkingDays = (startDate: Date, endDate: Date): number => {
  let count = 0;
  const currentDate = new Date(startDate.getTime());

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return count;
};

interface ApplyLeaveRequestBody {
  type_id: number;
  start_date: string;
  end_date: string;
  reason: string;
}

interface ApplyLeaveSuccessResponse {
  message: string;
  leaveId: number;
  initialStatus: LeaveStatus;
  requiredApprovals: number;
}

interface UpdateLeaveStatusRequestBody {
  status: "Approved" | "Rejected";
  comments?: string;
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
  title: string;
  start: string;
  end: string;
  userName: string;
  userEmail: string;
  leaveTypeName: string;
  status: string;
}

const getLeaveTypesHandler: RequestHandler<
  {},
  LeaveType[] | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.user_id;
  const userRoleId = req.user?.role_id;

  if (!userId || userRoleId === undefined) {
    console.warn(
      `getLeaveTypesHandler: Authentication failed or role missing. User ID: ${userId}, Role ID: ${userRoleId}`,
    );
    res
      .status(401)
      .json({ message: "User not authenticated or role missing." });
    return;
  }

  try {
    const allLeaveTypes = await leaveTypeRepository.find({
      order: { name: "ASC" },
    });

    let applyableLeaveTypes: LeaveType[] = [];

    if (userRoleId !== ADMIN_ROLE_ID) {
      const rulesForRole = roleInitialBalances[userRoleId];

      const allowedLeaveTypeNames = (rulesForRole || []).map(
        (rule) => rule.leaveTypeName,
      );
      applyableLeaveTypes = allLeaveTypes.filter((type) => {
        const isApplyable = allowedLeaveTypeNames.includes(type.name);
        return isApplyable;
      });
    } else {
      applyableLeaveTypes = [];
    }

    res.status(200).json(applyableLeaveTypes);
  } catch (error) {
    console.error(
      `getLeaveTypesHandler: Error fetching leave types for user ${userId}:`,
      error,
    );
    res
      .status(500)
      .json({ message: "Internal server error fetching leave types" });
  }
};

router.get("/types", protect, getLeaveTypesHandler);

const applyLeaveHandler: RequestHandler<
  {},
  ApplyLeaveSuccessResponse | ErrorResponse,
  ApplyLeaveRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const user_id = req.user?.user_id;
  const user_role_id = req.user?.role_id;

  if (user_id === undefined || user_role_id === undefined) {
    console.error(
      "User ID or Role ID not found on request after protect middleware.",
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
      `User ${user_id}: Attempted to apply for leave with a past start date: ${start_date}`,
    );
    res
      .status(400)
      .json({ message: "Leave start date cannot be in the past." });
    return;
  }
  if (startDateObj > endDateObj) {
    res.status(400).json({ message: "Start date cannot be after end date" });
    return;
  }
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

    // Find any existing Pending or Approved leaves for this user
    const existingLeaves = await leaveRepository.find({
      where: {
        user_id: user_id,
        status: In(["Pending", "Approved"] as LeaveStatus[]),
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
          `Skipping overlap check for invalid existing leave dates (ID: ${existingLeave.leave_id})`,
        );
        continue;
      }

      if (
        areDateRangesOverlapping(
          startDateObj,
          endDateObj,
          existingStartDate,
          existingEndDate,
        )
      ) {
        res.status(400).json({
          message: `Your requested leave dates (${startDateObj.toLocaleDateString()} - ${endDateObj.toLocaleDateString()}) overlap with an existing leave request (Status: ${
            existingLeave.status
          }, Dates: ${existingStartDate.toLocaleDateString()} - ${existingEndDate.toLocaleDateString()}).`,
        });
        return;
      }
    }

    const allowedLeaveTypeNamesForRole = (
      roleInitialBalances[user_role_id] || []
    ).map((rule) => rule.leaveTypeName);
    const leaveTypeIsApplyableForRole =
      allowedLeaveTypeNamesForRole.includes(leaveTypeName);

    if (!leaveTypeIsApplyableForRole) {
      console.warn(
        `User ${user_id} (Role ID: ${user_role_id}) attempted to apply for '${leaveTypeName}' (Type ID: ${selectedTypeId}), which is not allowed for this role.`,
      );
      res
        .status(403)
        .json({ message: `You cannot apply for '${leaveTypeName}' leave.` });
      return;
    }

    if (is_balance_based && user_role_id !== INTERN_ROLE_ID) {
      const userBalance = await leaveBalanceRepository.findOne({
        where: {
          user_id: user_id,
          type_id: selectedTypeId,
          year: startDateObj.getFullYear(),
        },
        select: ["total_days", "used_days"],
      });

      if (!userBalance) {
        res.status(400).json({
          message: `Leave balance not found for ${leaveTypeName} for the year ${startDateObj.getFullYear()}. Please contact HR.`,
        });
        return;
      }

      const availableDays =
        parseFloat(userBalance.total_days as string) -
        parseFloat(userBalance.used_days as string);

      if (requestedDays > availableDays) {
        res.status(400).json({
          message: `Insufficient balance for ${leaveTypeName}. Available: ${availableDays.toFixed(
            2,
          )}, Requested: ${requestedDays.toFixed(2)}`,
        });
        return;
      }
    } else if (is_balance_based && user_role_id === INTERN_ROLE_ID) {
      res.status(403).json({
        message: `Interns cannot apply for balance-based leave types.`,
      });
      return;
    } else if (!is_balance_based) {
      // console.log(
      //   `${leaveTypeName} is not balance-based. Skipping balance check.`
      // );
    }

    let initialStatus: LeaveStatus = LeaveStatus.Pending;
    let requiredApprovals: number = 1;

    if (!requires_approval) {
      initialStatus = LeaveStatus.Approved;
      requiredApprovals = 0;
      // console.log(
      //   `${leaveTypeName} does not require approval. Setting status to Approved.`
      // );
    } else {
      const workingDaysForApprovalRule = calculateWorkingDays(
        startDateObj,
        endDateObj,
      );
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
    newLeave.start_date = startDateObj;
    newLeave.end_date = endDateObj;
    newLeave.reason = reason;
    newLeave.status = initialStatus;
    newLeave.required_approvals = requiredApprovals;
    const savedLeave = await leaveRepository.save(newLeave);

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
      errorMessage = error.message;
    } else if (typeof error === "string") {
      errorMessage = error;
    }
    res.status(500).json({
      message: errorMessage || "Internal server error during leave submission",
    });
    return;
  }
};

router.post("/", protect, applyLeaveHandler);

const getUserLeaveBalancesHandler: RequestHandler<
  {},
  any | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.user_id;

  if (!userId) {
    res
      .status(401)
      .json({ message: "User not authenticated or user ID missing." });
    return;
  }

  try {
    const currentYear = new Date().getFullYear();
    const userBalances = await leaveBalanceRepository.find({
      where: { user_id: userId, year: currentYear },
      relations: ["leaveType"],
    });
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
  {},
  any | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.user_id;

  if (!userId) {
    res
      .status(401)
      .json({ message: "User not authenticated or user ID missing." });
    return;
  }

  try {
    const userLeaves = await leaveRepository.find({
      where: { user_id: userId },
      relations: ["leaveType"],
      order: { applied_at: "DESC" },
    });
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

const getApprovalHistoryHandler: RequestHandler<
  {},
  LeaveApproval[] | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const userId = req.user?.user_id;
  const userRoleId = req.user?.role_id;

  if (!userId || userRoleId === undefined) {
    res.status(401).json({ message: "Authentication failed or user ID missing." });
    return;
  }

  try {
    let approvals: LeaveApproval[] = [];

    if (userRoleId === ADMIN_ROLE_ID) {
      approvals = await leaveApprovalRepository.find({
        relations: ["leave", "leave.user", "approver", "leave.leaveType"],
        order: { approved_at: "DESC" },
      });
      approvals = approvals.filter(
        (approval) => approval.action !== ApprovalAction.Pending
      );
    } else if (userRoleId === MANAGER_ROLE_ID) {
      approvals = await leaveApprovalRepository.find({
        where: { approver_id: userId },
        relations: ["leave", "leave.user", "approver", "leave.leaveType"],
        order: { approved_at: "DESC" },
      });
      approvals = approvals.filter(
        (approval) => approval.action !== ApprovalAction.Pending
      );
    } else {
      res.status(403).json({ message: "Access denied." });
      return;
    }

    res.status(200).json(approvals);
    return;
  } catch (error) {
    console.error("Error fetching approval history:", error);
    res.status(500).json({ message: "Internal server error fetching approval history" });
    return;
  }
};

router.get("/approvals/history", protect, getApprovalHistoryHandler);

const updateLeaveStatusHandler: RequestHandler<
  { id: string }, // Req Params (expecting leave ID in the URL)
  UpdateLeaveStatusSuccessResponse | ErrorResponse,
  UpdateLeaveStatusRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const loggedInUser = req.user;
  const manager_user_id = loggedInUser?.user_id;
  const manager_role_id = loggedInUser?.role_id;

  const leaveId = parseInt(req.params.id, 10);
  const { status } = req.body as UpdateLeaveStatusRequestBody;
  const comments = req.body.comments || null;

  if (
    !loggedInUser ||
    !manager_user_id ||
    manager_role_id !== MANAGER_ROLE_ID
  ) {
    console.error(
      `User ${manager_user_id} with role ${manager_role_id} attempted to use Manager status update endpoint.`,
    );
    res.status(403).json({
      message:
        "Forbidden: Only managers can perform this action on this endpoint.",
    });
    return;
  }

  try {
    const leaveRequest = await leaveRepository.findOne({
      where: {
        leave_id: leaveId,
        status: LeaveStatus.Pending,
      },
      relations: ["user", "leaveType"],
    });

    if (!leaveRequest) {
      console.warn(
        `Manager ${manager_user_id}: Leave request ${leaveId} not found or is not in 'Pending' status.`,
      );
      res.status(404).json({
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
        } who does not report to them.`,
      );
      res.status(403).json({
        message: "You are not authorized to approve/reject this leave request.",
      });
      return;
    }

    const submittingUserRoleId = leaveRequest.user.role_id;
    const leaveDuration = calculateWorkingDays(
      new Date(leaveRequest.start_date),
      new Date(leaveRequest.end_date),
    );

    // console.log(
    //   `Manager ${manager_user_id}: Processing leave ${leaveId} (submitted by user role ${submittingUserRoleId}, duration ${leaveDuration} working days), Manager action: ${status}.`
    // );

    let newStatus: LeaveStatus;

    if (status === "Approved") {
      if (
        (submittingUserRoleId === EMPLOYEE_ROLE_ID ||
          submittingUserRoleId === INTERN_ROLE_ID) &&
        leaveDuration > 5
      ) {
        newStatus = LeaveStatus.Awaiting_Admin_Approval;
      } else {
        newStatus = LeaveStatus.Approved;
        try {
          const leaveType = leaveRequest.leaveType;

          if (!leaveType) {
            console.error(
              `Manager ${manager_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`,
            );
          } else if (leaveType.requires_approval) {
            const leaveYear = new Date(leaveRequest.start_date).getFullYear();

            let userBalance = await leaveBalanceRepository.findOne({
              where: {
                user_id: leaveRequest.user_id,
                type_id: leaveRequest.type_id,
                year: leaveYear,
              },
            });

            if (userBalance) {
              const actualWorkingDaysOnLeave = leaveDuration;
              const currentUsedDays = parseFloat(userBalance.used_days as any);
              const updatedUsedDays =
                currentUsedDays + actualWorkingDaysOnLeave;

              userBalance.used_days = updatedUsedDays.toFixed(2).toString();

              await leaveBalanceRepository.save(userBalance);
            } else {
              console.error(
                `Manager ${manager_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`,
              );
            }
          } else {
            // console.log(
            //   `Manager ${manager_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`
            // );
          }
        } catch (balanceError: any) {
          console.error(
            `Manager ${manager_user_id}: Error during leave balance update for leave ${leaveId}:`,
            balanceError,
          );
        }
      }
    } else if (status === "Rejected") {
      newStatus = LeaveStatus.Rejected;
    } else {
      console.error(
        `Manager ${manager_user_id}: Unexpected status '${status}' received for leave ${leaveId}.`,
      );
      res
        .status(500)
        .json({ message: "Internal server error: Unexpected input status." });
      return;
    }

    leaveRequest.status = newStatus;
    leaveRequest.processed_by_id = manager_user_id;
    leaveRequest.processed_at = new Date();

    if (leaveApprovalRepository && manager_user_id) {
      try {
        const newApproval = new LeaveApproval();
        newApproval.leave_id = leaveRequest.leave_id;
        newApproval.approver_id = manager_user_id;
        if (newStatus === LeaveStatus.Awaiting_Admin_Approval) {
          newApproval.action = ApprovalAction.Approved; // Log Manager's action as Approved
        } else if (newStatus === LeaveStatus.Approved) {
          newApproval.action = ApprovalAction.Approved; // Log Manager's action as Approved
        } else if (newStatus === LeaveStatus.Rejected) {
          newApproval.action = ApprovalAction.Rejected;
        } else {
          console.warn(
            `Manager ${manager_user_id}: Unexpected new status '${newStatus}' for logging leave ${leaveId}.`,
          );
        }
        newApproval.comments = comments; // Include comments if provided

        await leaveApprovalRepository.save(newApproval);
      } catch (logError) {
        console.error(
          `Manager ${manager_user_id}: Error logging approval action for leave ${leaveId}:`,
          logError,
        );
      }
    } else {
      console.warn(
        `Manager ${manager_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or manager_user_id missing.`,
      );
    }
    await leaveRepository.save(leaveRequest);

    res.status(200).json({
      message: `Leave request ${leaveId} status updated to ${leaveRequest.status}`,
      leaveId: leaveRequest.leave_id,
      newStatus: leaveRequest.status,
    });
    return;
  } catch (error: any) {
    console.error(
      `Manager ${manager_user_id}: Error processing leave request ID ${leaveId}:`,
      error,
    );
    res
      .status(500)
      .json({ message: "Internal server error processing leave request." });
    return;
  }
};

router.put("/status/:id", protect, updateLeaveStatusHandler);

export const cancelLeaveHandler: RequestHandler<
    { id: string },
    UpdateLeaveStatusSuccessResponse | ErrorResponse,
    {},
    {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
    const userId = req.user?.user_id;
    if (!userId) {
        res.status(401).json({ message: "User not authenticated." });
        return;
    }

    const leaveId = parseInt(req.params.id, 10);
    if (isNaN(leaveId)) {
        res.status(400).json({ message: "Invalid leave ID provided." });
        return;
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
        const leaveRequest = await queryRunner.manager.findOne(Leave, {
            where: { leave_id: leaveId },
            relations: ["user", "leaveType"],
        });

        if (!leaveRequest) {
            await queryRunner.rollbackTransaction();
            res.status(404).json({ message: "Leave request not found." });
            return;
        }

        if (leaveRequest.user_id !== userId) {
            console.warn(
                `User ${userId} attempted to cancel leave ID ${leaveId} which they do not own (Owner: ${leaveRequest.user_id}).`
            );
            await queryRunner.rollbackTransaction();
            res.status(403).json({
                message: "Forbidden: You can only cancel your own leave requests.",
            });
            return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const leaveStartDate = new Date(leaveRequest.start_date);
        leaveStartDate.setHours(0, 0, 0, 0);

        const isPending = leaveRequest.status === LeaveStatus.Pending;
        const isApprovedAndCancellable =
            leaveRequest.status === LeaveStatus.Approved && today < leaveStartDate;

        if (!isPending && !isApprovedAndCancellable) {
            let message = `Cannot cancel leave request with status '${leaveRequest.status}'.`;
            if (leaveRequest.status === LeaveStatus.Approved && today >= leaveStartDate) {
                message = "Cannot cancel this leave: it is already active or has passed.";
            } else if (leaveRequest.status !== LeaveStatus.Pending && leaveRequest.status !== LeaveStatus.Approved) {
                message = `Only 'Pending' or 'Approved' (before start date) leaves can be cancelled. Current status: ${leaveRequest.status}`;
            }
            await queryRunner.rollbackTransaction();
            res.status(400).json({ message });
            return;
        }

        const oldStatus = leaveRequest.status;
        leaveRequest.status = LeaveStatus.Cancelled;

        await queryRunner.manager.save(Leave, leaveRequest);

        if (oldStatus === LeaveStatus.Approved && leaveRequest.leaveType?.is_balance_based) {
            const workingDaysToRevert = calculateWorkingDays(
                new Date(leaveRequest.start_date),
                new Date(leaveRequest.end_date)
            );

            if (workingDaysToRevert > 0) {
                const leaveYear = new Date(leaveRequest.start_date).getFullYear();
                const userBalance = await queryRunner.manager.findOne(LeaveBalance, {
                    where: {
                        user_id: leaveRequest.user_id,
                        type_id: leaveRequest.type_id,
                        year: leaveYear,
                    },
                });

                if (userBalance) {
                    const currentUsedDays = parseFloat(userBalance.used_days as string);
                    const newUsedDays = currentUsedDays - workingDaysToRevert;
                    userBalance.used_days = newUsedDays.toFixed(2).toString();
                    const currentTotalDays = parseFloat(userBalance.total_days as string);
                    userBalance.available_days = (currentTotalDays - newUsedDays).toFixed(2).toString();


                    await queryRunner.manager.save(LeaveBalance, userBalance);
                } else {
                    console.error(
                        `CRITICAL: LeaveBalance record not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear} during cancellation of approved leave ${leaveId}. Balance not reverted.`
                    );
                }
            }
        }

        await queryRunner.commitTransaction();

        res.status(200).json({
            message: `Leave request ${leaveId} cancelled successfully.`,
            leaveId: leaveRequest.leave_id,
            newStatus: leaveRequest.status,
        });

    } catch (error) {
        if (queryRunner.isTransactionActive) { // Check if transaction is active before trying to rollback
            await queryRunner.rollbackTransaction();
        }
        console.error(`Error cancelling leave request ${leaveId}:`, error);
        res.status(500).json({ message: "Internal server error cancelling leave request" });
    } finally {
        await queryRunner.release();
    }
};

router.put("/my/:id/cancel", protect, cancelLeaveHandler);

const getLeaveAvailabilityHandler: RequestHandler<
  {},
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
      .where("leave.status = :statusApproved", {
        statusApproved: LeaveStatus.Approved,
      }); // Initial WHERE clause with named parameter

    if (user.role_id === ADMIN_ROLE_ID) {
    } else if (user.role_id === MANAGER_ROLE_ID) {
      // Managers view leaves of their direct reports AND their own leaves
      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("user.manager_id = :managerId", {
            managerId: user.user_id,
          }).orWhere("user.user_id = :currentUserId", {
            currentUserId: user.user_id,
          });
        }),
      );
    } else if (
      user.role_id === EMPLOYEE_ROLE_ID ||
      user.role_id === INTERN_ROLE_ID
    ) {
      //console.log(`Backend: Calendar Request by User ID: ${user.user_id}, Role ID: ${user.role_id}`);

      const currentUserDetails = await userRepository.findOne({
        where: { user_id: user.user_id },
        select: ["user_id", "manager_id"],
      });

      //console.log(`Backend: Retrieved currentUserDetails for ${user.user_id}:`, currentUserDetails);

      if (!currentUserDetails) {
        console.warn(
          `User ${user.user_id} not found in DB for calendar availability check.`,
        );
        res.status(404).json({ message: "Current user details not found." });
        return;
      }

      queryBuilder.andWhere(
        new Brackets((qb) => {
          qb.where("user.user_id = :currentUserId", {
            currentUserId: user.user_id,
          });

          if (currentUserDetails.manager_id) {
            qb.orWhere("user.user_id = :managerOfCurrentUser", {
              managerOfCurrentUser: currentUserDetails.manager_id,
            });
          }

          if (currentUserDetails.manager_id) {
            qb.orWhere(
              "(user.manager_id = :sameManagerId AND user.user_id != :excludeSelfId)",
              {
                sameManagerId: currentUserDetails.manager_id,
                excludeSelfId: user.user_id,
              },
            );
          }
        }),
      );
    } else {
      res
        .status(403)
        .json({
          message:
            "Forbidden: Your role does not permit viewing this calendar.",
        });
      return;
    }

    const rawLeaveEvents = await queryBuilder.getRawMany();

    const formattedEvents: CalendarEventResponse[] = rawLeaveEvents.map(
      (row: any) => {
        const startDateFormatted = row.leave_start_date
          ? moment(row.leave_start_date).format("YYYY-MM-DD")
          : "";
        const endDateFormatted = row.leave_end_date
          ? moment(row.leave_end_date).format("YYYY-MM-DD")
          : "";

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
      },
    );

    res.json(formattedEvents);
    return;
  } catch (error) {
    console.error("Error fetching leave availability:", error);
    res.status(500).json({ message: "Internal Server Error" });
    return;
  }
};

router.get(
  "/calendar/leave-availability",
  protect,
  getLeaveAvailabilityHandler,
);

export { router };
