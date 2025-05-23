import express, { RequestHandler } from "express";
import { AppDataSource } from "../data-source";
import { LeaveType } from "../entity/LeaveType"; // Import the LeaveType entity
import { LeaveBalance } from "../entity/LeaveBalance"; // Import LeaveBalance entity
import { User } from "../entity/User"; // Import the User entity for user management
import { Role } from "../entity/Role"; // Import the Role entity for user management
import { FindManyOptions, In, And, Or } from "typeorm"; // Import FindManyOptions for TypeORM queries
import { Leave, LeaveStatus } from '../entity/Leave';
import { LeaveApproval, ApprovalAction } from "../entity/LeaveApproval";
import { roleInitialBalances, ADMIN_ROLE_ID, EMPLOYEE_ROLE_ID, MANAGER_ROLE_ID, INTERN_ROLE_ID } from '../constants';


// Use bcryptjs consistently for password hashing
import bcryptjs from "bcryptjs"; // Use bcryptjs
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";
import { Request, Response, NextFunction } from "express";
import { ParsedQs } from "qs";


// --- Define Interfaces for Request and Response Bodies ---

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
  role_id: number; // Client must specify the role ID for the new user
  manager_id?: number | null; // Optional: Allow assigning a manager during creation
}

// Interface for the structure of the User object sent back in successful responses (e.g., after creation or fetching lists)
interface UserResponse {
  user_id: number;
  name: string;
  email: string;
  role_id: number;
  manager_id: number | null; // Include manager_id if applicable
  role: {
    // Assuming you include nested role details
    role_id: number;
    name: string; // Assuming Role entity has a 'name' property
  };
}

// --- NEW Interface for GET /api/admin/users Response (Includes Balances) ---
// This interface is needed for the getUsersHandler to match the frontend expectation
interface UserWithBalancesResponse extends UserResponse { // Extend the existing UserResponse interface
    leaveBalances: { // Define the structure of a balance summary for a single leave type
        leaveTypeName: string;
        totalDays: number;
        usedDays: number;
        availableDays: number; // Calculated backend-side for convenience
        year: number; // Include the year
    }[]; // Array of balance summaries
}


// Generic error response structure
interface ErrorResponse {
  message: string; // A descriptive error message
}

interface GetUsersQueryParams extends ParsedQs {
  role_id?: string;
}


// Create an Express router instance for admin routes
const router = express.Router();

router.use((req: Request, res: Response, next: NextFunction) => {
//   console.log(
//     "--- Admin Router Received Request:",
//     req.method,
//     req.originalUrl
//   );
  next(); // Pass the request to the next middleware or route handler
});

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


const leaveTypeRepository = AppDataSource.getRepository(LeaveType); // Repository for LeaveType entity
const leaveBalanceRepository = AppDataSource.getRepository(LeaveBalance); // Get LeaveBalance Repository
const userRepository = AppDataSource.getRepository(User); // Repository for User entity
const roleRepository = AppDataSource.getRepository(Role); // Repository for Role entity
const leaveRepository = AppDataSource.getRepository(Leave);
const leaveApprovalRepository = AppDataSource.getRepository(LeaveApproval);

