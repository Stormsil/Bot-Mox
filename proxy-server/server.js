/**
 * IPQualityScore Proxy Server
 * Локальный Express.js сервер для проксирования запросов к IPQualityScore API
 * Решает проблему CORS для локальной разработки
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load .env if exists (optional)
try {
  require('dotenv').config();
} catch (e) {
  // .env not required, continue without it
}

const app = express();
const PORT = process.env.PORT || 3001;

// Firebase Admin SDK initialization
let firebaseInitialized = false;
let firebaseApp = null;

// Default Firebase configuration
const DEFAULT_FIREBASE_CONFIG = {
  serviceAccountPath: path.join(__dirname, '..', 'Assets', 'firebase-key.json'),
  databaseURL: 'https://botfarm-d69b7-default-rtdb.europe-west1.firebasedatabase.app/'
};

function initializeFirebase() {
  try {
    // Check for service account file at default location
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || DEFAULT_FIREBASE_CONFIG.serviceAccountPath;
    const databaseURL = process.env.FIREBASE_DATABASE_URL || DEFAULT_FIREBASE_CONFIG.databaseURL;

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: databaseURL
      });
      console.log('✅ Firebase Admin initialized with service account');
      firebaseInitialized = true;
      return true;
    } else if (databaseURL) {
      // Fallback: try initialization without service account (requires GOOGLE_APPLICATION_CREDENTIALS)
      try {
        firebaseApp = admin.initializeApp({
          databaseURL: databaseURL
        });
        console.log('✅ Firebase Admin initialized (using default credentials)');
        firebaseInitialized = true;
        return true;
      } catch (fallbackError) {
        console.warn('⚠️ Firebase not configured. Will check .env fallback for API key.');
        return false;
      }
    } else {
      console.warn('⚠️ Firebase not configured. Will check .env fallback for API key.');
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to initialize Firebase:', error.message);
    console.warn('⚠️ Will check .env fallback for API key.');
    return false;
  }
}

// CORS configuration - allow common dev origins
const corsOptions = {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

/**
 * Получает API ключ IPQS из Firebase Realtime Database
 * @returns {Promise<string|null>} API ключ или null
 */
async function getIPQSApiKeyFromFirebase() {
  if (!firebaseInitialized) {
    return null;
  }

  try {
    const db = admin.database();
    const snapshot = await db.ref('settings/api_keys/ipqs/api_key').once('value');
    const apiKey = snapshot.val();

    if (apiKey && apiKey.length > 0) {
      console.log('✅ IPQS API key loaded from Firebase');
      return apiKey;
    }

    console.warn('⚠️ IPQS API key not found in Firebase');
    return null;
  } catch (error) {
    console.error('❌ Error reading IPQS API key from Firebase:', error.message);
    return null;
  }
}

/**
 * Получает API ключ IPQS (Firebase -> .env fallback)
 * @returns {Promise<string|null>} API ключ или null
 */
async function getIPQSApiKey() {
  // Сначала пробуем получить из Firebase
  const firebaseKey = await getIPQSApiKeyFromFirebase();
  if (firebaseKey) {
    return firebaseKey;
  }

  // Fallback на .env
  const envKey = process.env.IPQS_API_KEY;
  if (envKey && envKey.length > 0) {
    console.log('✅ IPQS API key loaded from .env');
    return envKey;
  }

  console.warn('⚠️ IPQS API key not found in Firebase or .env - IP checks will return error');
  return null;
}

/**
 * Проверяет, включена ли проверка IPQS
 * @returns {Promise<boolean>}
 */
async function isIPQSEnabled() {
  if (!firebaseInitialized) {
    // Если Firebase не инициализирован, считаем включенным если есть ключ в .env
    return !!process.env.IPQS_API_KEY;
  }

  try {
    const db = admin.database();
    const snapshot = await db.ref('settings/api_keys/ipqs/enabled').once('value');
    // If not set in Firebase, default to true if we have any API key
    const enabledInDb = snapshot.val();
    if (enabledInDb === null || enabledInDb === undefined) {
      const hasKey = !!(await getIPQSApiKey());
      return hasKey;
    }
    return enabledInDb === true;
  } catch (error) {
    console.error('❌ Error checking IPQS enabled status:', error.message);
    return !!process.env.IPQS_API_KEY;
  }
}

