// This file will hold all your secrets and configuration
export const MONGO_URI = "mongodb+srv://flashcardAppUser:UYRoB3sQXLnCMcWx@cluster0.tsg0mbg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

export const AAMARPAY_STORE_ID = "aamarpaytest";
export const AAMARPAY_SIGNATURE_KEY = "dbb74894e82415a2f7ff0ec3a97e4183";
export const AAMARPAY_API_URL = "https://sandbox.aamarpay.com/jsonpost.php";

// ❗️ Change this to your public URL (from ngrok or later, OCI)
export const SERVER_BASE_URL = "https://your-codespace-url.com"; 

// This was the missing secret for your tokens!
export const JWT_SECRET = "a-very-strong-secret-key-for-development";

// Your data URLs
export const DATA_URLS = [
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/botany.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/botany_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics1.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics1_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics2.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/physics2_mcq.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/zoology.json",
  "https://github.com/monobikkhonmindmap-creator/readytolaunch/releases/download/v2.0-data/zoology_mcq.json"
];