const getLeaveTypesForAdminHandler: RequestHandler<
  {}, // Req Params (none for this route)
  LeaveType[] | ErrorResponse, // Res Body: array of LeaveType objects OR error message
  {}, // Req Body (none for GET)
  {} // Req Query (none for this route)
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id; // If authentication failed or user info is missing (should be caught by protect, but defensive check)

  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res
      .status(401)
      .json({ message: "Authentication failed or user information missing." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    // Log the unauthorized attempt (optional but good practice)
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access admin leave types list.`
    ); // Send 403 Forbidden status
    res.status(403).json({
      message:
        "Forbidden: You do not have sufficient permissions to view this resource.",
    });
    return;
  } 
  try {
    // Fetch all leave types from the database using the repository
    const leaveTypes = await leaveTypeRepository.find({
      order: { name: "ASC" }, // Optional: order results by name alphabetically
    }); // Send the list of leave types in the response with 200 OK status

    res.status(200).json(leaveTypes);
    return; // Exit handler
  } catch (error) {
    // Catch any errors during the database query
    console.error("Error fetching all leave types for admin:", error); // Send a 500 Internal Server Error response
    res
      .status(500)
      .json({ message: "Internal server error fetching leave types" });
    return; // Exit handler
  }
};

const createLeaveTypeHandler: RequestHandler<
  {}, // Req Params (none)
  LeaveType | ErrorResponse, // Res Body: the created LeaveType object OR error message
  CreateLeaveTypeRequestBody, // Req Body: name, requires_approval, is_balance_based
  {} // Req Query (none)
> = async (req: AuthenticatedRequest, res): Promise<void> => {
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  // Destructure data for the new leave type from the request body
  const { name, requires_approval, is_balance_based } = req.body;

  // If authentication failed or user info missing (should be caught by protect, but defensive check)
  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    // Log the unauthorized attempt
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a leave type.`
    ); // Send 403 Forbidden status
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
    }); // 400 Bad Request
    return; // Exit handler
  }

  try {
    const newLeaveType = new LeaveType();
    // Assign properties from the request body
    newLeaveType.name = name.trim(); // Trim whitespace
    newLeaveType.requires_approval = requires_approval;
    newLeaveType.is_balance_based = is_balance_based; // Set other properties if your LeaveType entity has them
    const createdLeaveType = await leaveTypeRepository.save(newLeaveType);

    // Log the successful creation (optional)
//     console.log(
//       `Admin user ${admin_user_id} created new leave type: ${name} (ID: ${createdLeaveType.type_id})`
//     );
    res.status(201).json(createdLeaveType);
    return;
  } catch (error: any) {
    console.error("Error creating new leave type:", error); // Check for specific database errors, e.g., unique constraint violation on name
    if (error.code === "ER_DUP_ENTRY") {
      res.status(409).json({
        message: `Leave type with name '${name.trim()}' already exists.`,
      }); // 409 Conflict
      return;
    }
    // Handle other errors with a 500 Internal Server Error response
    res
      .status(500)
      .json({ message: "Internal server error creating leave type." });
    return; // Exit handler
  }
};

const createUserHandler: RequestHandler<
  {}, // Req Params (none)
  UserResponse | ErrorResponse, // Res Body: created User (UserResponse) OR error message
  CreateUserRequestBody, // Req Body: name, email, password, role_id (+ optional manager_id)
  {} // Req Query (none)
