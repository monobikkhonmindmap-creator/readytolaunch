// startup/db.js
import { MongoClient, ServerApiVersion } from 'mongodb';
import { MONGO_URI } from '../config.js';

// Create a new MongoClient
const mongoClient = new MongoClient(MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

/**
 * Connects to MongoDB and assigns the database to the global.db variable
 */
export async function connectToMongo() {
  console.log("Connecting to MongoDB Atlas...");
  try {
    await mongoClient.connect();
    await mongoClient.db("flashcard-app").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    
    // Assign the database to our global variable
    global.db = mongoClient.db('flashcard-app'); 
  } catch (error) {
    console.error("❌ CRITICAL ERROR: Failed to connect to MongoDB.", error);
    process.exit(1);
  }
}