// Health check endpoint
app.get('/api/status', async (req, res) => {
  const apiKey = await getIPQSApiKey();
  const enabled = await isIPQSEnabled();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    firebase_initialized: firebaseInitialized,
    ipqs: {
      enabled: enabled,
      configured: !!apiKey
    }
  });
});

// IP Quality Check endpoint
app.post('/api/check-ip', async (req, res) => {
  try {
    const { ip } = req.body;

    // Validate IP
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'IP address is required'
      });
    }

    // Validate IP format (basic regex)
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipRegex.test(ip)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid IP address format'
      });
    }

    // Check if IPQS is enabled
    const enabled = await isIPQSEnabled();
    if (!enabled) {
      return res.status(503).json({
        success: false,
        error: 'IPQS check is disabled'
      });
    }

    // Get API key
    const apiKey = await getIPQSApiKey();
    if (!apiKey) {
      return res.status(503).json({
        success: false,
        error: 'IPQS API key not configured. Please add API key to Firebase Realtime Database at settings/api_keys/ipqs/api_key or set IPQS_API_KEY in .env'
      });
    }

    // Make request to IPQualityScore API
    const IPQS_API_BASE = 'https://www.ipqualityscore.com/api/json/ip';
    const url = `${IPQS_API_BASE}/${apiKey}/${ip}?strictness=1&allow_public_access_points=true&fast=true`;

    console.log(`🔍 Checking IP: ${ip}`);
    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = response.data;

    if (!data.success) {
      console.warn('⚠️ IPQS API returned error:', data.message);
      return res.status(400).json({
        success: false,
        error: data.message || 'IPQS API error'
      });
    }

    console.log(`✅ IP check completed for ${ip}, fraud_score: ${data.fraud_score}`);

    // Return successful response
    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ Error checking IP quality:', error.message);

    if (error.response) {
      // IPQS API returned an error response
      return res.status(error.response.status).json({
        success: false,
        error: `IPQS API error: ${error.response.status}`,
        details: error.response.data
      });
    }

    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({
        success: false,
        error: 'Request timeout'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Batch IP check endpoint (optional)
app.post('/api/check-ip-batch', async (req, res) => {
  try {
    const { ips } = req.body;

    if (!Array.isArray(ips) || ips.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Array of IP addresses is required'
      });
    }

    if (ips.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 10 IPs per batch request'
      });
    }

    // Check if IPQS is enabled and configured
    const enabled = await isIPQSEnabled();
    const apiKey = await getIPQSApiKey();

    if (!enabled || !apiKey) {
      return res.status(503).json({
        success: false,
        error: 'IPQS check is disabled or not configured'
      });
    }

    // Process all IPs concurrently
    const results = await Promise.all(
      ips.map(async (ip) => {
        try {
          const IPQS_API_BASE = 'https://www.ipqualityscore.com/api/json/ip';
          const url = `${IPQS_API_BASE}/${apiKey}/${ip}?strictness=1&allow_public_access_points=true&fast=true`;

          const response = await axios.get(url, { timeout: 10000 });
          return {
            ip,
            success: true,
            data: response.data
          };
        } catch (error) {
          return {
            ip,
            success: false,
            error: error.message
          };
        }
      })
    );

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Error in batch IP check:', error.message);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Initialize Firebase and start server
initializeFirebase();

app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║           IPQualityScore Proxy Server                      ║
╠════════════════════════════════════════════════════════════╣
║  Server running on: http://localhost:${PORT}                ║
║  Status endpoint:   http://localhost:${PORT}/api/status     ║
║  Check IP endpoint: http://localhost:${PORT}/api/check-ip   ║
╠════════════════════════════════════════════════════════════╣
║  CORS enabled for: ${corsOptions.origin.join(', ')}  ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