> = async (req: AuthenticatedRequest, res): Promise<void> => {
//   console.log("--- Inside createUserHandler ---");
  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  // Destructure data for the new user from the request body
  const { name, email, password, role_id, manager_id = null } = req.body; // manager_id is optional, default to null

  // If authentication failed or user info missing (should be caught by protect, but defensive check)
  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    // Log the unauthorized attempt
    console.warn(
      `User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a user.`
    ); // Send 403 Forbidden status
    res.status(403).json({
      message:
        "Forbidden: You do not have sufficient permissions to perform this action.",
    });
    return;
  }
  if (!name || !email || !password || role_id === undefined) {
    res.status(400).json({
      message: "Missing required fields (name, email, password, role_id).",
    }); // 400 Bad Request
    return; // Exit handler
  }

  try {
    const existingUser = await userRepository.findOne({
      where: { email: email.trim() },
    }); // Trim email
    if (existingUser) {
      res
        .status(409)
        .json({ message: `User with email '${email.trim()}' already exists.` }); // 409 Conflict
      return; // Exit handler
    }

    // --- Check if Provided Role Exists ---
    // Query the database to ensure the provided role_id is valid
    const role = await roleRepository.findOne({ where: { role_id } });
    if (!role) {
      res
        .status(400)
        .json({ message: `Invalid role_id: ${role_id}. Role not found.` }); // 400 Bad Request
      return; // Exit handler
    }

    // Generate a salt and hash the plaintext password
    const salt = await bcryptjs.genSalt(10); // Recommended salt rounds for bcryptjs
    const hashedPassword = await bcryptjs.hash(password, salt); // Use bcryptjs.hash

    const newUser = new User();
    // Assign properties from the request body
    newUser.name = name.trim();
    newUser.email = email.trim();
    newUser.password_hash = hashedPassword; // Store the hashed password
    newUser.role = role;
    newUser.manager_id = manager_id; // Assign manager_id (can be null or a valid manager's user_id)

    // Save the new user entity to the database
    const createdUser = await userRepository.save(newUser);

    // --- IMPLEMENTATION: Trigger Initial Leave Balance Creation Here ---
    try {
      console.log(
        `Triggering initial leave balance creation for user ID ${createdUser.user_id}, Role: ${role.name}...`
      );


      // Get the specific balance rules for the created user's role using the IMPORTED mapping
      const balancesToCreate =
        roleInitialBalances[createdUser.role.role_id] || []; // Default to empty array if role not in map

      if (balancesToCreate.length > 0) {
        const currentYear = new Date().getFullYear(); // Get the current year

        // Fetch the LeaveType entities needed based on the names in the rules
        const leaveTypeNames = balancesToCreate.map((b) => b.leaveTypeName);
        const leaveTypes = await leaveTypeRepository.find({
          where: leaveTypeNames.map((name) => ({ name })), // Find LeaveTypes by name
          select: ["type_id", "name"] // Select necessary fields
        });

        if (leaveTypes.length !== leaveTypeNames.length) {
          console.warn(
            `createUserHandler: Could not find all required leave types for role ${
              role.name
            }. Missing types: ${leaveTypeNames
              .filter((name) => !leaveTypes.find((lt) => lt.name === name))
              .join(", ")}`
          ); // Decide how to handle this: proceed with available types, or return an error? // For now, we'll proceed with only the found types.
        }

        const newBalances: LeaveBalance[] = [];
        const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.name, lt])); // Map names to entities

        // Create LeaveBalance entities for the new user based on the rules and fetched LeaveTypes
        for (const balanceRule of balancesToCreate) {
          const leaveType = leaveTypeMap.get(balanceRule.leaveTypeName);

          if (leaveType) {
            // Only create balance if the LeaveType was found
            const newBalance = new LeaveBalance();
            newBalance.user = createdUser; // Link the balance to the new user // OR if your LeaveBalance entity stores user_id: newBalance.user_id = createdUser.user_id;
            newBalance.user_id = createdUser.user_id; // Explicitly set user_id
            newBalance.leaveType = leaveType; // Link the balance to the leave type // OR if your LeaveBalance entity stores type_id: newBalance.type_id = leaveType.type_id;
            newBalance.type_id = leaveType.type_id; // Explicitly set type_id
            newBalance.year = currentYear; // Set the current year

                // Ensure values are numbers and format to 2 decimal places for DECIMAL(10,2)
            newBalance.total_days = Number(balanceRule.initialDays).toFixed(2); // Ensure number, format to 2 decimals
            newBalance.used_days = Number(0).toFixed(2); // Ensure number, format to 2 decimals
            newBalance.available_days = Number(balanceRule.initialDays).toFixed(2); // Ensure number, format to 2 decimals


            newBalances.push(newBalance);
          } else {
            console.warn(
              `createUserHandler: Skipping balance creation for missing leave type: ${balanceRule.leaveTypeName}`
            );
          }
        }

        if (newBalances.length > 0) {
          // Save the newly created leave balance entities to the database
          await leaveBalanceRepository.save(newBalances); // <-- Save the array of balances
//           console.log(
//             `createUserHandler: Successfully created ${newBalances.length} initial leave balances for user ID ${createdUser.user_id}.`
//           );
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
      // Catch errors specific to the balance creation process
      console.error(
        `createUserHandler: Error during initial leave balance creation for user ID ${createdUser.user_id}:`,
        balanceError
      ); // Decide if a balance creation failure should prevent user creation success. // Generally, user creation success should be reported, and balance creation failure logged. // You might add a warning message to the success response later.
    }
    const userResponse: UserResponse = {
      // Explicitly type the response object
      user_id: createdUser.user_id,
      name: createdUser.name,
      email: createdUser.email,
      role_id: createdUser.role.role_id, // Get role_id from the related Role entity
      manager_id: createdUser.manager_id,
      role: {
        // Include nested role details
        role_id: role.role_id, // Correct: Access role_id directly from the fetched role object
        name: role.name,
      },
    };

    res.status(201).json(userResponse);
    return; // Exit handler
  } catch (error: any) {
    // --- Handle Errors during User Creation (before balance trigger) ---
    console.error("Error creating new user (before balance trigger):", error); // Handle specific database errors (e.g., unique constraint on email)
    if (
      error.code === "ER_DUP_ENTRY" ||
      (error.detail && error.detail.includes("already exists"))
    ) {
      // Example codes for duplicate entry
      res
        .status(409)
        .json({ message: `User with email '${email.trim()}' already exists.` }); // 409 Conflict
      return; // Exit handler
    }
    // Handle other errors with a 500 Internal Server Error response
    res.status(500).json({ message: "Internal server error creating user." });
    return; // Exit handler
  }
};

