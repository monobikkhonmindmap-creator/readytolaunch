// index.js (Your main server file)

// 1. Import required packages
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'; // <-- ADD THIS
import express from 'express';                             // <-- ADD THIS
import cors from 'cors';                                     // <-- ADD THIS
import bcrypt from 'bcryptjs'; // <-- ADD THIS
// import { findUserByEmail, createUser } from './models/User.js';
import { findUserByEmail, createUserWithEmail } from './models/User.js';
import { authenticateToken } from './middleware/auth.js';
import axios from 'axios';

// --- ADD YOUR AAMARPAY CREDENTIALS ---
// ❗️ In production, these MUST be environment variables
// For development in Codespaces, this is fine.
const AAMARPAY_STORE_ID = "aamarpaytest"; // Use "aamarpaytest" for sandbox
const AAMARPAY_SIGNATURE_KEY = "dbb74894e82415a2f7ff0ec3a97e4183"; // Sandbox key
const AAMARPAY_API_URL = "https://sandbox.aamarpay.com/jsonpost.php"; // Sandbox URL

// 2. MongoDB Connection String
// ❗️ Replace with your actual connection string!
const mongoUri = "mongodb+srv://flashcardAppUser:UYRoB3sQXLnCMcWx@cluster0.tsg0mbg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a new MongoClient
const mongoClient = new MongoClient(mongoUri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// 3. This global variable will hold our DB connection
global.db = null; // <-- ADD THIS

// 4. All 8 of your data URLs from GitHub Releases
const dataUrls = [
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/botany.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/botany_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics1.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics1_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics2.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics2_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/zoology.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/zoology_mcq.json"
];

// 5. This global variable will be your fast, in-memory cache
global.flashcardCache = {};

/**
 * Fetches all 8 data files and loads them into global.flashcardCache
 */
async function loadDataIntoCache() {
  console.log("Starting to fetch flashcard data...");
  
  try {
    const allResponses = await Promise.all(dataUrls.map(url => fetch(url)));
    const allJsonData = await Promise.all(
      allResponses.map(res => {
        if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
        return res.json();
      })
    );

    allJsonData.forEach((data, index) => {
      const url = dataUrls[index];
      const filename = url.substring(url.lastIndexOf('/') + 1); 
      const cacheKey = filename.split('.')[0]; 
      global.flashcardCache[cacheKey] = data;
      console.log(` -> Loaded "${cacheKey}" into cache.`);
    });

    console.log("✅ All flashcard data successfully loaded into memory cache.");
  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to load data into cache.", error);
    process.exit(1); 
  }
}

// 6. NEW FUNCTION to connect to MongoDB
/**
 * Connects to MongoDB and assigns the database to the global.db variable
 */
async function connectToMongo() {
  console.log("Connecting to MongoDB Atlas...");
  try {
    // Connect the client to the server
    await mongoClient.connect();
    
    // Establish and verify connection
    await mongoClient.db("flashcard-app").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");

    // Assign the database to our global variable
    // We'll have collections like global.db.collection('users')
    global.db = mongoClient.db('flashcard-app'); 

  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to connect to MongoDB.", error);
    process.exit(1);
  }
}

/**
 * The main function to start the entire server.
 */
async function startServer() {
  // 1. First, load the flashcard data into memory
  await loadDataIntoCache();
  
  // 2. Next, connect to our MongoDB database
  await connectToMongo(); // <-- THIS IS NEW

  // 3. Finally, start the web server (Express)
  const app = express();
  app.use(cors()); // Allow requests from our app

  // NOTE: We need express.urlencoded() for the IPN
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json()); // Allow server to read JSON bodies

  // --- REGISTRATION ENDPOINT (UPDATED) ---
  app.post('/register', async (req, res) => {
    try {
      // --- UPDATED ---
      const { email, password, grade } = req.body; // Get 'grade' from the request body

      // 1. Validate input
      if (!email || !password) { // 'grade' will be optional
        return res.status(400).json({ message: "Email and password are required." });
      }

      // 2. Check if user already exists
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: "User with this email already exists." });
      }

      // 3. Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // 4. Create the new user
      // --- UPDATED ---
      const newUserId = await createUserWithEmail(email, hashedPassword, grade); // Pass 'grade'

      console.log(`New user created: ${email}, ID: ${newUserId}`);
      
      // 5. Send success response
      // --- UPDATED ---
      res.status(201).json({ 
        message: "User registered successfully.",
        userId: newUserId,
        status: "regular",
        grade: grade || null // Send the new 'grade' back to the app
      });

    } catch (error) {
      console.error("Error in /register endpoint:", error);
      res.status(500).json({ message: "Server error during registration." });
    }
  });
  // --- END OF UPDATED ENDPOINT ---

  // ... (inside your startServer function, after the /register endpoint) ...

  // --- LOGIN ENDPOINT (UPDATED) ---
  app.post('/login', async (req, res) => {
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

      // 4. User is valid! Create a session token (JWT)
      // --- UPDATED ---
      const sessionToken = jwt.sign(
        { 
          userId: user._id, 
          email: user.authMethods.email,
          status: user.status,
          grade: user.grade // <-- ADDED
        },
        JWT_SECRET,
        { expiresIn: '30d' } 
      );

      console.log(`User logged in: ${user.authMethods.email}`);

      // 5. Send the token and user data back to the app
      // --- UPDATED ---
      res.status(200).json({
        message: "Login successful.",
        token: sessionToken,
        user: {
          id: user._id,
          email: user.authMethods.email,
          status: user.status,
          grade: user.grade, // <-- ADDED
          test_taken: user.test_taken // <-- ADDED
        }
      });

    } catch (error) {
      console.error("Error in /login endpoint:", error);
      
      // This is the correct line
      res.status(500).json({ message: "Server error during login." }); 
    }
  });
  // --- END OF UPDATED ENDPOINT ---

  // --- ADD THIS NEW ENDPOINT ---
  /**
   * GET /decks
   * Protected endpoint. User must provide a valid token.
   * Returns a list of available decks based on user's status.
   */
  app.get('/decks', authenticateToken, (req, res) => {
    // Thanks to the middleware, req.user is now available
    const userStatus = req.user.status; 
    
    // Get all available deck names from our cache
    const allDeckNames = Object.keys(global.flashcardCache);

    let accessibleDecks = [];

    // This is our server-side "RSC" logic
    if (userStatus === 'premium') {
      // Premium users get all decks
      accessibleDecks = allDeckNames;
    } else {
      // Regular users only get decks that DO NOT end in "_mcq"
      accessibleDecks = allDeckNames.filter(name => !name.endsWith('_mcq'));
    }

    // Format the data for the app
    const deckData = accessibleDecks.map(name => ({
      id: name,
      title: name.replace('_', ' ').replace(/^(.)/, c => c.toUpperCase()), // e.g., "Botany" or "Botany mcq"
      // We can add more info here, like card count
      cardCount: global.flashcardCache[name].length 
    }));

    res.status(200).json(deckData);
  });
  // --- END OF NEW ENDPOINT ---

  // --- ADD THIS NEW ENDPOINT ---
  /**
   * POST /sync-progress
   * Protected endpoint. Saves user's study progress to the database.
   * Expects a body like: { lastAttempts: [...], test_taken: [...] }
   */
  app.post('/sync-progress', authenticateToken, async (req, res) => {
    try {
      // Get the user's ID from the token
      const userId = req.user.userId;

      // Get the data from the app's request body
      const { lastAttempts, test_taken } = req.body;

      // Validate that we have some data
      if (!lastAttempts && !test_taken) {
        return res.status(400).json({ message: "No progress data provided." });
      }

      // Build the update operation for MongoDB
      const updateOperation = { $set: {} };
      if (lastAttempts) {
        // Here we'd add the logic for "only last 10 attempts"
        // For now, we'll just overwrite
        updateOperation.$set.lastAttempts = lastAttempts; 
      }
      if (test_taken) {
        // Here we'd likely $push new test results instead of overwriting
        // But for simplicity, we'll overwrite
        updateOperation.$set.test_taken = test_taken;
      }
      
      // We need to import ObjectId to find the user by their ID
      // At the top of index.js, add:
      // import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
      await global.db.collection('users').updateOne(
        { _id: new ObjectId(userId) }, // Find user by their BSON ID
        updateOperation
      );

      res.status(200).json({ message: "Progress synced successfully." });

    } catch (error) {
      console.error("Error in /sync-progress:", error);
      res.status(500).json({ message: "Server error while syncing progress." });
    }
  });
  // --- END OF NEW ENDPOINT ---

  // --- 1. ENDPOINT TO INITIATE PAYMENT ---
  // This is a protected route. User must be logged in.
  app.post('/initiate-payment', authenticateToken, async (req, res) => {
    try {
      // Get user info from the token
      const userId = req.user.userId;
      const userEmail = req.user.email;
      
      // Generate a unique transaction ID.
      // We'll cleverly embed the userId in it so we can find it later!
      const tran_id = `${userId}_${Date.now()}`;

      // This is the main URL of your server.
      // ❗️ See the 'CRITICAL' note below about this.
      const SERVER_BASE_URL = "https://your-codespace-url.com";

      const paymentData = {
        store_id: AAMARPAY_STORE_ID,
        signature_key: AAMARPAY_SIGNATURE_KEY,
        tran_id: tran_id, // Your unique transaction ID
        amount: "10.00",  // The amount for premium (e.g., 10 BDT for testing)
        currency: "BDT",
        desc: "Premium Membership",
        cus_name: userEmail, // Use email or a 'name' field
        cus_email: userEmail,
        cus_phone: "01700000000", // Required, but can be dummy
        cus_add1: "Dhaka",
        cus_city: "Dhaka",
        cus_country: "Bangladesh",
        type: "json",
        // These are the most important URLs:
        success_url: `${SERVER_BASE_URL}/payment/success`, // App handles this
        fail_url: `${SERVER_BASE_URL}/payment/fail`,       // App handles this
        ipn_url: `${SERVER_BASE_URL}/payment/ipn`,         // Server handles this
      };

      // Make the POST request to aamarpay
      const response = await axios.post(AAMARPAY_API_URL, paymentData);

      if (response.data.result === "true" && response.data.payment_url) {
        // Send the payment URL back to the React Native app
        res.status(200).json({ payment_url: response.data.payment_url });
      } else {
        // Log the full error for debugging
        console.error("Aamarpay init error:", response.data);
        res.status(400).json({ message: "Payment gateway error.", error: response.data });
      }

    } catch (error) {
      console.error("Error in /initiate-payment:", error);
      res.status(500).json({ message: "Server error." });
    }
  });


  // --- 2. ENDPOINT FOR AAMARPAY TO CONFIRM PAYMENT (IPN) ---
  // This is called by AAMARPAY'S SERVER. It is NOT protected by our token auth.
  app.post('/payment/ipn', async (req, res) => {
    try {
      // aamarpay sends data as x-www-form-urlencoded
      const ipnData = req.body;
      console.log("Received IPN:", ipnData);

      // 1. Verify the 'signature_key' to ensure it's from aamarpay
      //    (This is a simplified check; a real one would re-hash)
      if (ipnData.signature_key !== AAMARPAY_SIGNATURE_KEY) {
        console.error("Invalid IPN signature");
        return res.status(400).send("Invalid signature");
      }

      // 2. Check if the payment was successful
      if (ipnData.pay_status === "Successful") {
        
        // 3. Get our userId back from the tran_id
        const tran_id = ipnData.tran_id;
        const userId = tran_id.split('_')[0]; // Get the 'userId' part

        if (!userId) {
          console.error("Could not parse userId from tran_id:", tran_id);
          return res.status(400).send("Invalid transaction ID");
        }

        // 4. Update the user in MongoDB!
        console.log(`Updating user ${userId} to premium...`);
        await global.db.collection('users').updateOne(
          { _id: new ObjectId(userId) },
          { $set: { status: "premium" } }
        );

        console.log(`User ${userId} is now premium!`);
        
        // Respond to aamarpay so they know we got it
        res.status(200).send("OK");
      } else {
        // Payment failed or was cancelled
        console.log(`Payment failed for tran_id: ${ipnData.tran_id}`);
        res.status(200).send("OK");
      }

    } catch (error) {
      console.error("Error in /payment/ipn:", error);
      res.status(500).send("Server error");
    }
  });

  // These are the redirect URLs. The app just needs to know about them.
  app.post('/payment/success', (req, res) => {
    res.send("Payment successful! You can close this window.");
  });
  app.post('/payment/fail', (req, res) => {
    res.send("Payment failed. You can close this window.");
  });
  
  // Example: A test endpoint
  app.get('/', (req, res) => {
    res.send('Hello Ali reza! Your server is running.');
  });
  
  // (We will add our real app endpoints here later)

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
    // In GitHub Codespaces, this will be automatically forwarded.
  });
}

// 🚀 Run the server!
startServer();