"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
// my-leave-app-backend/src/routes/authRoutes.ts
const express_1 = __importDefault(require("express"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const data_source_1 = require("../data-source");
const User_1 = require("../entity/User");
const Role_1 = require("../entity/Role");
const authMiddleware_1 = __importDefault(require("../middleware/authMiddleware"));
const router = express_1.default.Router();
exports.router = router;
const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key';
const userRepository = data_source_1.AppDataSource.getRepository(User_1.User);
const roleRepository = data_source_1.AppDataSource.getRepository(Role_1.Role);
// --- Registration Route (Public) ---
const registerHandler = async (req, res) => {
    const { name, email, password, role_id } = req.body;
    if (!name || !email || !password || role_id === undefined || typeof role_id !== 'number') {
        // Cast the return value to void
        return res.status(400).json({ message: 'All fields (name, email, password, role_id) are required and role_id must be a number' });
    }
    try {
        const existingUser = await userRepository.findOne({ where: { email: email } });
        if (existingUser) {
            // Cast the return value to void
            return res.status(409).json({ message: 'User with this email already exists' });
        }
        const roleExists = await roleRepository.findOne({ where: { role_id: role_id } });
        if (!roleExists) {
            // Cast the return value to void
            return res.status(400).json({ message: 'Invalid role_id provided' });
        }
        const saltRounds = 10;
        const passwordHash = await bcrypt_1.default.hash(password, saltRounds);
        const newUser = new User_1.User();
        newUser.name = name;
        newUser.email = email;
        newUser.password_hash = passwordHash;
        newUser.role_id = role_id;
        const savedUser = await userRepository.save(newUser);
        // Cast the return value to void
        return res.status(201).json({
            message: 'User registered successfully',
            userId: savedUser.user_id
        });
    }
    catch (error) {
        console.error('Error during registration:', error);
        // Cast the return value to void
        return res.status(500).json({ message: 'Internal server error during registration' });
    }
};
router.post('/register', registerHandler);
// --- Login Route (Public) ---
const loginHandler = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        // Cast the return value to void
        return res.status(400).json({ message: 'Email and password are required' });
    }
    try {
        const user = await userRepository.findOne({
            where: { email: email },
            select: ['user_id', 'name', 'email', 'password_hash', 'role_id']
        });
        if (!user) {
            // Cast the return value to void
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const passwordMatch = await bcrypt_1.default.compare(password, user.password_hash);
        if (!passwordMatch) {
            // Cast the return value to void
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ user_id: user.user_id, role_id: user.role_id }, jwtSecret, { expiresIn: '1h' });
        // Cast the return value to void
        return res.status(200).json({
            message: 'Login successful',
            token: token,
            user: {
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role_id: user.role_id
            }
        });
    }
    catch (error) {
        console.error('Error during login:', error);
        // Cast the return value to void
        return res.status(500).json({ message: 'Internal server error during login' });
    }
};
router.post('/login', loginHandler);
// --- Protected Test Route ---
// This handler doesn't use RequestHandler with explicit body types,
// so it doesn't need the 'return' fix for res.json calls.
router.get('/protected-test', authMiddleware_1.default, (req, res) => {
    if (req.user) {
        res.status(200).json({
            message: 'You accessed a protected route!',
            user: req.user
        });
    }
    else {
        res.status(401).json({ message: 'Not authorized, user info missing after authentication' });
    }
});