const getUsersHandler: RequestHandler<
  {}, // Req Params (none)
  UserWithBalancesResponse[] | ErrorResponse, // Res Body: array of UserResponse objects OR error message
  {}, // Req Body (none for GET)
  GetUsersQueryParams // Req Query: { role_id?: string }
> = async (req: AuthenticatedRequest, res): Promise<void> => { // Async handler returns Promise<void>
    // Ensure user and their role ID are available from the protect middleware
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id;

    //console.log(`--- Admin user ${admin_user_id} accessing /api/admin/users ---`);


    // If authentication failed or user info is missing (should be caught by protect, but defensive check)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res.status(401).json({ message: "Authentication failed." });
        return; // Exit handler
    }

    // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== ADMIN_ROLE_ID) {
        // Log the unauthorized attempt
        console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access user list.`);
        // Send 403 Forbidden status
        res.status(403).json({ message: "Forbidden: You do not have sufficient permissions to view this resource." });
        return; // Exit handler
    }
    // --- End Role Check ---

    const roleIdParam = req.query.role_id;
    // Convert the role_id query parameter to a number, if it exists and is a valid number
    const filterRoleId = roleIdParam ? parseInt(roleIdParam.toString(), 10) : undefined; // Use toString() and check isNaN


    try {
        // Build query options
        const findOptions: FindManyOptions<User> = {
          relations: ["role"], // Eager load the role entity to get the role name
          order: { name: "ASC" }, // Order users by name
          where: {}, // Start with empty where clause
        };

        // Add role filter if provided
        if (filterRoleId !== undefined && !isNaN(filterRoleId)) { // <-- Ensure it's a valid number
            findOptions.where = { role_id: filterRoleId };
//             console.log(`Workspaceing users with Role ID filter: ${filterRoleId}`);
        } else if (roleIdParam !== undefined) { // If role_id was provided but wasn't a valid number
            console.warn(`Admin user ${admin_user_id} provided invalid role_id query parameter: ${roleIdParam}`);
            res.status(400).json({ message: "Invalid role_id provided in query parameters. Must be a number." }); // Bad Request
            return;
        }
        else {
            //  console.log("Fetching all users (no role filter).");
        }


        // Fetch users from the database. Include the 'role' relation.
        const users = await userRepository.find(findOptions);
        //console.log(`Workspaceed ${users.length} users.`);

        const usersWithBalances: UserWithBalancesResponse[] = [];
        const currentYear = new Date().getFullYear(); // Get current year for balance fetch

        // --- Fetch Leave Balances for each user ---
        // Fetch all relevant balances in one go if possible for performance
        const userIds = users.map(user => user.user_id);
        if (userIds.length > 0) { // Only query if there are users
            const allRelevantBalances = await leaveBalanceRepository.find({
                where: {
                    user_id: In(userIds), // Use TypeORM's In operator
                    year: currentYear
                },
                relations: ["leaveType"],
                select: ["balance_id", "user_id", "total_days", "used_days", "year", "leaveType"] // Select fields, including relation
            });

            // Group balances by user_id for easier lookup
            const balancesByUser = new Map<number, typeof allRelevantBalances>();
            for (const balance of allRelevantBalances) {
                if (!balancesByUser.has(balance.user_id)) {
                    balancesByUser.set(balance.user_id, []);
                }
                balancesByUser.get(balance.user_id)?.push(balance);
            }

            // Process each user and attach their balances
            for (const user of users) {
                 const userBalances = balancesByUser.get(user.user_id) || [];

                 // Map balances to the desired format for the frontend response
                 const formattedBalances = userBalances.map(balance => ({
                     leaveTypeName: balance.leaveType.name, // Get name from the related entity
                     // Ensure values are treated as numbers for calculation/display
                     totalDays: parseFloat(balance.total_days as any),
                     usedDays: parseFloat(balance.used_days as any),
                     availableDays: parseFloat(balance.total_days as any) - parseFloat(balance.used_days as any),
                     year: balance.year // Include the year
                 }));

                 // Construct the user object including formatted balances
                 const userWithBalance: UserWithBalancesResponse = {
                     user_id: user.user_id,
                     name: user.name,
                     email: user.email,
                     role_id: user.role.role_id,
                     manager_id: user.manager_id, // Include manager_id
                     // Include the role details - Access the loaded relation
                     role: {
                         role_id: user.role.role_id,
                         name: user.role.name,
                     },
                     leaveBalances: formattedBalances, // Add the fetched and formatted balances
                     // Add other user properties if needed from the fetched 'user' entity
                 };

                 usersWithBalances.push(userWithBalance);
            }

        } // If no users found, usersWithBalances remains empty


        //console.log(`Prepared response for ${usersWithBalances.length} users including balances.`);


        // Send the list of users (with balances) back
        res.status(200).json(usersWithBalances);
        return; // Exit handler

    } catch (error) {
        // Catch any errors during the database query
        console.error("Error fetching users for admin:", error);
        // Send a 500 Internal Server Error response
        res.status(500).json({ message: "Internal server error fetching users." });
        return; // Exit handler
    }
};

// 

const getAdminApprovalsHandler: RequestHandler<
  {}, // Req Params (none)
  Leave[] | ErrorResponse, // Res Body: array of Leave objects (including user and leaveType relations) or ErrorResponse
  {}, // Req Body (none for GET)
  {} // Req Query (none for this endpoint)
> = async (req: AuthenticatedRequest, res): Promise<void> => {

  const admin_user_id = req.user?.user_id;
  const admin_user_role_id = req.user?.role_id;

  //console.log(`--- Admin user ${admin_user_id} accessing leave requests needing Admin approval ---`);

  // If authentication failed or user info is missing (should be handled by middleware)
  if (admin_user_id === undefined || admin_user_role_id === undefined) {
    res.status(401).json({ message: "Authentication failed." });
    return;
  }

  // --- Role Check: Allow only Admin ---
  if (admin_user_role_id !== ADMIN_ROLE_ID) {
    console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access Admin approval list.`);
    res.status(403).json({ message: "Forbidden: You do not have sufficient permissions to view this resource." });
    return;
  }
  // --- End Role Check ---

  try {
    const leavesNeedingAdminApproval = await leaveRepository.find({
      where: [ // Use an array for OR conditions
            { status: LeaveStatus.Awaiting_Admin_Approval }, // Condition 1: Status is Awaiting_Admin_Approval
            { // Condition 2: Status is Pending AND user is Manager
                status: LeaveStatus.Pending,
                 user: { role_id: MANAGER_ROLE_ID } // Filter by Manager role via the user relation
            }
         ],
      relations: ["user", "leaveType"], // Eager load user and leaveType relations for display
      order: { applied_at: "ASC" }, // Order by application date ascending
    });

    //console.log(`Workspaceed ${leavesNeedingAdminApproval.length} leave requests needing Admin approval.`);

    // Send the list in the response
    res.status(200).json(leavesNeedingAdminApproval);
    return;

  } catch (error) {
    console.error(`Admin ${admin_user_id}: Error fetching leave requests needing Admin approval:`, error);
    res.status(500).json({ message: "Internal server error fetching leave requests." });
    return;
  }
};

