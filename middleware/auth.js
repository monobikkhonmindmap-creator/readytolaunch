import jwt from 'jsonwebtoken';

// This is the same secret you used in index.js
const JWT_SECRET = "a-very-strong-secret-key-for-development"; 

/**
 * Express middleware to authenticate a user with a JWT.
 */
export const authenticateToken = (req, res, next) => {
  // Get the token from the "Authorization" header
  // It's usually sent as "Bearer TOKEN_STRING"
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    // No token provided
    return res.status(401).json({ message: "Authentication token required." });
  }

  // Verify the token
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      // Token is invalid or expired
      return res.status(403).json({ message: "Invalid or expired token." });
    }

    // Token is valid!
    // Attach the user payload (userId, email, status, grade) to the request object
    req.user = user;
    
    // Continue to the next function (the main endpoint logic)
    next(); 
  });
};