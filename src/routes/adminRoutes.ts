import express, { RequestHandler } from "express";
import { AppDataSource } from "../data-source";
import { LeaveType } from "../entity/LeaveType";
import { LeaveBalance } from "../entity/LeaveBalance";
import { User } from "../entity/User";
import { Role } from "../entity/Role";
import { FindManyOptions, In, And, Or } from "typeorm";
import { Leave, LeaveStatus } from "../entity/Leave";
import { LeaveApproval, ApprovalAction } from "../entity/LeaveApproval";
import {
  roleInitialBalances,
  ADMIN_ROLE_ID,
  EMPLOYEE_ROLE_ID,
  MANAGER_ROLE_ID,
  INTERN_ROLE_ID,
} from "../constants";

import bcryptjs from "bcryptjs";
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";
import { Request, Response, NextFunction } from "express";
import { ParsedQs } from "qs";

// Interface for the request body when creating a LeaveType
interface CreateLeaveTypeRequestBody {
  name: string;
  requires_approval: boolean;
  is_balance_based: boolean;
}

// Interface for the request body when creating a User
interface CreateUserRequestBody {
  name: string;
  email: string;
  password: string;
  role_id: number;
  manager_id?: number | null;
}

// Interface for the structure of the User object sent back in successful responses (e.g., after creation or fetching lists)
interface UserResponse {
  user_id: number;
  name: string;
  email: string;
  role_id: number;
  manager_id: number | null;
  role: {
    role_id: number;
    name: string;
  };
}

interface UserWithBalancesResponse extends UserResponse {
  // Extend the existing UserResponse interface
  leaveBalances: {
    leaveTypeName: string;
    totalDays: number;
    usedDays: number;
    availableDays: number;
    year: number;
  }[];
}

// Generic error response structure
interface ErrorResponse {
  message: string;
}

interface GetUsersQueryParams extends ParsedQs {
  role_id?: string;
}

// Create an Express router instance for admin routes
const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
  next(); // Pass the request to the next middleware or route handler
});

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

const leaveTypeRepository = AppDataSource.getRepository(LeaveType);
const leaveBalanceRepository = AppDataSource.getRepository(LeaveBalance);
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);
const leaveRepository = AppDataSource.getRepository(Leave);
const leaveApprovalRepository = AppDataSource.getRepository(LeaveApproval);

const getLeaveTypesForAdminHandler: RequestHandler<
  {},
  LeaveType[] | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res
      .status(401)
      .json({ message: "Authentication failed or user information missing." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access admin leave types list.`,
    );
    res.status(403).json({
      message:
        "Forbidden: You do not have sufficient permissions to view this resource.",
    });
    return;
  }
  try {
    const leaveTypes = await leaveTypeRepository.find({
      order: { name: "ASC" },
    });

    res.status(200).json(leaveTypes);
    return;
  } catch (error) {
    console.error("Error fetching all leave types for admin:", error);
    res
      .status(500)
      .json({ message: "Internal server error fetching leave types" });
    return;
  }
};

const createLeaveTypeHandler: RequestHandler<
  {},
  LeaveType | ErrorResponse,
  CreateLeaveTypeRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  const { name, requires_approval, is_balance_based } = req.body;

  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a leave type.`,
    );
    res.status(403).json({
      message:
        "Forbidden: You do not have sufficient permissions to perform this action.",
    });
    return;
  }
  if (
    !name ||
    typeof requires_approval !== "boolean" ||
    typeof is_balance_based !== "boolean"
  ) {
    res.status(400).json({
      message:
        "Missing required fields (name, requires_approval, is_balance_based) or invalid types.",
    });
    return;
  }

  try {
    const newLeaveType = new LeaveType();
    newLeaveType.name = name.trim();
    newLeaveType.requires_approval = requires_approval;
    newLeaveType.is_balance_based = is_balance_based;
    const createdLeaveType = await leaveTypeRepository.save(newLeaveType);

    res.status(201).json(createdLeaveType);
    return;
  } catch (error: any) {
    console.error("Error creating new leave type:", error);
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        message: `Leave type with name '${name.trim()}' already exists.`,
      });
      return;
    }
    res
      .status(500)
      .json({ message: "Internal server error creating leave type." });
    return;
  }
};

