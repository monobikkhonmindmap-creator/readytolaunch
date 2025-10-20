// startup/cache.js
import { DATA_URLS } from '../config.js';

/**
 * Fetches all 8 data files and loads them into global.flashcardCache
 */
export async function loadDataIntoCache() {
  console.log("Starting to fetch flashcard data...");
  global.flashcardCache = {}; // Initialize the cache
  
  try {
    const allResponses = await Promise.all(DATA_URLS.map(url => fetch(url)));
    const allJsonData = await Promise.all(
      allResponses.map(res => {
        if (!res.ok) throw new Error(`Failed to fetch ${res.url}: ${res.statusText}`);
        return res.json();
      })
    );

    allJsonData.forEach((data, index) => {
      const url = DATA_URLS[index];
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