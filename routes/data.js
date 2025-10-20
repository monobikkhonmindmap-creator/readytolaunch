// routes/data.js
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// --- GET DECKS ENDPOINT ---
router.get('/decks', authenticateToken, (req, res) => {
  const userStatus = req.user.status; 
  const allDeckNames = Object.keys(global.flashcardCache);
  let accessibleDecks = [];

  if (userStatus === 'premium') {
    accessibleDecks = allDeckNames;
  } else {
    accessibleDecks = allDeckNames.filter(name => !name.endsWith('_mcq'));
  }

  const deckData = accessibleDecks.map(name => ({
    id: name,
    title: name.replace('_', ' ').replace(/^(.)/, c => c.toUpperCase()),
    cardCount: global.flashcardCache[name].length 
  }));
  res.status(200).json(deckData);
});

// --- SYNC PROGRESS ENDPOINT ---
router.post('/sync-progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { lastAttempts, test_taken } = req.body;

    if (!lastAttempts && !test_taken) {
      return res.status(400).json({ message: "No progress data provided." });
    }

    const updateOperation = { $set: {} };
    if (lastAttempts) {
      updateOperation.$set.lastAttempts = lastAttempts; 
    }
    if (test_taken) {
      updateOperation.$set.test_taken = test_taken;
    }
    
    await global.db.collection('users').updateOne(
      { _id: new ObjectId(userId) },
      updateOperation
    );

    res.status(200).json({ message: "Progress synced successfully." });
  } catch (error) {
    console.error("Error in /sync-progress:", error);
    res.status(500).json({ message: "Server error while syncing progress." });
  }
});

export default router;