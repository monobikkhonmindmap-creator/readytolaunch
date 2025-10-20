import express from 'express';
import cors from 'cors';

// Import startup tasks
import { connectToMongo } from './startup/db.js';
import { loadDataIntoCache } from './startup/cache.js';

// Import route modules
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import paymentRoutes from './routes/payment.js';

/**
 * The main function to start the entire server.
 */
async function startServer() {
  // 1. Run startup tasks
  await loadDataIntoCache();
  await connectToMongo();

  // 2. Create Express app
  const app = express();

  // 3. Apply global middleware
  app.use(cors());
  app.use(express.urlencoded({ extended: true })); // For aamarpay IPN
  app.use(express.json()); // For all other JSON requests

  // 4. Use the routers
  app.use(authRoutes);     // Handles /register, /login
  app.use(dataRoutes);     // Handles /decks, /sync-progress
  app.use(paymentRoutes);  // Handles all payment URLs

  // 5. Add a simple root endpoint for health checks
  app.get('/', (req, res) => {
    res.send('Hello Ali reza! Your server is running.');
  });

  // 6. Start the server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`🚀 Server is running on port ${port}`);
  });
}

// 🚀 Run the server!
startServer();