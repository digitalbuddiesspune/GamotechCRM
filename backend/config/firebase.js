import admin from 'firebase-admin';
import { getMessaging as getFirebaseMessaging } from 'firebase-admin/messaging';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FirebaseError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {admin.app.App | null} */
let firebaseAdmin = null;
let initAttempted = false;
/** @type {'success' | 'failed' | 'disabled' | null} */
let initStatus = null;

/**
 * Load service account credentials.
 * Production: FIREBASE_SERVICE_ACCOUNT_JSON (JSON string) or FIREBASE_SERVICE_ACCOUNT_PATH.
 * Development: config/serviceAccount.json fallback.
 */
function loadServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } catch (error) {
      throw new FirebaseError(
        `Invalid FIREBASE_SERVICE_ACCOUNT_JSON: ${error?.message || error}`,
      );
    }
  }

  const serviceAccountPath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    path.join(__dirname, 'serviceAccount.json');

  if (!existsSync(serviceAccountPath)) {
    return null;
  }

  return JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
}

/**
 * Initialize Firebase Admin SDK (singleton).
 * @returns {admin.app.App | null}
 */
export function getFirebaseAdmin() {
  if (firebaseAdmin) return firebaseAdmin;
  if (initAttempted) return null;

  initAttempted = true;

  // Prevent duplicate initialization if another module already initialized.
  const existingApps = typeof admin.getApps === 'function' ? admin.getApps() : admin.apps;
  if (existingApps?.length > 0) {
    firebaseAdmin = typeof admin.getApp === 'function' ? admin.getApp() : admin.app();
    initStatus = 'success';
    logger.info('FirebaseInit', 'Firebase Admin SDK already initialized');
    return firebaseAdmin;
  }

  try {
    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      initStatus = 'disabled';
      logger.warn(
        'FirebaseInit',
        'Firebase credentials not found — FCM disabled (set FIREBASE_SERVICE_ACCOUNT_JSON or serviceAccount.json)',
      );
      return null;
    }

    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new FirebaseError('Service account JSON is missing required fields');
    }

    const cert =
      typeof admin.cert === 'function'
        ? admin.cert(serviceAccount)
        : admin.credential.cert(serviceAccount);

    firebaseAdmin = admin.initializeApp({ credential: cert });
    initStatus = 'success';
    logger.info('FirebaseInit', 'Firebase Admin SDK initialized', {
      projectId: serviceAccount.project_id,
    });
    return firebaseAdmin;
  } catch (error) {
    initStatus = 'failed';
    logger.error('FirebaseInit', 'Firebase Admin SDK initialization failed', {
      error: error?.message || String(error),
    });
    return null;
  }
}

/** @returns {boolean} */
export function isFirebaseReady() {
  return Boolean(getFirebaseAdmin());
}

/** @returns {'success' | 'failed' | 'disabled' | null} */
export function getFirebaseInitStatus() {
  getFirebaseAdmin();
  return initStatus;
}

/**
 * Firebase Cloud Messaging client (firebase-admin v14 modular API).
 * @returns {import('firebase-admin/messaging').Messaging | null}
 */
export function getMessaging() {
  const app = getFirebaseAdmin();
  if (!app) return null;

  // v14+: app.messaging() is no longer available on the App instance.
  if (typeof app.messaging === 'function') {
    return app.messaging();
  }

  return getFirebaseMessaging(app);
}

export default getFirebaseAdmin;
