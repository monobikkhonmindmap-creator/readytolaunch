// routes/data.js
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// --- NEW: GET SUBJECT DECKS (Practice & Test) ---
// This new endpoint REPLACES the old '/decks'
// It fetches decks for only one subject, e.g., 'physics1'
router.get('/subject/:subjectKey', authenticateToken, (req, res) => {
  // The subjectKey comes from the URL, e.g., "physics1", "botany"
  const { subjectKey } = req.params; 
  console.log(`Controller: getDecks for subject "${subjectKey}"`);
  
  const practiceDecks = [];
  const testDecks = [];

  try {
    // 1. Get the practice decks for this subject (e.g., 'physics1')
    const practiceKey = subjectKey;
    if (global.flashcardCache[practiceKey]) {
      const deckCollection = global.flashcardCache[practiceKey].decks;
      deckCollection.forEach(deck => {
        practiceDecks.push({
          id: `${practiceKey}-${deck.id}`, // e.g., "physics1-1"
          title: deck.title,
          totalCards: deck.cards.length,
          accessibility: deck.accessibility || 'regular'
        });
      });
    }

    // 2. Get the test (MCQ) decks for this subject (e.g., 'physics1_mcq')
    const testKey = `${subjectKey}_mcq`;
    if (global.flashcardCache[testKey]) {
      const deckCollection = global.flashcardCache[testKey].decks;
      deckCollection.forEach(deck => {
        testDecks.push({
          id: `${testKey}-${deck.id}`, // e.g., "physics1_mcq-1"
          title: deck.title,
          totalCards: deck.cards.length,
          accessibility: deck.accessibility || 'regular'
        });
      });
    }

    // 3. Send both lists back
    res.status(200).json({ practiceDecks, testDecks });

  } catch (error) {
    console.error("Error processing subject decks:", error);
    res.status(500).send("Internal Server Error");
  }
});


// --- KEPT: GET DECK BY ID (This logic is still perfect) ---
// This endpoint is unchanged. It's used by the StudyScreen.
router.get('/deck/:deckId', authenticateToken, (req, res) => {
  const { deckId } = req.params; // e.g., "botany-1" or "physics1_mcq-2"
  const userStatus = req.user.status; 

  try {
    const parts = deckId.split('-');
    if (parts.length < 2) {
      return res.status(400).json({ message: "Invalid deck ID format." });
    }
    
    // This logic works for both 'physics1-1' and 'physics1_mcq-1'
    const cacheKey = parts.slice(0, -1).join('-'); // e.g., "physics1" or "physics1_mcq"
    const idInFile = parseInt(parts[parts.length - 1], 10);

    if (!global.flashcardCache[cacheKey]) {
      return res.status(404).json({ message: "Deck collection not found" });
    }
    const deck = global.flashcardCache[cacheKey].decks.find(d => d.id === idInFile);
    if (!deck) {
      return res.status(404).json({ message: "Deck not found" });
    }

    const accessLevel = deck.accessibility || 'regular';
    if (accessLevel === 'premium' && userStatus === 'regular') {
      console.log(`Access DENIED for deck "${deckId}" - User is "regular"`);
      return res.status(403).json({ 
        message: "This is a premium chapter. Please upgrade to access it." 
      });
    }

    console.log(`Access GRANTED for deck "${deckId}"`);
    res.status(200).json({
      id: deckId,
      title: deck.title,
      type: cacheKey.includes('_mcq') ? 'test' : 'practice',
      cards: deck.cards 
    });

  } catch (error) {
    console.error("Error fetching single deck:", error);
    res.status(500).send("Internal Server Error");
  }
});


// --- KEPT: SYNC PROGRESS ENDPOINT (Unchanged) ---
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