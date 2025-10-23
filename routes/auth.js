// routes/auth.js
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, createUserWithEmail } from '../models/User.js';
import { JWT_SECRET } from '../config.js';
// --- NEW IMPORTS ---
import { authenticateToken } from '../middleware/auth.js'; // Needed for the new status route
import { ObjectId } from 'mongodb'; // Needed to fetch user by ID
// --- END NEW IMPORTS ---

const router = Router();

// --- REGISTRATION ENDPOINT (Unchanged) ---
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
    // Assuming createUserWithEmail initializes 'progress' as an empty object {}
    const newUserId = await createUserWithEmail(email, hashedPassword, grade);
    console.log(`New user created: ${email}, ID: ${newUserId}`);
    res.status(201).json({
      message: "User registered successfully.",
      userId: newUserId,
      status: "regular", // New users start as regular
      grade: grade || null
    });
  } catch (error) {
    console.error("Error in /register endpoint:", error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// --- UPDATED LOGIN ENDPOINT ---
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
    // Create the token (same as before)
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

    // --- THIS IS THE CHANGE ---
    // Send back the token, user info, AND their progress object
    res.status(200).json({
      message: "Login successful.",
      token: sessionToken,
      user: {
        id: user._id,
        email: user.authMethods.email,
        status: user.status,
        grade: user.grade,
        test_taken: user.test_taken || [], // Include test_taken if it exists
        progress: user.progress || {} // Include the progress object (or empty if none)
      }
    });
    // --- END OF CHANGE ---

  } catch (error) {
    console.error("Error in /login endpoint:", error);
    res.status(500).json({ message: "Server error during login." });
  }
});

// --- NEW ENDPOINT: GET AUTH STATUS ---
// This is used by the app on startup to refresh the user's status and progress
router.get('/auth/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId; // Get userId from the verified token

    // Re-fetch the user from the database to get the latest data
    const user = await global.db.collection('users').findOne(
      { _id: new ObjectId(userId) }
    );

    if (!user) {
      // This should ideally not happen if the token is valid
      return res.status(404).json({ message: "User not found." });
    }

    // Send back the essential info the app needs
    res.status(200).json({
      status: user.status,
      progress: user.progress || {} // Send current progress or empty object
    });

  } catch (error) {
    console.error("Error refreshing status:", error);
    res.status(500).json({ message: "Server error refreshing status." });
  }
});
// --- END NEW ENDPOINT ---

export default router;