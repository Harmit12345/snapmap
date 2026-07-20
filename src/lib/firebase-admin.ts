/**
 * Firebase Admin SDK — server-side only helper (firebase-admin v14 modular API).
 * Lazily initialised so missing env vars don't crash at import time.
 * Import `verifyFirebaseToken` in any API route that needs auth.
 */
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';

function getAdminApp(): App {
  // Return existing app if already initialised
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    // Full service-account credentials — used for all Admin SDK operations
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });
  }

  // Fallback: project ID only.
  // getAuth().verifyIdToken() still works — firebase-admin fetches Google's
  // public signing certificates automatically to verify the JWT signature.
  const pubProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!pubProjectId) {
    throw new Error(
      'Firebase Admin: set FIREBASE_PROJECT_ID in .env.local'
    );
  }

  return initializeApp({ projectId: pubProjectId });
}

/**
 * Verifies a Firebase ID token and returns the decoded claims.
 * Throws if the token is missing, malformed, expired, or has a bad signature.
 */
export async function verifyFirebaseToken(
  authHeader: string | null
): Promise<DecodedIdToken> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header');
  }

  const idToken = authHeader.slice(7); // strip "Bearer "
  const app = getAdminApp();
  // checkRevoked=false keeps latency low; set to true if you need revocation checks
  const decoded = await getAuth(app).verifyIdToken(idToken, false);
  return decoded;
}
