"use strict";
// src/routes/adminRoutes.ts - COMPLETE & CORRECTED
// my-leave-app-backend/src/routes/adminRoutes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
console.log("--- Loading adminRoutes.ts ---"); // Keep this log
const express_1 = __importDefault(require("express"));
// Import TypeORM data source and entities
const data_source_1 = require("../data-source");
const LeaveType_1 = require("../entity/LeaveType"); // Import the LeaveType entity
const LeaveBalance_1 = require("../entity/LeaveBalance"); // Import LeaveBalance entity
const User_1 = require("../entity/User"); // Import the User entity for user management
const Role_1 = require("../entity/Role"); // Import the Role entity for user management
const typeorm_1 = require("typeorm"); // Import FindManyOptions for TypeORM queries
const Leave_1 = require("../entity/Leave");
const LeaveApproval_1 = require("../entity/LeaveApproval");
// --- IMPORT Constants from the new file ---
// This line is added to import constants and the mapping from constants.ts
const constants_1 = require("../constants");
// --- END IMPORT Constants ---
// Use bcryptjs consistently for password hashing
const bcryptjs_1 = __importDefault(require("bcryptjs")); // Use bcryptjs
// Import authentication middleware and types
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
// --- End Interfaces ---
// Create an Express router instance for admin routes
const router = express_1.default.Router();
exports.adminRoutes = router;
// --- ADDED LOG AT THE START OF THE ROUTER (Keep this) ---
router.use((req, res, next) => {
    console.log("--- Admin Router Received Request:", req.method, req.originalUrl);
    next(); // Pass the request to the next middleware or route handler
});
// --- END ADDED LOG ---
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
// --- Get TypeORM Repositories ---
// Access the repositories for interacting with the database entities
const leaveTypeRepository = data_source_1.AppDataSource.getRepository(LeaveType_1.LeaveType); // Repository for LeaveType entity
const leaveBalanceRepository = data_source_1.AppDataSource.getRepository(LeaveBalance_1.LeaveBalance); // Get LeaveBalance Repository
const userRepository = data_source_1.AppDataSource.getRepository(User_1.User); // Repository for User entity
const roleRepository = data_source_1.AppDataSource.getRepository(Role_1.Role); // Repository for Role entity
const leaveRepository = data_source_1.AppDataSource.getRepository(Leave_1.Leave);
const leaveApprovalRepository = data_source_1.AppDataSource.getRepository(LeaveApproval_1.LeaveApproval);
// --- Handler for GET /api/admin/leave-types - Get all leave types (Admin Only) ---
// Endpoint: GET /api/admin/leave-types
// Requires 'protect' middleware for authentication
const getLeaveTypesForAdminHandler = async (req, res) => {
    // Async handler returns Promise<void>
    // Ensure user and their role ID are available from the protect middleware
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id; // If authentication failed or user info is missing (should be caught by protect, but defensive check)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res
            .status(401)
            .json({ message: "Authentication failed or user information missing." });
        return; // Exit handler
    } // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== constants_1.ADMIN_ROLE_ID) {
        // Log the unauthorized attempt (optional but good practice)
        console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access admin leave types list.`); // Send 403 Forbidden status
        res.status(403).json({
            message: "Forbidden: You do not have sufficient permissions to view this resource.",
        });
        return; // Exit handler
    } // --- End Role Check ---
    try {
        // Fetch all leave types from the database using the repository
        const leaveTypes = await leaveTypeRepository.find({
            order: { name: "ASC" }, // Optional: order results by name alphabetically
        }); // Send the list of leave types in the response with 200 OK status
        res.status(200).json(leaveTypes);
        return; // Exit handler
    }
    catch (error) {
        // Catch any errors during the database query
        console.error("Error fetching all leave types for admin:", error); // Send a 500 Internal Server Error response
        res
            .status(500)
            .json({ message: "Internal server error fetching leave types" });
        return; // Exit handler
    }
};
// --- Handler for POST /api/admin/leave-types - Create a new leave type (Admin Only) ---
// Endpoint: POST /api/admin/leave-types
// Requires 'protect' middleware for authentication
const createLeaveTypeHandler = async (req, res) => {
    // Async handler returns Promise<void>
    // Ensure user and their role ID are available from the protect middleware (the Admin performing the action)
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id;
    // Destructure data for the new leave type from the request body
    const { name, requires_approval, is_balance_based } = req.body;
    // If authentication failed or user info missing (should be caught by protect, but defensive check)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res.status(401).json({ message: "Authentication failed." });
        return; // Exit handler
    } // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== constants_1.ADMIN_ROLE_ID) {
        // Log the unauthorized attempt
        console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a leave type.`); // Send 403 Forbidden status
        res.status(403).json({
            message: "Forbidden: You do not have sufficient permissions to perform this action.",
        });
        return; // Exit handler
    } // --- End Role Check ---
    // --- Input Validation ---
    // Check if required fields are present and have the correct types
    if (!name ||
        typeof requires_approval !== "boolean" ||
        typeof is_balance_based !== "boolean") {
        res.status(400).json({
            message: "Missing required fields (name, requires_approval, is_balance_based) or invalid types.",
        }); // 400 Bad Request
        return; // Exit handler
    }
    // TODO: Add validation to check if name is not empty string after trim
    try {
        // TODO: Add a check to see if a leave type with this name already exists (409 Conflict)
        // --- Create New LeaveType Entity ---
        // Create a new instance of the LeaveType entity
        const newLeaveType = new LeaveType_1.LeaveType();
        // Assign properties from the request body
        newLeaveType.name = name.trim(); // Trim whitespace
        newLeaveType.requires_approval = requires_approval;
        newLeaveType.is_balance_based = is_balance_based; // Set other properties if your LeaveType entity has them
        // --- Save New LeaveType ---
        // Save the new leave type entity to the database
        const createdLeaveType = await leaveTypeRepository.save(newLeaveType);
        // Log the successful creation (optional)
        console.log(`Admin user ${admin_user_id} created new leave type: ${name} (ID: ${createdLeaveType.type_id})`);
        // --- Send Success Response ---
        // Respond with a 201 Created status and the created LeaveType object
        res.status(201).json(createdLeaveType);
        return; // Exit handler
    }
    catch (error) {
        // --- Handle Errors ---
        console.error("Error creating new leave type:", error); // Check for specific database errors, e.g., unique constraint violation on name
        if (error.code === "ER_DUP_ENTRY") {
            // Example MySQL error code for duplicate entry
            res.status(409).json({
                message: `Leave type with name '${name.trim()}' already exists.`,
            }); // 409 Conflict
            return; // Exit handler
        }
        // Handle other errors with a 500 Internal Server Error response
        res
            .status(500)
            .json({ message: "Internal server error creating leave type." });
        return; // Exit handler
    }
};
// --- Handler for POST /api/admin/users - Create a new user (Admin Only) ---
// Endpoint: POST /api/admin/users
// Requires 'protect' middleware for authentication
const createUserHandler = async (req, res) => {
    // Async handler returns Promise<void>
    // Ensure user and their role ID are available from the protect middleware (the Admin performing the action)
    console.log("--- Inside createUserHandler ---");
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id;
    // Destructure data for the new user from the request body
    const { name, email, password, role_id, manager_id = null } = req.body; // manager_id is optional, default to null
    // If authentication failed or user info missing (should be caught by protect, but defensive check)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res.status(401).json({ message: "Authentication failed." });
        return; // Exit handler
    } // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== constants_1.ADMIN_ROLE_ID) {
        // Log the unauthorized attempt
        console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to create a user.`); // Send 403 Forbidden status
        res.status(403).json({
            message: "Forbidden: You do not have sufficient permissions to perform this action.",
        });
        return; // Exit handler
    } // --- End Role Check ---
    // --- Input Validation ---
    // Check if required fields are present
    if (!name || !email || !password || role_id === undefined) {
        res.status(400).json({
            message: "Missing required fields (name, email, password, role_id).",
        }); // 400 Bad Request
        return; // Exit handler
    }
    // TODO: Add more robust validation (email format, password strength)
    try {
        // --- Check for Existing User ---
        // Query the database to see if a user with the provided email already exists
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
        // TODO: Validate manager_id if provided (must exist and have Manager role)
        // If manager_id is provided and not null, check if a user with that ID exists and is a Manager
        // const manager = await userRepository.findOne({ where: { user_id: manager_id, role_id: MANAGER_ROLE_ID } });
        // if (manager_id !== null && manager_id !== undefined && !manager) { ... error response ... } // Handle manager_id validation
        // --- Hash Password ---
        // Generate a salt and hash the plaintext password
        const salt = await bcryptjs_1.default.genSalt(10); // Recommended salt rounds for bcryptjs
        const hashedPassword = await bcryptjs_1.default.hash(password, salt); // Use bcryptjs.hash
        // --- Create New User Entity ---
        // Create a new instance of the User entity
        const newUser = new User_1.User();
        // Assign properties from the request body
        newUser.name = name.trim(); // Trim whitespace
        newUser.email = email.trim(); // Trim whitespace
        newUser.password_hash = hashedPassword; // Store the hashed password
        newUser.role = role; // Assign the fetched Role entity (assuming ManyToOne relationship)
        // OR if your User entity just stores role_id: newUser.role_id = role_id;
        newUser.manager_id = manager_id; // Assign manager_id (can be null or a valid manager's user_id)
        // --- Save New User ---
        // Save the new user entity to the database
        const createdUser = await userRepository.save(newUser);
        // Log the successful creation (optional)
        console.log(`Admin user ${admin_user_id} created new user: ${createdUser.email} (ID: ${createdUser.user_id}, Role: ${role.name})`);
        // --- IMPLEMENTATION: Trigger Initial Leave Balance Creation Here ---
        try {
            console.log(`Triggering initial leave balance creation for user ID ${createdUser.user_id}, Role: ${role.name}...`);
            // --- REMOVE Local roleInitialBalances Mapping ---
            // Use the imported mapping from constants.ts instead
            /*
            const roleInitialBalances: {
              [roleId: number]: { leaveTypeName: string; initialDays: number }[];
            } = { ... }; // REMOVE THIS LOCAL DEFINITION
            */
            // --- End REMOVE ---
            // Get the specific balance rules for the created user's role using the IMPORTED mapping
            const balancesToCreate = constants_1.roleInitialBalances[createdUser.role.role_id] || []; // Default to empty array if role not in map
            if (balancesToCreate.length > 0) {
                const currentYear = new Date().getFullYear(); // Get the current year
                // Fetch the LeaveType entities needed based on the names in the rules
                const leaveTypeNames = balancesToCreate.map((b) => b.leaveTypeName);
                const leaveTypes = await leaveTypeRepository.find({
                    where: leaveTypeNames.map((name) => ({ name })), // Find LeaveTypes by name
                    select: ["type_id", "name"] // Select necessary fields
                });
                if (leaveTypes.length !== leaveTypeNames.length) {
                    console.warn(`createUserHandler: Could not find all required leave types for role ${role.name}. Missing types: ${leaveTypeNames
                        .filter((name) => !leaveTypes.find((lt) => lt.name === name))
                        .join(", ")}`); // Decide how to handle this: proceed with available types, or return an error? // For now, we'll proceed with only the found types.
                }
                const newBalances = [];
                const leaveTypeMap = new Map(leaveTypes.map((lt) => [lt.name, lt])); // Map names to entities
                // Create LeaveBalance entities for the new user based on the rules and fetched LeaveTypes
                for (const balanceRule of balancesToCreate) {
                    const leaveType = leaveTypeMap.get(balanceRule.leaveTypeName);
                    if (leaveType) {
                        // Only create balance if the LeaveType was found
                        const newBalance = new LeaveBalance_1.LeaveBalance();
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
                    }
                    else {
                        console.warn(`createUserHandler: Skipping balance creation for missing leave type: ${balanceRule.leaveTypeName}`);
                    }
                }
                if (newBalances.length > 0) {
                    // Save the newly created leave balance entities to the database
                    await leaveBalanceRepository.save(newBalances); // <-- Save the array of balances
                    console.log(`createUserHandler: Successfully created ${newBalances.length} initial leave balances for user ID ${createdUser.user_id}.`);
                }
                else {
                    console.log(`createUserHandler: No initial leave balance rules defined for role ${role.name}. Skipping balance creation.`);
                }
            }
            else {
                console.log(`createUserHandler: No initial leave balance rules defined for role ${role.name}. Skipping balance creation.`);
            }
        }
        catch (balanceError) {
            // Catch errors specific to the balance creation process
            console.error(`createUserHandler: Error during initial leave balance creation for user ID ${createdUser.user_id}:`, balanceError); // Decide if a balance creation failure should prevent user creation success. // Generally, user creation success should be reported, and balance creation failure logged. // You might add a warning message to the success response later.
        }
        // --- End IMPLEMENTATION: Trigger Initial Leave Balance Creation ---
        // --- Send Success Response ---
        // Send the created user object back in the response (EXCLUDE password_hash)
        // Create a plain object copy to control which properties are sent
        const userResponse = {
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
            }, // Add other properties from UserResponse interface here if needed // e.g., created_at: createdUser.created_at,
        };
        // Respond with a 201 Created status and the user response object
        res.status(201).json(userResponse);
        return; // Exit handler
    }
    catch (error) {
        // --- Handle Errors during User Creation (before balance trigger) ---
        console.error("Error creating new user (before balance trigger):", error); // Handle specific database errors (e.g., unique constraint on email)
        if (error.code === "ER_DUP_ENTRY" ||
            (error.detail && error.detail.includes("already exists"))) {
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
// --- Handler for GET /api/admin/users - Get all users or filter by role (Admin Only) ---
// Endpoint: GET /api/admin/users?role_id=<role_id>
// Requires 'protect' middleware for authentication
// This handler replaces the commented-out getUsersAdminHandler
const getUsersHandler = async (req, res) => {
    // Ensure user and their role ID are available from the protect middleware
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id;
    console.log(`--- Admin user ${admin_user_id} accessing /api/admin/users ---`);
    // If authentication failed or user info is missing (should be caught by protect, but defensive check)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res.status(401).json({ message: "Authentication failed." });
        return; // Exit handler
    }
    // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== constants_1.ADMIN_ROLE_ID) {
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
        const findOptions = {
            relations: ["role"], // Eager load the role entity to get the role name
            order: { name: "ASC" }, // Order users by name
            where: {}, // Start with empty where clause
        };
        // Add role filter if provided
        if (filterRoleId !== undefined && !isNaN(filterRoleId)) { // <-- Ensure it's a valid number
            findOptions.where = { role_id: filterRoleId };
            console.log(`Workspaceing users with Role ID filter: ${filterRoleId}`);
        }
        else if (roleIdParam !== undefined) { // If role_id was provided but wasn't a valid number
            console.warn(`Admin user ${admin_user_id} provided invalid role_id query parameter: ${roleIdParam}`);
            res.status(400).json({ message: "Invalid role_id provided in query parameters. Must be a number." }); // Bad Request
            return;
        }
        else {
            console.log("Fetching all users (no role filter).");
        }
        // Fetch users from the database. Include the 'role' relation.
        const users = await userRepository.find(findOptions);
        console.log(`Workspaceed ${users.length} users.`);
        const usersWithBalances = [];
        const currentYear = new Date().getFullYear(); // Get current year for balance fetch
        // --- Fetch Leave Balances for each user ---
        // Fetch all relevant balances in one go if possible for performance
        const userIds = users.map(user => user.user_id);
        if (userIds.length > 0) { // Only query if there are users
            const allRelevantBalances = await leaveBalanceRepository.find({
                where: {
                    user_id: (0, typeorm_1.In)(userIds), // Use TypeORM's In operator
                    year: currentYear
                },
                relations: ["leaveType"],
                select: ["balance_id", "user_id", "total_days", "used_days", "year", "leaveType"] // Select fields, including relation
            });
            // Group balances by user_id for easier lookup
            const balancesByUser = new Map();
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
                    totalDays: parseFloat(balance.total_days),
                    usedDays: parseFloat(balance.used_days),
                    availableDays: parseFloat(balance.total_days) - parseFloat(balance.used_days),
                    year: balance.year // Include the year
                }));
                // Construct the user object including formatted balances
                const userWithBalance = {
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
        console.log(`Prepared response for ${usersWithBalances.length} users including balances.`);
        // Send the list of users (with balances) back
        res.status(200).json(usersWithBalances);
        return; // Exit handler
    }
    catch (error) {
        // Catch any errors during the database query
        console.error("Error fetching users for admin:", error);
        // Send a 500 Internal Server Error response
        res.status(500).json({ message: "Internal server error fetching users." });
        return; // Exit handler
    }
};
// 
const getAdminApprovalsHandler = async (req, res) => {
    const admin_user_id = req.user?.user_id;
    const admin_user_role_id = req.user?.role_id;
    console.log(`--- Admin user ${admin_user_id} accessing leave requests needing Admin approval ---`);
    // If authentication failed or user info is missing (should be handled by middleware)
    if (admin_user_id === undefined || admin_user_role_id === undefined) {
        res.status(401).json({ message: "Authentication failed." });
        return;
    }
    // --- Role Check: Allow only Admin ---
    if (admin_user_role_id !== constants_1.ADMIN_ROLE_ID) {
        console.warn(`User ${admin_user_id} (Role: ${admin_user_role_id}) attempted to access Admin approval list.`);
        res.status(403).json({ message: "Forbidden: You do not have sufficient permissions to view this resource." });
        return;
    }
    // --- End Role Check ---
    try {
        // Fetch leave requests that require Admin approval:
        // Use TypeORM's 'where' clause with an array of conditions at the top level,
        // which acts as an OR operator between the conditions.
        const leavesNeedingAdminApproval = await leaveRepository.find({
            where: [
                { status: Leave_1.LeaveStatus.Awaiting_Admin_Approval }, // Condition 1: Status is Awaiting_Admin_Approval
                {
                    status: Leave_1.LeaveStatus.Pending,
                    user: { role_id: constants_1.MANAGER_ROLE_ID } // Filter by Manager role via the user relation
                }
            ],
            relations: ["user", "leaveType"], // Eager load user and leaveType relations for display
            order: { applied_at: "ASC" }, // Order by application date ascending
        });
        console.log(`Workspaceed ${leavesNeedingAdminApproval.length} leave requests needing Admin approval.`);
        // Send the list in the response
        res.status(200).json(leavesNeedingAdminApproval);
        return;
    }
    catch (error) {
        console.error(`Admin ${admin_user_id}: Error fetching leave requests needing Admin approval:`, error);
        res.status(500).json({ message: "Internal server error fetching leave requests." });
        return;
    }
};
// --- Register the NEW Route ---
// Add this route registration within your router.get/post/put/delete calls in adminRoutes.ts
router.get('/leave-requests/approvals-needed', authMiddleware_1.default, getAdminApprovalsHandler); // <-- Register the new route
const updateLeaveStatusByAdminHandler = async (req, res) => {
    // Assuming req.user is populated by the 'protect' middleware
    const loggedInUser = req.user;
    const admin_user_id = loggedInUser?.user_id; // The Admin user performing the action
    const admin_role_id = loggedInUser?.role_id; // The role of the Admin user
    const leaveId = parseInt(req.params.id, 10);
    // Use the request body type interface (if defined in adminRoutes too, otherwise assert string type)
    const { status, comments } = req.body; // Get the status and comments from the request body
    console.log(`--- Admin ${admin_user_id} (Role: ${admin_role_id}) attempting to update status of leave ${leaveId} via /api/admin/leave-requests/:id/status ---`);
    // --- Role Check: Only Admins can use this handler ---
    if (!loggedInUser || !admin_user_id || admin_role_id !== constants_1.ADMIN_ROLE_ID) {
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
        // Find the leave request.
        // Admins process leaves that are 'Pending' (Manager self-requests)
        // or 'Awaiting_Admin_Approval' (long Employee/Intern leaves after Manager approval).
        // Eager load 'user' to check submitting user's role and 'leaveType' for balance logic.
        const leaveRequest = await leaveRepository.findOne({
            where: [
                { leave_id: leaveId, status: Leave_1.LeaveStatus.Pending }, // Manager self-requests
                { leave_id: leaveId, status: Leave_1.LeaveStatus.Awaiting_Admin_Approval } // Long Employee/Intern leaves after Manager approval
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
        console.log(`Admin ${admin_user_id}: Processing leave ${leaveId} (current status ${oldStatus}), Admin action: ${status}.`);
        let newStatus; // Variable to hold the determined new status
        if (status === 'Approved') {
            // The Admin is APPROVING the request. This is always a final approval for leaves in Admin-processable statuses.
            newStatus = Leave_1.LeaveStatus.Approved;
            console.log(`Leave ${leaveId} admin approved -> status set to '${newStatus}'.`);
            // --- Apply Leave Balance Logic here (as Admin approval is final) ---
            // This logic updates the used_days in the LeaveBalance table if balance-based.
            // Ensure you are calling your calculateWorkingDays function and removing the processed_at/processed_by_id assignments on userBalance.
            try {
                const leaveType = leaveRequest.leaveType; // Already eager loaded
                if (!leaveType) {
                    console.error(`Admin ${admin_user_id}: Balance update failed for leave ${leaveId}: LeaveType relation not loaded.`);
                    // Log error, decide how to handle. For now, proceed without balance update.
                }
                else if (leaveType.requires_approval) {
                    const leaveYear = new Date(leaveRequest.start_date).getFullYear(); // Assuming balance is yearly
                    let userBalance = await leaveBalanceRepository.findOne({
                        where: { user_id: leaveRequest.user_id, type_id: leaveRequest.type_id, year: leaveYear }
                    });
                    if (userBalance) {
                        // Calculate working days for the specific leave request using the utility function
                        // Ensure you pass Date objects if calculateWorkingDays takes Dates
                        const actualWorkingDaysOnLeave = calculateWorkingDays(new Date(leaveRequest.start_date), new Date(leaveRequest.end_date));
                        // Convert Decimal strings to numbers before calculation
                        const currentUsedDays = parseFloat(userBalance.used_days);
                        // Deduct the working days from the balance
                        const updatedUsedDays = currentUsedDays + actualWorkingDaysOnLeave;
                        userBalance.used_days = updatedUsedDays.toFixed(2).toString(); // Update used days (store back as string)
                        // Note: processed_at/processed_by_id are NOT on LeaveBalance entity - removed those lines.
                        await leaveBalanceRepository.save(userBalance); // Save updated balance
                        console.log(`Admin ${admin_user_id}: Updated leave balance for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Used days now: ${userBalance.used_days}`);
                    }
                    else {
                        console.error(`Admin ${admin_user_id}: Leave balance not found for user ${leaveRequest.user_id}, type ${leaveRequest.type_id}, year ${leaveYear}. Cannot update balance.`);
                        // Log error, decide how to handle. For now, proceed without balance update.
                    }
                }
                else {
                    console.log(`Admin ${admin_user_id}: Leave type ${leaveType?.name} is not balance-based. No balance update needed for leave ${leaveId}.`);
                }
            }
            catch (balanceError) { // Explicitly type catch error
                console.error(`Admin ${admin_user_id}: Error during leave balance update for leave ${leaveId}:`, balanceError);
            }
            // --- End Leave Balance Logic ---
        }
        else if (status === 'Rejected') {
            // The Admin is REJECTING the request. This is a final status.
            newStatus = Leave_1.LeaveStatus.Rejected;
            console.log(`Leave ${leaveId} rejected by Admin -> status set to '${newStatus}'.`);
            // No balance update needed for rejection
        }
        else {
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
        // --- Log Approval/Rejection Action ---
        // Log this action in the LeaveApproval table
        // Log if status was Pending or Awaiting_Admin_Approval and changed to Approved or Rejected
        if ((oldStatus === Leave_1.LeaveStatus.Pending || oldStatus === Leave_1.LeaveStatus.Awaiting_Admin_Approval) &&
            (newStatus === Leave_1.LeaveStatus.Approved || newStatus === Leave_1.LeaveStatus.Rejected)) {
            if (leaveApprovalRepository && admin_user_id) {
                try {
                    const newApproval = new LeaveApproval_1.LeaveApproval();
                    newApproval.leave_id = leaveRequest.leave_id; // Use the leave ID from the updated request
                    newApproval.approver_id = admin_user_id; // The Admin user's ID
                    // Determine the action type for the log based on the NEW status
                    newApproval.action = (newStatus === Leave_1.LeaveStatus.Approved) ? LeaveApproval_1.ApprovalAction.Approved : LeaveApproval_1.ApprovalAction.Rejected;
                    newApproval.comments = comments; // Include comments if provided
                    await leaveApprovalRepository.save(newApproval);
                    console.log(`Admin ${admin_user_id}: Action '${newApproval.action}' logged for leave ${leaveRequest.leave_id} by approver ${admin_user_id}.`);
                }
                catch (logError) {
                    console.error(`Admin ${admin_user_id}: Error logging approval action for leave ${leaveId}:`, logError);
                    // Log the error, but don't necessarily fail the status update itself
                }
            }
            else {
                console.warn(`Admin ${admin_user_id}: Could not log approval action for leave ${leaveId}. leaveApprovalRepository or admin_user_id missing.`);
            }
        }
        // --- End Log Approval/Rejection Action ---
        // Save the leave request with the final determined status and processor details
        // This is the SINGLE save operation after all logic is determined.
        await leaveRepository.save(leaveRequest);
        console.log(`Leave request ${leaveId} final status after Admin processing: ${leaveRequest.status}.`);
        // Send success response back to the frontend
        res.status(200).json({
            message: `Leave request ${leaveId} status updated to ${leaveRequest.status}`,
            leaveId: leaveRequest.leave_id,
            newStatus: leaveRequest.status // Return the *actual* new status that was set
        });
        return; // Explicit return
    }
    catch (error) { // Explicitly type catch error
        console.error(`Admin ${admin_user_id}: Error processing leave request ID ${leaveId}:`, error);
        res.status(500).json({ message: "Internal server error processing leave request." });
        return; // Explicit return
    }
};
router.put('/leave-requests/:id/status', authMiddleware_1.default, updateLeaveStatusByAdminHandler);
const deleteLeaveTypeHandler = async (req, res) => {
    const admin_user_id = req.user?.user_id;
    const admin_role_id = req.user?.role_id;
    const leaveTypeId = parseInt(req.params.id, 10);
    console.log(`--- Admin ${admin_user_id} (Role: ${admin_role_id}) attempting to delete leave type ${leaveTypeId} ---`);
    // --- Role Check: Only Admins can use this handler ---
    if (!req.user || !admin_user_id || admin_role_id !== constants_1.ADMIN_ROLE_ID) {
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
        // --- Check if the leave type is currently in use ---
        // Before deleting a leave type, check if any existing leaves or leave balances
        // refer to this type_id. Preventing deletion is safer than cascading or soft deleting
        // at this stage.
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
        console.log(`Admin ${admin_user_id}: Successfully deleted leave type ${leaveTypeId}.`);
        res.status(200).json({ message: "Leave type deleted successfully." });
        return;
    }
    catch (error) {
        console.error(`Admin ${admin_user_id}: Error deleting leave type ${leaveTypeId}:`, error);
        // Log the specific error if needed for debugging
        // If it's a database error not caught by the usage checks above, it will be a 500 error
        res.status(500).json({ message: "Internal server error deleting leave type." });
        return;
    }
};
router.delete('/leave-types/:id', authMiddleware_1.default, deleteLeaveTypeHandler);
// --- Register the Routes ---
// Attach the protect middleware to ensure only authenticated users can access these admin routes
// The handler then performs the Admin role check
// Route to get list of leave types (for Admin use, e.g., in dropdowns for admin forms)
router.get("/leave-types", authMiddleware_1.default, getLeaveTypesForAdminHandler);
// Route to create a new leave type
router.post("/leave-types", authMiddleware_1.default, createLeaveTypeHandler);
// Route to create a new user
router.post("/users", authMiddleware_1.default, createUserHandler);
// Route to get a list of users (with optional role filter) - UNCOMMENTED AND USING CORRECT HANDLER
router.get("/users", authMiddleware_1.default, getUsersHandler);