router.get('/leave-requests/approvals-needed', protect, getAdminApprovalsHandler); // <-- Register the new route

const updateLeaveStatusByAdminHandler: RequestHandler<
    { id: string }, // Req Params (expecting leave ID in the URL)
    { message: string, leaveId: number, newStatus: LeaveStatus } | { message: string }, // Res Body (success or error)
    { status: 'Approved' | 'Rejected', comments?: string }, // Req Body (expecting 'Approved' or 'Rejected')
    {} // Req Query
> = async (req: AuthenticatedRequest, res): Promise<void> => {

    // Assuming req.user is populated by the 'protect' middleware
    const loggedInUser = req.user;
    const admin_user_id = loggedInUser?.user_id; // The Admin user performing the action
    const admin_role_id = loggedInUser?.role_id; // The role of the Admin user

    const leaveId = parseInt(req.params.id, 10);
     // Use the request body type interface (if defined in adminRoutes too, otherwise assert string type)
    const { status, comments } = req.body; // Get the status and comments from the request body

    //console.log(`--- Admin ${admin_user_id} (Role: ${admin_role_id}) attempting to update status of leave ${leaveId} via /api/admin/leave-requests/:id/status ---`);

    // --- Role Check: Only Admins can use this handler ---
    if (!loggedInUser || !admin_user_id || admin_role_id !== ADMIN_ROLE_ID) {
         console.error(`User ${admin_user_id} with role ${admin_role_id} attempted to use Admin status update endpoint.`);
         res.status(403).json({ message: "Forbidden: Only admins can perform this action on this endpoint." });
         return;
    }

    // Validate incoming status from request body (redundant if using strict TypeScript + interface, but defensive)
    // The expected status from Admin is 'Approved' or 'Rejected'
    if (status !== 'Approved' && status !== 'Rejected') {
         console.warn(`Admin ${admin_user_id}: Invalid status received: ${status} for leave ${leaveId}.`);
         res.status(400).json({ message: "Invalid status provided in the request body." });
         return;
    }


    try {
        const leaveRequest = await leaveRepository.findOne({
            where: [
                { leave_id: leaveId, status: LeaveStatus.Pending }, // Manager self-requests
                { leave_id: leaveId, status: LeaveStatus.Awaiting_Admin_Approval } // Long Employee/Intern leaves after Manager approval
            ],
            relations: ["user", "leaveType"], // Ensure user and leaveType are loaded
        });

        // If leave request not found, or is not in a status processable by Admin
        if (!leaveRequest) {
            console.warn(`Admin ${admin_user_id}: Leave request ${leaveId} not found or is not in a processable status for Admin.`);
            res.status(404).json({ message: "Leave request not found or has already been processed." });
            return;
        }

        // --- Implement Admin Approval/Rejection Logic ---
        const oldStatus = leaveRequest.status; // Store old status for logging/transitions

        //console.log(`Admin ${admin_user_id}: Processing leave ${leaveId} (current status ${oldStatus}), Admin action: ${status}.`);

        let newStatus: LeaveStatus; // Variable to hold the determined new status

        if (status === 'Approved') {
            // The Admin is APPROVING the request. This is always a final approval for leaves in Admin-processable statuses.
            newStatus = LeaveStatus.Approved;
            //console.log(`Leave ${leaveId} admin approved -> status set to '${newStatus}'.`);

             try {
                 const leaveType = leaveRequest.leaveType; // Already eager loaded

                 if (!leaveType) {
                      console.error(`Admin ${admin_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`);
                      // Log error, decide how to handle. For now, proceed without balance update.
                 } else if (leaveType.requires_approval) {
                     const leaveYear = new Date(leaveRequest.start_date).getFullYear(); // Assuming balance is yearly

                     let userBalance = await leaveBalanceRepository.findOne({
                         where: { user_id: leaveRequest.user_id, type_id: leaveRequest.type_id, year: leaveYear }
                     });

                     if (userBalance) {
                         // Calculate working days for the specific leave request using the utility function
                         // Ensure you pass Date objects if calculateWorkingDays takes Dates
                         const actualWorkingDaysOnLeave = calculateWorkingDays(new Date(leaveRequest.start_date), new Date(leaveRequest.end_date));


                         // Convert Decimal strings to numbers before calculation
                         const currentUsedDays = parseFloat(userBalance.used_days as any);

                         // Deduct the working days from the balance
                         const updatedUsedDays = currentUsedDays + actualWorkingDaysOnLeave;

                         userBalance.used_days = updatedUsedDays.toFixed(2).toString(); // Update used days (store back as string)
                         // Note: processed_at/processed_by_id are NOT on LeaveBalance entity - removed those lines.

                         await leaveBalanceRepository.save(userBalance); // Save updated balance
                         //console.log(`Admin ${admin_user_id}: Updated leave balance for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Used days now: ${userBalance.used_days}`);

                     } else {
                         console.error(`Admin ${admin_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`);
                         // Log error, decide how to handle. For now, proceed without balance update.
                     }
                 } else {
                      //console.log(`Admin ${admin_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`);
                 }
             } catch (balanceError: any) { // Explicitly type catch error
                 console.error(`Admin ${admin_user_id}: Error during leave balance update for leave ${leaveId}:`, balanceError);
             }


        } else if (status === 'Rejected') {
            // The Admin is REJECTING the request. This is a final status.
            newStatus = LeaveStatus.Rejected;
            //console.log(`Leave ${leaveId} rejected by Admin -> status set to '${newStatus}'.`);
            // No balance update needed for rejection
        } else {
             // Should not happen due to the request body type, but defensive
             console.error(`Admin ${admin_user_id}: Unexpected status '${status}' received for leave ${leaveId}.`);
             res.status(500).json({ message: "Internal server error: Unexpected input status." });
             return; // Exit the handler
        }
        // --- End Admin Approval/Rejection Logic ---

        // Update the leave request object with the determined new status and processor details
        leaveRequest.status = newStatus; // Set the status based on the logic above
        leaveRequest.processed_by_id = admin_user_id; // Store the Admin's user ID
        leaveRequest.processed_at = new Date(); // Record processing timestamp

        if (
            (oldStatus === LeaveStatus.Pending || oldStatus === LeaveStatus.Awaiting_Admin_Approval) &&
            (newStatus === LeaveStatus.Approved || newStatus === LeaveStatus.Rejected)
        ) {
            if (leaveApprovalRepository && admin_user_id) {
                 try {
                     const newApproval = new LeaveApproval();
                     newApproval.leave_id = leaveRequest.leave_id; // Use the leave ID from the updated request
                     newApproval.approver_id = admin_user_id; // The Admin user's ID
                     // Determine the action type for the log based on the NEW status
                     newApproval.action = (newStatus === LeaveStatus.Approved) ? ApprovalAction.Approved : ApprovalAction.Rejected;
                     newApproval.comments = comments; // Include comments if provided

                     await leaveApprovalRepository.save(newApproval);
                     //console.log(`Admin ${admin_user_id}: Action '${newApproval.action}' logged for leave ${leaveRequest.leave_id} by approver ${admin_user_id}.`);

                 } catch (logError) {
                     console.error(`Admin ${admin_user_id}: Error logging approval action for leave ${leaveId}:`, logError);
                     // Log the error, but don't necessarily fail the status update itself
                 }
            } else {
                 console.warn(`Admin ${admin_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or admin_user_id missing.`);
            }
        }
        await leaveRepository.save(leaveRequest);

        //console.log(`Leave request ${leaveId} final status after Admin processing: ${leaveRequest.status}.`);

        // Send success response back to the frontend
        res.status(200).json({
            message: `Leave request ${leaveId} status updated to ${leaveRequest.status}`,
            leaveId: leaveRequest.leave_id,
            newStatus: leaveRequest.status // Return the *actual* new status that was set
        });
        return;


    } catch (error: any) { // Explicitly type catch error
        console.error(`Admin ${admin_user_id}: Error processing leave request ID ${leaveId}:`, error);
        res.status(500).json({ message: "Internal server error processing leave request." });
        return; // Explicit return
    }
};

