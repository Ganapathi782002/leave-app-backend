import express, { Request, Response, RequestHandler } from "express";
import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { Role } from "../entity/Role";
import protect, { AuthenticatedRequest } from "../middleware/authMiddleware";

const router: express.Router = express.Router();

interface RegisterRequestBody {
  name: string;
  email: string;
  password: string;
  role_id: number;
  // manager_id?: number | null; // Optional: if registration includes manager assignment
}

interface LoginRequestBody {
  email: string;
  password: string;
}

interface AuthSuccessResponse {
  message: string;
  token: string;
  user: {
    user_id: number;
    name: string;
    email: string;
    role_id: number;
    manager_id?: number | null;
    manager?: {
      user_id: number;
      name: string;
      email: string;
    } | null;
  };
}

interface RegistrationSuccessResponse {
  message: string;
  userId: number;
}

interface ErrorResponse {
  message: string;
}

const jwtSecret = process.env.JWT_SECRET || "your_super_secret_jwt_key";

const userRepository = AppDataSource.getRepository(User);
const roleRepository = AppDataSource.getRepository(Role);

const registerHandler: RequestHandler<
  {},
  RegistrationSuccessResponse | ErrorResponse,
  RegisterRequestBody,
  {}
> = async (req, res): Promise<void> => {
  const { name, email, password, role_id } = req.body;

  if (
    !name ||
    !email ||
    !password ||
    role_id === undefined ||
    typeof role_id !== "number"
  ) {
    res.status(400).json({
      message:
        "All fields (name, email, password, role_id) are required and role_id must be a number",
    });
    return;
  }

  try {
    const existingUser = await userRepository.findOne({
      where: { email: email },
    });
    if (existingUser) {
      res.status(409).json({ message: "User with this email already exists" });
      return;
    }
    const roleExists = await roleRepository.findOne({
      where: { role_id: role_id },
    });
    if (!roleExists) {
      res.status(400).json({ message: "Invalid role_id provided" });
      return;
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const newUser = new User();
    newUser.name = name;
    newUser.email = email;
    newUser.password_hash = passwordHash;

    newUser.role_id = role_id;

    const savedUser = await userRepository.save(newUser);

    res.status(201).json({
      message: "User registered successfully",
      userId: savedUser.user_id,
    });
    return;
  } catch (error: any) {
    console.error("Error during user registration:", error);
    res
      .status(500)
      .json({ message: "Internal server error during registration" });
    return;
  }
};

router.post("/register", registerHandler);

const loginHandler: RequestHandler<
  {},
  AuthSuccessResponse | ErrorResponse,
  LoginRequestBody,
  {}
> = async (req, res): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  try {
    const user = await userRepository.findOne({
      where: { email: email },
      relations: ["manager"],
      select: ["user_id", "name", "email", "password_hash", "role_id"],
    });

    if (!user) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign(
      { user_id: user.user_id, role_id: user.role_id },
      jwtSecret,
      { expiresIn: "1h" },
    );

    res.status(200).json({
      message: "Login successful",
      token: token,
      user: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        role_id: user.role_id,
        manager_id: user.manager_id,
        manager: user.manager ? {
          user_id: user.manager.user_id,
          name: user.manager.name,
          email: user.manager.email,
        } : null,
      },
    });
    return;
  } catch (error: any) {
    console.error(">>> LoginHandler: Caught error during login:", error);
    console.error("Error during user login:", error);
    res.status(500).json({ message: "Internal server error during login" });
    return;
  }
};

router.post("/login", loginHandler);

router.get(
  "/protected-test",
  protect,
  (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      res.status(200).json({
        message: "You accessed a protected route!",
        user: req.user,
      });
    } else {
      res.status(401).json({
        message: "Not authorized, user info missing after authentication",
      });
    }
  },
);

export { router };
