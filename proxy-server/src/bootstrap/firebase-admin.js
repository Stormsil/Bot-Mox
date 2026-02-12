const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const PROXY_ROOT = path.resolve(__dirname, '..', '..');

const DEFAULT_FIREBASE_CONFIG = {
  serviceAccountCandidates: [
    path.join(REPO_ROOT, 'firebase-key.json'),
    path.join(REPO_ROOT, 'Assets', 'firebase-key.json'),
    path.join(PROXY_ROOT, 'firebase-key.json'),
    path.join(PROXY_ROOT, 'Assets', 'firebase-key.json'),
  ],
  databaseRegion: String(process.env.FIREBASE_DATABASE_REGION || 'europe-west1').trim(),
};

function buildDefaultDatabaseUrl(projectId, region = DEFAULT_FIREBASE_CONFIG.databaseRegion) {
  const normalizedProjectId = String(projectId || '').trim();
  if (!normalizedProjectId) return '';
  const normalizedRegion = String(region || '').trim() || 'europe-west1';
  return `https://${normalizedProjectId}-default-rtdb.${normalizedRegion}.firebasedatabase.app/`;
}

function toUniqueArray(values) {
  return [...new Set(values.filter(Boolean))];
}

function resolveServiceAccountPath() {
  const envPath = String(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();
  const envCandidates = envPath
    ? [
        envPath,
        path.resolve(process.cwd(), envPath),
        path.resolve(PROXY_ROOT, envPath),
        path.resolve(REPO_ROOT, envPath),
      ]
    : [];

  const allCandidates = toUniqueArray([
    ...envCandidates,
    ...DEFAULT_FIREBASE_CONFIG.serviceAccountCandidates,
  ]);

  for (const candidate of allCandidates) {
    try {
      const absoluteCandidate = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate);
      if (fs.existsSync(absoluteCandidate)) {
        return absoluteCandidate;
      }
    } catch (_error) {
      // ignore candidate resolution errors
    }
  }

  return null;
}

function initializeFirebaseAdmin({ admin, logger = console }) {
  try {
    const serviceAccountPath = resolveServiceAccountPath();
    const serviceAccount = serviceAccountPath ? require(serviceAccountPath) : null;
    const projectId =
      String(process.env.FIREBASE_PROJECT_ID || serviceAccount?.project_id || '').trim() || undefined;
    const databaseURL =
      String(process.env.FIREBASE_DATABASE_URL || '').trim() ||
      buildDefaultDatabaseUrl(projectId, process.env.FIREBASE_DATABASE_REGION);

    if (serviceAccountPath) {
      const config = {
        credential: admin.credential.cert(serviceAccount),
      };
      if (databaseURL) {
        config.databaseURL = databaseURL;
      }
      admin.initializeApp(config);
      logger.log(`✅ Firebase Admin initialized with service account (${serviceAccountPath})`);
      return true;
    }

    if (!databaseURL) {
      logger.warn('⚠️ Firebase not configured. Will check .env fallback for API key.');
      return false;
    }

    try {
      admin.initializeApp({ databaseURL });
      logger.log('✅ Firebase Admin initialized (using default credentials)');
      return true;
    } catch (_error) {
      logger.warn('⚠️ Firebase not configured. Will check .env fallback for API key.');
      return false;
    }
  } catch (error) {
    logger.error('❌ Failed to initialize Firebase:', error.message);
    logger.warn('⚠️ Will check .env fallback for API key.');
    return false;
  }
}

module.exports = {
  initializeFirebaseAdmin,
};
