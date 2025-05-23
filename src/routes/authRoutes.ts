import express, { Request, Response, Router, RequestHandler } from "express";
import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

// Import TypeORM data source and User/Role entities
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { Role } from "../entity/Role"; // Assuming Role entity exists and is needed

// Import authentication middleware
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";

// Create an Express router instance
const router: express.Router = express.Router();

interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
  role_id: number; // Expected role ID from the client
  // manager_id?: number | null; // Optional: if registration includes manager assignment
}

interface LoginRequestBody {
  email: string;
  password: string;
}

// Expected structure of the successful login response body
interface AuthSuccessResponse {
  message: string; // e.g., "Login successful"
  token: string; // The JWT token
  user: {
    // The user object returned to the frontend
    user_id: number;
    name: string;
    email: string;
    role_id: number;
    manager_id?: number | null; // Include if manager_id is part of user response
    // Add any other user properties needed on the frontend after login
  };
}

// Expected structure of the successful registration response body
interface RegistrationSuccessResponse {
  message: string; // e.g., "User registered successfully"
  userId: number; // The ID of the newly created user
}

// Generic error response structure
interface ErrorResponse {
  message: string; // A descriptive error message
}
// --- End Interfaces ---

const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key";

// --- Get TypeORM Repositories ---
// Access the repositories for interacting with the database entities
const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role); // Repository for the Role entity

// --- Registration Route (Public - Consider if this should be Admin-only) ---
// Endpoint: POST /api/auth/register
const registerHandler: RequestHandler<
  {}, // Req Params (none for this route)
  RegistrationSuccessResponse | ErrorResponse, // Res Body: success message + userId OR error message
  RegisterRequestBody, // Req Body: name, email, password, role_id
  {} // Req Query (none for this route)
> = async (req, res): Promise<void> => {
  // Async handler returns a Promise<void>
  const { name, email, password, role_id } = req.body; // Destructure data from the request body // --- Input Validation --- // Check if required fields are present and role_id is a number

  if (
    !name ||
    !email ||
    !password ||
    role_id === undefined ||
    typeof role_id !== "number"
  ) {
    res
      .status(400)
      .json({
        message:
          "All fields (name, email, password, role_id) are required and role_id must be a number",
      });
    return;
  }

  try {
    // --- Check for Existing User ---
    // Query the database to see if a user with the provided email already exists
    const existingUser = await userRepository.findOne({
      where: { email: email },
    });
    if (existingUser) {
      res.status(409).json({ message: "User with this email already exists" }); // 409 Conflict
      return;
    }

    // --- Check if Role Exists ---
    // Query the database to ensure the provided role_id corresponds to an existing role
    const roleExists = await roleRepository.findOne({
      where: { role_id: role_id },
    });
    if (!roleExists) {
      res.status(400).json({ message: "Invalid role_id provided" }); // 400 Bad Request
      return;
    }

    const saltRounds = 10; // Recommended salt rounds for bcrypt
    const passwordHash = await bcrypt.hash(password, saltRounds); // Use bcryptjs.hash // --- Create New User Entity ---

    const newUser = new User(); // Create a new instance of the User entity
    newUser.name = name; // Assign properties from the request body
    newUser.email = email;
    newUser.password_hash = passwordHash; // Store the hashed password in the password_hash column // Assign the role to the user

    newUser.role_id = role_id; // --- Save New User --- // Save the new user entity to the database

    const savedUser = await userRepository.save(newUser);

    // Log the successful registration (optional)
    // console.log(
    //   `User registered successfully: ${savedUser.email} (ID: ${savedUser.user_id})`
    // ); // --- Send Success Response --- // Respond with a 201 Created status and success message + user ID

    res.status(201).json({
      message: "User registered successfully",
      userId: savedUser.user_id,
    });
    return;
  } catch (error: any) {
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

const loginHandler: RequestHandler<
  {},
  AuthSuccessResponse | ErrorResponse, // Res Body: success message + token + user OR error message
  LoginRequestBody,
  {} // Req Query (none for this route)
> = async (req, res): Promise<void> => {
  // Async handler returns a Promise<void>
  //console.log(">>> Entered loginHandler");
  const { email, password } = req.body; // Destructure email and password from the request body // --- Input Validation --- // Check if email and password are provided

  if (!email || !password) {
    //console.log(">>> LoginHandler: Missing email or password");
    res.status(400).json({ message: "Email and password are required" }); // 400 Bad Request
    return;
  }

  try {
    //console.log(">>> LoginHandler: Attempting to find user by email:", email); // Before findOne
    const user = await userRepository.findOne({
      where: { email: email }, // Find user where email matches // Select specific columns to return, including password_hash for comparison
      select: ["user_id", "name", "email", "password_hash", "role_id"], // Include password_hash
    });
    //console.log(">>> LoginHandler: User found?", !!user);

    if (!user) {
      //console.log(">>> LoginHandler: User not found"); // Log user not found
      //console.log(">>> LoginHandler: Preparing to send 401 response");
      res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
      return;
    }

    //console.log(">>> LoginHandler: Comparing passwords");
    const passwordMatch = await bcrypt.compare(password, user.password_hash); // Use bcryptjs.compare
    //console.log(">>> LoginHandler: Password match?", passwordMatch);

    // If the passwords do not match
    if (!passwordMatch) {
      //console.log(">>> LoginHandler: Password does not match");
      res.status(401).json({ message: "Invalid credentials" }); // 401 Unauthorized
      return;
    }

    //console.log(">>> LoginHandler: Passwords match, generating token");
    const token = jwt.sign(
      { user_id: user.user_id, role_id: user.role_id }, // Payload: include user ID and role ID
      jwtSecret, // The secret key for signing the token
      { expiresIn: "1h" } // Token expiration time (e.g., '1h', '7d', '2m')
    );
    // --- End Generate JWT Token ---
    //console.log(">>> LoginHandler: Token generated"); // After jwt.sign

    //console.log(">>> LoginHandler: Sending success response (200)");

    // Log successful login (optional)
    // console.log(
    //   `User logged in successfully: ${user.email} (ID: ${user.user_id}, Role: ${user.role_id})`
    // ); // --- Send Success Response --- // Respond with a 200 OK status and the success message, token, and user information

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
    //console.log(">>> LoginHandler: Response sent"); // After sending 200
    return;
  } catch (error: any) {
    // --- Handle Errors ---
    // Catch any errors that occurred during the login process (database errors, bcrypt errors, etc.)
    console.error(">>> LoginHandler: Caught error during login:", error);
    console.error("Error during user login:", error); // Send a 500 Internal Server Error response
    res.status(500).json({ message: "Internal server error during login" });
    return; // Exit the handler
  }
  //console.log(">>> LoginHandler: End of handler (should not be reached)");
};

// Register the /api/auth/login route for POST requests
router.post("/login", loginHandler);

router.get(
  "/protected-test",
  protect,
  (req: AuthenticatedRequest, res: Response) => {
    // If the protect middleware successfully authenticated the user,
    // the user information will be attached to req.user
    if (req.user) {
      res.status(200).json({
        message: "You accessed a protected route!",
        user: req.user, // Send back the authenticated user's info
      });
    } else {
      // This else block should ideally not be reached if protect middleware works correctly,
      // but it's a defensive check.
      res
        .status(401)
        .json({
          message: "Not authorized, user info missing after authentication",
        });
    }
  }
);

// Export the router so it can be used in your main Express app file (e.g., server.ts)
export { router };
