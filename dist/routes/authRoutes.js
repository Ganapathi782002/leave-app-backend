"use strict";
// my-leave-app-backend/src/routes/authRoutes.ts
// Authentication routes: /api/auth/register, /api/auth/login, /api/auth/protected-test
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
// Use bcryptjs consistently for hashing and comparison
const bcryptjs_1 = __importDefault(require("bcryptjs")); // <-- Use bcryptjs
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken")); // For generating JWTs
// Import TypeORM data source and User/Role entities
const data_source_1 = require("../data-source");
const User_1 = require("../entity/User");
const Role_1 = require("../entity/Role"); // Assuming Role entity exists and is needed
// Import authentication middleware
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
// Create an Express router instance
const router = express_1.default.Router();
exports.router = router;
// --- End Interfaces ---
// --- JWT Secret Key ---
// Get the JWT secret from environment variables. Use a fallback during development, but secure this in production.
const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key"; // TODO: Load from .env securely
// --- Get TypeORM Repositories ---
// Access the repositories for interacting with the database entities
const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
const roleRepository = data_source_1.AppDataSource.getRepository(Role_1.Role); // Repository for the Role entity
// --- Registration Route (Public - Consider if this should be Admin-only) ---
// Endpoint: POST /api/auth/register
const registerHandler = async (req, res) => {
    // Async handler returns a Promise<void>
    const { name, email, password, role_id } = req.body; // Destructure data from the request body // --- Input Validation --- // Check if required fields are present and role_id is a number
    if (!name ||
        !email ||
        !password ||
        role_id === undefined ||
        typeof role_id !== "number") {
        res
            .status(400)
            .json({
            message: "All fields (name, email, password, role_id) are required and role_id must be a number",
        });
        return; // Exit the handler after sending response
    }
    // TODO: Add more robust validation (e.g., email format, password complexity)
    try {
        // --- Check for Existing User ---
        // Query the database to see if a user with the provided email already exists
        const existingUser = await userRepository.findOne({
            where: { email: email },
        });
        if (existingUser) {
            res.status(409).json({ message: "User with this email already exists" }); // 409 Conflict
            return; // Exit the handler
        }
        // --- Check if Role Exists ---
        // Query the database to ensure the provided role_id corresponds to an existing role
        const roleExists = await roleRepository.findOne({
            where: { role_id: role_id },
        });
        if (!roleExists) {
            res.status(400).json({ message: "Invalid role_id provided" }); // 400 Bad Request
            return; // Exit the handler
        } // --- Hash Password --- // Generate a salt and hash the plaintext password before storing it
        const saltRounds = 10; // Recommended salt rounds for bcrypt
        const passwordHash = await bcryptjs_1.default.hash(password, saltRounds); // Use bcryptjs.hash // --- Create New User Entity ---
        const newUser = new User_1.User(); // Create a new instance of the User entity
        newUser.name = name; // Assign properties from the request body
        newUser.email = email;
        newUser.password_hash = passwordHash; // Store the hashed password in the password_hash column // Assign the role to the user
        // Assuming your User entity has a 'role_id' column:
        newUser.role_id = role_id; // --- Save New User --- // Save the new user entity to the database
        // OR if your User entity has a ManyToOne relationship to Role named 'role':
        // newUser.role = roleExists; // Assign the fetched Role entity
        // TODO: Handle manager_id assignment if registration involves setting a manager
        const savedUser = await userRepository.save(newUser);
        // Log the successful registration (optional)
        console.log(`User registered successfully: ${savedUser.email} (ID: ${savedUser.user_id})`); // --- Send Success Response --- // Respond with a 201 Created status and success message + user ID
        res.status(201).json({
            message: "User registered successfully",
            userId: savedUser.user_id,
        });
        return; // Exit the handler
    }
    catch (error) {
        // --- Handle Errors ---
        // Catch any errors that occurred during the process (database errors, hashing errors, etc.)
        console.error("Error during user registration:", error); // Send a 500 Internal Server Error response
        res
            .status(500)
            .json({ message: "Internal server error during registration" });
        return; // Exit the handler
    }
};
// Register the /api/auth/register route for POST requests
router.post("/register", registerHandler);
// --- Login Route (Public) ---
// Endpoint: POST /api/auth/login
const loginHandler = async (req, res) => {
    // Async handler returns a Promise<void>
    const { email, password } = req.body; // Destructure email and password from the request body // --- Input Validation --- // Check if email and password are provided
    if (!email || !password) {
        res.status(400).json({ message: "Email and password are required" }); // 400 Bad Request
        return; // Exit the handler
    }
    try {
        // --- Find User by Email ---
        // Query the database to find the user with the provided email
        // Crucially, select the 'password_hash' column as it's not included by default
        const user = await userRepository.findOne({
            where: { email: email }, // Find user where email matches // Select specific columns to return, including password_hash for comparison
            select: ["user_id", "name", "email", "password_hash", "role_id"], // Include password_hash
        }); // If no user is found with the provided email
        if (!user) {
            res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
            return; // Exit the handler
        }
        // --- Compare Passwords ---
        // Use bcryptjs.compare to compare the provided plaintext password with the stored hash
        // This is an async operation
        const passwordMatch = await bcryptjs_1.default.compare(password, user.password_hash); // Use bcryptjs.compare
        // If the passwords do not match
        if (!passwordMatch) {
            res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
            return; // Exit the handler
        }
        // --- Generate JWT Token ---
        // If email and password match, generate a JSON Web Token
        // The token payload typically includes non-sensitive user information like ID and role
        const token = jsonwebtoken_1.default.sign({ user_id: user.user_id, role_id: user.role_id }, // Payload: include user ID and role ID
        jwtSecret, // The secret key for signing the token
        { expiresIn: "1h" } // Token expiration time (e.g., '1h', '7d', '2m')
        );
        // --- End Generate JWT Token ---
        // Log successful login (optional)
        console.log(`User logged in successfully: ${user.email} (ID: ${user.user_id}, Role: ${user.role_id})`); // --- Send Success Response --- // Respond with a 200 OK status and the success message, token, and user information
        res.status(200).json({
            message: "Login successful",
            token: token, // Send the generated JWT
            user: {
                // Send back user information needed by the frontend
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role_id: user.role_id,
            },
        });
        return; // Exit the handler
    }
    catch (error) {
        // --- Handle Errors ---
        // Catch any errors that occurred during the login process (database errors, bcrypt errors, etc.)
        console.error("Error during user login:", error); // Send a 500 Internal Server Error response
        res.status(500).json({ message: "Internal server error during login" });
        return; // Exit the handler
    }
};
// Register the /api/auth/login route for POST requests
router.post("/login", loginHandler);
// --- Protected Test Route (Requires Authentication) ---
// Endpoint: GET /api/auth/protected-test
// Uses the protect middleware to ensure a valid token is present
router.get("/protected-test", authMiddleware_1.default, (req, res) => {
    // If the protect middleware successfully authenticated the user,
    // the user information will be attached to req.user
    if (req.user) {
        res.status(200).json({
            message: "You accessed a protected route!",
            user: req.user, // Send back the authenticated user's info
        });
    }
    else {
        // This else block should ideally not be reached if protect middleware works correctly,
        // but it's a defensive check.
        res
            .status(401)
            .json({
            message: "Not authorized, user info missing after authentication",
        });
    }
});
