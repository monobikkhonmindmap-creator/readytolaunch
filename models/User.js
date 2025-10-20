// This file will export functions to interact with the 'users' collection
// using our new flexible auth schema.

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
export async function createUserWithEmail(email, hashedPassword, grade) { // <-- Added 'grade'
  if (!global.db) throw new Error("Database not connected.");
  
  const newUser = {
    password: hashedPassword,
    status: "regular", 
    lastAttempts: [], // For the flashcard repetition logic
    createdAt: new Date(),
    
    // --- NEW FIELDS ADDED ---
    grade: grade || null, // Stores the user's provided grade
    test_taken: [],       // Will store an array of test result objects
                          // e.g., { testId: "botany_mcq", score: 85, date: new Date() }
    // --- END NEW FIELDS ---

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