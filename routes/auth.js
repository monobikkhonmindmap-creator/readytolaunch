// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUserWithEmail } from '../models/User.js';
import { JWT_SECRET } from '../config.js';

const router = Router();

// --- REGISTRATION ENDPOINT ---
router.post('/register', async (req, res) => {
  try {
    const { email, password, grade } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "User with this email already exists." });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUserId = await createUserWithEmail(email, hashedPassword, grade);
    console.log(`New user created: ${email}, ID: ${newUserId}`);
    res.status(201).json({ 
      message: "User registered successfully.",
      userId: newUserId,
      status: "regular",
      grade: grade || null
    });
  } catch (error) {
    console.error("Error in /register endpoint:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// --- LOGIN ENDPOINT ---
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    const sessionToken = jwt.sign(
      { 
        userId: user._id, 
        email: user.authMethods.email,
        status: user.status,
        grade: user.grade
      },
      JWT_SECRET,
      { expiresIn: '30d' } 
    );
    console.log(`User logged in: ${user.authMethods.email}`);
    res.status(200).json({
      message: "Login successful.",
      token: sessionToken,
      user: {
        id: user._id,
        email: user.authMethods.email,
        status: user.status,
        grade: user.grade,
        test_taken: user.test_taken
      }
    });
  } catch (error) {
    console.error("Error in /login endpoint:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

export default router;