const createUserHandler: RequestHandler<
  {},
  UserResponse | ErrorResponse,
  CreateUserRequestBody,
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  const { name, email, password, role_id, manager_id = null } = req.body;

  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a user.`,
    );
    res.status(403).json({
      message:
        "Forbidden: You do not have sufficient permissions to perform this action.",
    });
    return;
  }
  if (!name || !email || !password || role_id === undefined) {
    res.status(400).json({
      message: "Missing required fields (name, email, password, role_id).",
    });
    return;
  }

  try {
    const existingUser = await userRepository.findOne({
      where: { email: email.trim() },
    });
    if (existingUser) {
      res
        .status(409)
        .json({ message: `User with email '${email.trim()}' already exists.` }); // 409 Conflict
      return;
    }

    const role = await roleRepository.findOne({ where: { role_id } });
    if (!role) {
      res
        .status(400)
        .json({ message: `Invalid role_id: ${role_id}. Role not found.` });
      return;
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    const newUser = new User();
    newUser.name = name.trim();
    newUser.email = email.trim();
    newUser.password_hash = hashedPassword;
    newUser.role = role;
    newUser.manager_id = manager_id;

    const createdUser = await userRepository.save(newUser);

    try {
      console.log(
        `Triggering initial leave balance creation for user ID ${createdUser.user_id}, Role: ${role.name}...`,
      );

      const balancesToCreate =
        roleInitialBalances[createdUser.role.role_id] || [];

      if (balancesToCreate.length > 0) {
        const currentYear = new Date().getFullYear();

        const leaveTypeNames = balancesToCreate.map((b) => b.leaveTypeName);
        const leaveTypes = await leaveTypeRepository.find({
          where: leaveTypeNames.map((name) => ({ name })),
          select: ["type_id", "name"],
        });

        if (leaveTypes.length !== leaveTypeNames.length) {
          console.warn(
            `createUserHandler: Could not find all required leave types for role ${
              role.name
            }. Missing types: ${leaveTypeNames
              .filter((name) => !leaveTypes.find((lt) => lt.name === name))
              .join(", ")}`,
          );
        }

        const newBalances: LeaveBalance[] = [];
        const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.name, lt]));

        for (const balanceRule of balancesToCreate) {
          const leaveType = leaveTypeMap.get(balanceRule.leaveTypeName);

          if (leaveType) {
            const newBalance = new LeaveBalance();
            newBalance.user = createdUser;
            newBalance.user_id = createdUser.user_id;
            newBalance.leaveType = leaveType;
            newBalance.type_id = leaveType.type_id;
            newBalance.year = currentYear;

            newBalance.total_days = Number(balanceRule.initialDays).toFixed(2);
            newBalance.used_days = Number(0).toFixed(2);
            newBalance.available_days = Number(balanceRule.initialDays).toFixed(
              2,
            );

            newBalances.push(newBalance);
          } else {
            console.warn(
              `createUserHandler: Skipping balance creation for missing leave type: ${balanceRule.leaveTypeName}`,
            );
          }
        }

        if (newBalances.length > 0) {
          await leaveBalanceRepository.save(newBalances);
        } else {
          //           console.log(
          //             `createUserHandler: No initial leave balance rules defined for role ${role.name}. Skipping balance creation.`
          //           );
        }
      } else {
        //         console.log(
        //           `createUserHandler: No initial leave balance rules defined for role ${role.name}. Skipping balance creation.`
        //         );
      }
    } catch (balanceError: any) {
      console.error(
        `createUserHandler: Error during initial leave balance creation for user ID ${createdUser.user_id}:`,
        balanceError,
      );
    }
    const userResponse: UserResponse = {
      user_id: createdUser.user_id,
      name: createdUser.name,
      email: createdUser.email,
      role_id: createdUser.role.role_id,
      manager_id: createdUser.manager_id,
      role: {
        role_id: role.role_id,
        name: role.name,
      },
    };

    res.status(201).json(userResponse);
    return;
  } catch (error: any) {
    console.error("Error creating new user (before balance trigger):", error);
    if (
      error.code === "ER_DUP_ENTRY" ||
      (error.detail && error.detail.includes("already exists"))
    ) {
      res
        .status(409)
        .json({ message: `User with email '${email.trim()}' already exists.` });
      return;
    }
    res.status(500).json({ message: "Internal server error creating user." });
    return;
  }
};

const getUsersHandler: RequestHandler<
  {},
  UserWithBalancesResponse[] | ErrorResponse,
  {}, // Req Body (none for GET)
  GetUsersQueryParams // Req Query: { role_id?: string }
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id; //console.log(`--- Admin user ${admin_user_id} accessing /api/admin/users ---`);
  // If authentication failed or user info is missing (should be caught by protect, but defensive check)

  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access user list.`,
    );
    res
      .status(403)
      .json({
        message:
          "Forbidden: You do not have sufficient permissions to view this resource.",
      });
    return;
  }

  const roleIdParam = req.query.role_id;
  const filterRoleId = roleIdParam
    ? parseInt(roleIdParam.toString(), 10)
    : undefined;

  try {
    const findOptions: FindManyOptions<User> = {
      relations: ["role"],
      order: { name: "ASC" },
      where: {},
    };

    if (filterRoleId !== undefined && !isNaN(filterRoleId)) {
      // <-- Ensure it's a valid number
      findOptions.where = { role_id: filterRoleId };
      //             console.log(`Workspaceing users with Role ID filter: ${filterRoleId}`);
    } else if (roleIdParam !== undefined) {
      // If role_id was provided but wasn't a valid number
      console.warn(
        `Admin user ${admin_user_id} provided invalid role_id query parameter: ${roleIdParam}`,
      );
      res
        .status(400)
        .json({
          message:
            "Invalid role_id provided in query parameters. Must be a number.",
        }); // Bad Request
      return;
    } else {
      //  console.log("Fetching all users (no role filter).");
    }

    const users = await userRepository.find(findOptions);
    const usersWithBalances: UserWithBalancesResponse[] = [];
    const currentYear = new Date().getFullYear();
    const userIds = users.map((user) => user.user_id);
    if (userIds.length > 0) {
      const allRelevantBalances = await leaveBalanceRepository.find({
        where: {
          user_id: In(userIds),
          year: currentYear,
        },
        relations: ["leaveType"],
        select: [
          "balance_id",
          "user_id",
          "total_days",
          "used_days",
          "year",
          "leaveType",
        ],
      });

      const balancesByUser = new Map<number, typeof allRelevantBalances>();
      for (const balance of allRelevantBalances) {
        if (!balancesByUser.has(balance.user_id)) {
          balancesByUser.set(balance.user_id, []);
        }
        balancesByUser.get(balance.user_id)?.push(balance);
      }

      for (const user of users) {
        const userBalances = balancesByUser.get(user.user_id) || [];
        const formattedBalances = userBalances.map((balance) => ({
          leaveTypeName: balance.leaveType.name,
          totalDays: parseFloat(balance.total_days as any),
          usedDays: parseFloat(balance.used_days as any),
          availableDays:
            parseFloat(balance.total_days as any) -
            parseFloat(balance.used_days as any),
          year: balance.year,
        }));

        const userWithBalance: UserWithBalancesResponse = {
          user_id: user.user_id,
          name: user.name,
          email: user.email,
          role_id: user.role.role_id,
          manager_id: user.manager_id,
          role: {
            role_id: user.role.role_id,
            name: user.role.name,
          },
          leaveBalances: formattedBalances,
        };

        usersWithBalances.push(userWithBalance);
      }
    }
    res.status(200).json(usersWithBalances);
    return;
  } catch (error) {
    console.error("Error fetching users for admin:", error);
    res.status(500).json({ message: "Internal server error fetching users." });
    return;
  }
};

