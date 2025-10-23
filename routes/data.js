// routes/data.js
import { Router } from 'express';
import { ObjectId } from 'mongodb';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// --- GET SUBJECT DECKS (Unchanged) ---
// This endpoint is still correct. It sends the LIST of chapters, which is small.
router.get('/subject/:subjectKey', authenticateToken, (req, res) => {
  const { subjectKey } = req.params; // e.g., "physics1", "botany"
  console.log(`Controller: getDecks for subject "${subjectKey}"`);
  
  const practiceDecks = [];
  const testDecks = [];

  try {
    const practiceKey = subjectKey;
    if (global.flashcardCache[practiceKey]) {
      const deckCollection = global.flashcardCache[practiceKey].decks;
      deckCollection.forEach(deck => {
        practiceDecks.push({
          id: `${practiceKey}-${deck.id}`,
          title: deck.title,
          totalCards: deck.cards.length,
          accessibility: deck.accessibility || 'regular'
        });
      });
    }

    const testKey = `${subjectKey}_mcq`;
    if (global.flashcardCache[testKey]) {
      const deckCollection = global.flashcardCache[testKey].decks;
      deckCollection.forEach(deck => {
        testDecks.push({
          id: `${testKey}-${deck.id}`,
          title: deck.title,
          totalCards: deck.cards.length,
          accessibility: deck.accessibility || 'regular'
        });
      });
    }

    res.status(200).json({ practiceDecks, testDecks });

  } catch (error) {
    console.error("Error processing subject decks:", error);
    res.status(500).send("Internal Server Error");
  }
});


// --- UPDATED: GET DECK BY ID (Pagination REMOVED) ---
// This endpoint now sends the FULL deck (e.g., 2MB) for the app to cache.
router.get('/deck/:deckId', authenticateToken, (req, res) => {
  const { deckId } = req.params; 
  const userStatus = req.user.status; 

  try {
    // 1. Parse the deckId
    const parts = deckId.split('-');
    if (parts.length < 2) {
      return res.status(400).json({ message: "Invalid deck ID format." });
    }
    const cacheKey = parts.slice(0, -1).join('-'); // e.g., "physics1"
    const idInFile = parseInt(parts[parts.length - 1], 10);

    // 2. Find the deck in the cache
    if (!global.flashcardCache[cacheKey]) {
      return res.status(404).json({ message: "Deck collection not found" });
    }
    const deck = global.flashcardCache[cacheKey].decks.find(d => d.id === idInFile);
    if (!deck) {
      return res.status(404).json({ message: "Deck not found" });
    }

    // 3. CHECK PERMISSION (This logic is still correct)
    const accessLevel = deck.accessibility || 'regular';
    if (accessLevel === 'premium' && userStatus === 'regular') {
      console.log(`Access DENIED for deck "${deckId}" - User is "regular"`);
      return res.status(403).json({ 
        message: "This is a premium chapter. Please upgrade to access it." 
      });
    }

    console.log(`Access GRANTED for deck "${deckId}"`);

    // 4. Send the FULL DECK (not paginated)
    res.status(200).json({
      id: deckId,
      title: deck.title,
      type: cacheKey.includes('_mcq') ? 'test' : 'practice',
      cards: deck.cards // Send the complete cards array
    });

  } catch (error) {
    console.error("Error fetching single deck:", error);
    res.status(500).send("Internal Server Error");
  }
});


// --- REWRITTEN: SYNC PROGRESS ENDPOINT ---
// This endpoint now supports the new "sparse" progress model
router.post('/sync-progress', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // The app will send a body like:
    // { "updates": { "physics1-1": { "attempts": 10, "successes": 3 } } }
    const { updates } = req.body;

    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No progress data provided." });
    }

    // Build the MongoDB update operation using "dot notation"
    // This is the magic that solves your 512MB limit.
    const updateOperation = { $set: {} };
    for (const cardId in updates) {
      // This creates a key like: "progress.physics1-1"
      updateOperation.$set[`progress.${cardId}`] = updates[cardId];
    }
    
    // Update only the specific fields in the user's "progress" object
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