router.put('/leave-requests/:id/status', protect, updateLeaveStatusByAdminHandler);


const deleteLeaveTypeHandler: RequestHandler<
  { id: string }, // Req Params (expecting leave type ID in the URL)
  { message: string } | ErrorResponse, // Res Body (success message or error)
  {}, // Req Body (none for DELETE)
  {} // Req Query (none)
> = async (req: AuthenticatedRequest, res): Promise<void> => {

    const admin_user_id = req.user?.user_id;
    const admin_role_id = req.user?.role_id;

    const leaveTypeId = parseInt(req.params.id, 10);

    //console.log(`--- Admin ${admin_user_id} (Role: ${admin_role_id}) attempting to delete leave type ${leaveTypeId} ---`);

    if (!req.user || !admin_user_id || admin_role_id !== ADMIN_ROLE_ID) {
        console.error(`User ${admin_user_id} with role ${admin_role_id} attempted to use delete leave type endpoint.`);
        res.status(403).json({ message: "Forbidden: Only admins can delete leave types." });
        return;
    }

    // Basic validation for the ID from the URL
    if (isNaN(leaveTypeId)) {
        console.warn(`Admin ${admin_user_id}: Invalid leave type ID provided for deletion: ${req.params.id}`);
        res.status(400).json({ message: "Invalid leave type ID provided." });
        return;
    }

    try {

        // Check the Leave table
        const existingLeaves = await leaveRepository.count({ where: { type_id: leaveTypeId } });
        if (existingLeaves > 0) {
            console.warn(`Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which is in use by ${existingLeaves} leave requests.`);
            // Use status 409 Conflict to indicate resource conflict
            res.status(409).json({ message: "Cannot delete leave type: it is used by existing leave requests." });
            return;
        }

        // Check the LeaveBalance table
        const existingBalances = await leaveBalanceRepository.count({ where: { type_id: leaveTypeId } });
        if (existingBalances > 0) {
            console.warn(`Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which is in use by ${existingBalances} leave balances.`);
            // Use status 409 Conflict
            res.status(409).json({ message: "Cannot delete leave type: it is used by existing leave balances." });
            return;
        }

        // If the leave type is not in use, proceed with deletion
        const deleteResult = await leaveTypeRepository.delete(leaveTypeId);

        // Check if a row was actually affected (means the leave type existed)
        if (deleteResult.affected === 0) {
            console.warn(`Admin ${admin_user_id}: Attempted to delete leave type ${leaveTypeId} which was not found.`);
            // Use status 404 Not Found if the type didn't exist
            res.status(404).json({ message: "Leave type not found." });
            return;
        }

        //console.log(`Admin ${admin_user_id}: Successfully deleted leave type ${leaveTypeId}.`);
        res.status(200).json({ message: "Leave type deleted successfully." });
        return;

    } catch (error) {
        console.error(`Admin ${admin_user_id}: Error deleting leave type ${leaveTypeId}:`, error);
        // Log the specific error if needed for debugging
        // If it's a database error not caught by the usage checks above, it will be a 500 error
        res.status(500).json({ message: "Internal server error deleting leave type." });
        return;
    }
};

router.delete('/leave-types/:id', protect, deleteLeaveTypeHandler);

// Route to get list of leave types (for Admin use, e.g., in dropdowns for admin forms)
router.get("/leave-types", protect, getLeaveTypesForAdminHandler);

// Route to create a new leave type
router.post("/leave-types", protect, createLeaveTypeHandler);

// Route to create a new user
router.post("/users", protect, createUserHandler);

// Route to get a list of users (with optional role filter) - UNCOMMENTED AND USING CORRECT HANDLER
router.get("/users", protect, getUsersHandler);

export { router as adminRoutes };