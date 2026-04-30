require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  DEMO_MODE: process.env.DEMO_MODE === 'true',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  
  // Firebase configuration
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  GROQ_MODEL: process.env.GROQ_MODEL,
};
