// models/User.js
// This file exports functions to interact with the 'users' collection.

/**
 * Finds a user by their email address.
 * @param {string} email - The user's email.
 * @returns {Promise<Object|null>} The user document or null.
 */
export async function findUserByEmail(email) {
  if (!global.db) throw new Error("Database not connected.");
  // Find a user where the nested 'email' field matches
  return global.db.collection('users').findOne({
    "authMethods.email": email.toLowerCase()
  });
}

/**
 * Creates a new user with email and password.
 * @param {string} email - The user's email.
 * @param {string} hashedPassword - The already-hashed password.
 * @param {string} grade - The user's grade (e.g., "HSC")
 * @returns {Promise<string>} The inserted user's ID.
 */
export async function createUserWithEmail(email, hashedPassword, grade) {
  if (!global.db) throw new Error("Database not connected.");
  
  const newUser = {
    password: hashedPassword,
    status: "regular", // New users start as regular
    
    // --- THIS IS THE CHANGE ---
    // lastAttempts: [], // REMOVED
    progress: {},      // ADDED (Starts empty for the sparse model)
    // --- END OF CHANGE ---

    createdAt: new Date(),
    grade: grade || null,
    test_taken: [], // This field is fine

    authMethods: {
      email: email.toLowerCase(),
      phone: null,
      googleId: null,
      facebookId: null
    }
  };

  const result = await global.db.collection('users').insertOne(newUser);
  return result.insertedId;
}

// You might also add functions here later like:
// export async function findUserById(userId) { ... }
// export async function updateUserStatus(userId, newStatus) { ... }