const getAdminApprovalsHandler: RequestHandler<
  {},
  Leave[] | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;
  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access Admin approval list.`,
    );
    res
      .status(403)
      .json({
        message:
          "Forbidden: You do not have sufficient permissions to view this resource.",
      });
    return;
  }

  try {
    const leavesNeedingAdminApproval = await leaveRepository.find({
      where: [
        { status: LeaveStatus.Awaiting_Admin_Approval },
        {
          status: LeaveStatus.Pending,
          user: { role_id: MANAGER_ROLE_ID },
        },
      ],
      relations: ["user", "leaveType"],
      order: { applied_at: "ASC" },
    }); //console.log(`Workspaceed ${leavesNeedingAdminApproval.length} leave requests needing Admin approval.`);

    res.status(200).json(leavesNeedingAdminApproval);
    return;
  } catch (error) {
    console.error(
      `Admin ${admin_user_id}: Error fetching leave requests needing Admin approval:`,
      error,
    );
    res
      .status(500)
      .json({ message: "Internal server error fetching leave requests." });
    return;
  }
};

router.get(
  "/leave-requests/approvals-needed",
  protect,
  getAdminApprovalsHandler,
);

const updateLeaveStatusByAdminHandler: RequestHandler<
  { id: string }, // Req Params (expecting leave ID in the URL)
  | { message: string; leaveId: number; newStatus: LeaveStatus }
  | { message: string },
  { status: "Approved" | "Rejected"; comments?: string },
  {} // Req Query
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const loggedInUser = req.user;
  const admin_user_id = loggedInUser?.user_id;
  const admin_role_id = loggedInUser?.role_id;

  const leaveId = parseInt(req.params.id, 10);
  const { status, comments } = req.body;

  if (!loggedInUser || !admin_user_id || admin_role_id !== ADMIN_ROLE_ID) {
    console.error(
      `User ${admin_user_id} with role ${admin_role_id} attempted to use Admin status update endpoint.`,
    );
    res
      .status(403)
      .json({
        message:
          "Forbidden: Only admins can perform this action on this endpoint.",
      });
    return;
  }

  if (status !== "Approved" && status !== "Rejected") {
    console.warn(
      `Admin ${admin_user_id}: Invalid status received: ${status} for leave ${leaveId}.`,
    );
    res
      .status(400)
      .json({ message: "Invalid status provided in the request body." });
    return;
  }

  try {
    const leaveRequest = await leaveRepository.findOne({
      where: [
        { leave_id: leaveId, status: LeaveStatus.Pending },
        { leave_id: leaveId, status: LeaveStatus.Awaiting_Admin_Approval },
      ],
      relations: ["user", "leaveType"],
    });

    if (!leaveRequest) {
      console.warn(
        `Admin ${admin_user_id}: Leave request ${leaveId} not found or is not in a processable status for Admin.`,
      );
      res
        .status(404)
        .json({
          message: "Leave request not found or has already been processed.",
        });
      return;
    }

    const oldStatus = leaveRequest.status;

    let newStatus: LeaveStatus;

    if (status === "Approved") {
      newStatus = LeaveStatus.Approved;

      try {
        const leaveType = leaveRequest.leaveType;

        if (!leaveType) {
          console.error(
            `Admin ${admin_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`,
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
            const actualWorkingDaysOnLeave = calculateWorkingDays(
              new Date(leaveRequest.start_date),
              new Date(leaveRequest.end_date),
            );
            const currentUsedDays = parseFloat(userBalance.used_days as any);
            const updatedUsedDays = currentUsedDays + actualWorkingDaysOnLeave;

            userBalance.used_days = updatedUsedDays.toFixed(2).toString();

            await leaveBalanceRepository.save(userBalance);
          } else {
            console.error(
              `Admin ${admin_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`,
            );
          }
        } else {
          //console.log(`Admin ${admin_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`);
        }
      } catch (balanceError: any) {
        console.error(
          `Admin ${admin_user_id}: Error during leave balance update for leave ${leaveId}:`,
          balanceError,
        );
      }
    } else if (status === "Rejected") {
      newStatus = LeaveStatus.Rejected;
    } else {
      console.error(
        `Admin ${admin_user_id}: Unexpected status '${status}' received for leave ${leaveId}.`,
      );
      res
        .status(500)
        .json({ message: "Internal server error: Unexpected input status." });
      return;
    }

    leaveRequest.status = newStatus;
    leaveRequest.processed_by_id = admin_user_id;
    leaveRequest.processed_at = new Date();

    if (
      (oldStatus === LeaveStatus.Pending ||
        oldStatus === LeaveStatus.Awaiting_Admin_Approval) &&
      (newStatus === LeaveStatus.Approved || newStatus === LeaveStatus.Rejected)
    ) {
      if (leaveApprovalRepository && admin_user_id) {
        try {
          const newApproval = new LeaveApproval();
          newApproval.leave_id = leaveRequest.leave_id;
          newApproval.approver_id = admin_user_id;
          newApproval.action =
            newStatus === LeaveStatus.Approved
              ? ApprovalAction.Approved
              : ApprovalAction.Rejected;
          newApproval.comments = comments;

          await leaveApprovalRepository.save(newApproval);
        } catch (logError) {
          console.error(
            `Admin ${admin_user_id}: Error logging approval action for leave ${leaveId}:`,
            logError,
          );
        }
      } else {
        console.warn(
          `Admin ${admin_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or admin_user_id missing.`,
        );
      }
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
      `Admin ${admin_user_id}: Error processing leave request ID ${leaveId}:`,
      error,
    );
    res
      .status(500)
      .json({ message: "Internal server error processing leave request." });
    return;
  }
};

router.put(
  "/leave-requests/:id/status",
  protect,
  updateLeaveStatusByAdminHandler,
);

const deleteLeaveTypeHandler: RequestHandler<
  { id: string },
  { message: string } | ErrorResponse,
  {},
  {}
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_role_id = req.user?.role_id;

  const leaveTypeId = parseInt(req.params.id, 10); //console.log(`--- Admin ${admin_user_id} (Role: ${admin_role_id}) attempting to delete leave type ${leaveTypeId} ---`);

  if (!req.user || !admin_user_id || admin_role_id !== ADMIN_ROLE_ID) {
    console.error(
      `User ${admin_user_id} with role ${admin_role_id} attempted to use delete leave type endpoint.`,
    );
    res
      .status(403)
      .json({ message: "Forbidden: Only admins can delete leave types." });
    return;
  }

  if (isNaN(leaveTypeId)) {
    console.warn(
      `Admin ${admin_user_id}: Invalid leave type ID provided for deletion: ${req.params.id}`,
    );
    res.status(400).json({ message: "Invalid leave type ID provided." });
    return;
  }

  try {
    const existingLeaves = await leaveRepository.count({
      where: { type_id: leaveTypeId },
    });
    if (existingLeaves > 0) {
      console.warn(
        `Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which is in use by ${existingLeaves} leave requests.`,
      );
      res
        .status(409)
        .json({
          message:
            "Cannot delete leave type: it is used by existing leave requests.",
        });
      return;
    }

    const existingBalances = await leaveBalanceRepository.count({
      where: { type_id: leaveTypeId },
    });
    if (existingBalances > 0) {
      console.warn(
        `Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which is in use by ${existingBalances} leave balances.`,
      );
      res
        .status(409)
        .json({
          message:
            "Cannot delete leave type: it is used by existing leave balances.",
        });
      return;
    }

    const deleteResult = await leaveTypeRepository.delete(leaveTypeId);

    if (deleteResult.affected === 0) {
      console.warn(
        `Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which was not found.`,
      );
      res.status(404).json({ message: "Leave type not found." });
      return;
    }

    res.status(200).json({ message: "Leave type deleted successfully." });
    return;
  } catch (error) {
    console.error(
      `Admin ${admin_user_id}: Error deleting leave type ${leaveTypeId}:`,
      error,
    );
    res
      .status(500)
      .json({ message: "Internal server error deleting leave type." });
    return;
  }
};

router.delete("/leave-types/:id", protect, deleteLeaveTypeHandler);

router.get("/leave-types", protect, getLeaveTypesForAdminHandler);

router.post("/leave-types", protect, createLeaveTypeHandler);

router.post("/users", protect, createUserHandler);

router.get("/users", protect, getUsersHandler);

export { router as adminRoutes };
