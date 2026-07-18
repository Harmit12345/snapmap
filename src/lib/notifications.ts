import { getDb } from './db';
import type { Memory } from './types';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin lazily to prevent crashing if keys are missing
function getFirebaseAdmin() {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    return null;
  }
  
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // Handle escaped newlines in the private key string
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
  }
  
  return admin;
}

// Helper to escape special regex characters in user input
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sends Push Notifications via FCM (Firebase Cloud Messaging)
 * when a new memory is created at a subscribed location.
 *
 * Uses HIERARCHICAL matching: if a user subscribed to "Junagadh" (a city),
 * they will get notified about a memory at "Mullah Wada, Junagadh" because
 * both share the same city. This solves the granularity mismatch problem
 * where Nominatim might resolve to a local sub-area name.
 */
export async function notifySubscribersOfNewMemory(memory: Memory) {
  if (!memory.locationName) return;

  try {
    const db = await getDb();

    // Fetch the full memory document to get city/state/country hierarchy
    const memDoc = await db.collection<any>('memories').findOne({ _id: memory.id });
    const memCity = memDoc?.city || null;
    const memState = memDoc?.state || null;
    const memCountry = memDoc?.country || null;

    // Build a hierarchical subscription query:
    const matchConditions: any[] = [
      { locationName: memory.locationName }
    ];

    if (memCity) {
      matchConditions.push({ city: { $regex: new RegExp(`^${escapeRegex(memCity)}$`, 'i') } });
      matchConditions.push({ locationName: { $regex: new RegExp(`^${escapeRegex(memCity)}$`, 'i') } });
    }

    if (memory.locationName) {
      matchConditions.push({ locationName: { $regex: new RegExp(escapeRegex(memory.locationName), 'i') } });
    }

    // NEW: If the memory has a full address, split it by commas (e.g., "Keshod Taluka, Junagadh, Gujarat")
    // and match subscriptions that follow ANY of those specific address parts.
    // This perfectly solves the issue where Nominatim puts the city in county/state_district.
    if (memDoc?.address) {
      const addressParts = memDoc.address.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (addressParts.length > 0) {
        const exactPartRegexes = addressParts.map((part: string) => new RegExp(`^${escapeRegex(part)}$`, 'i'));
        matchConditions.push({ locationName: { $in: exactPartRegexes } });
      }
    }

    // 1. Find all users subscribed to this location (hierarchically)
    const subscriptions = await db.collection('location_subscriptions').find({ 
      $or: matchConditions
    }).toArray();

    if (subscriptions.length === 0) return;

    const userIds = [...new Set(subscriptions.map(sub => (sub as any).userId))];

    // 2. Retrieve their push tokens (exclude the memory author themselves)
    const tokensDocs = await db.collection('user_push_tokens').find({
      userId: { $in: userIds, $ne: memory.userId }
    }).toArray();

    const pushTokens = tokensDocs.map(doc => (doc as any).token).filter(Boolean);

    if (pushTokens.length === 0 && userIds.length === 0) return;

    // 3. Insert In-App Notifications into MongoDB
    // Note: For testing purposes (single user), we are NOT filtering out the memory author.
    // In production, you might want to uncomment this line: 
    // const recipientUserIds = userIds.filter(id => id !== memory.userId);
    const recipientUserIds = userIds;
    
    // De-duplicate: don't send multiple notifications to the same user for the same memory
    const existingNotifications = await db.collection('notifications').find({
      memoryId: memory.id,
      userId: { $in: recipientUserIds }
    }).toArray();
    const alreadyNotified = new Set(existingNotifications.map(n => (n as any).userId));
    const newRecipients = recipientUserIds.filter(id => !alreadyNotified.has(id));

    const displayLocation = memory.locationName || memCity || 'a location you follow';

    const notificationDocs = newRecipients.map(userId => ({
      userId,
      memoryId: memory.id,
      locationName: memory.locationName,
      title: `New memory at ${displayLocation}`,
      body: memory.title || 'Someone just shared a memory near a location you follow!',
      url: `/locations/${encodeURIComponent(memory.locationName || '')}`,
      read: false,
      createdAt: new Date(),
    }));

    if (notificationDocs.length > 0) {
      await db.collection('notifications').insertMany(notificationDocs);
      console.log(`[IN-APP] Inserted ${notificationDocs.length} notifications into MongoDB.`);
    }

    // 4. Send FCM Push Notification payload (Optional/Future)
    const payload = {
      notification: {
        title: `New memory at ${displayLocation}`,
        body: memory.title || 'Someone just shared a memory near a location you follow!'
      },
      data: {
        memoryId: memory.id,
        url: `/locations/${encodeURIComponent(memory.locationName || '')}`
      },
      tokens: pushTokens
    };

    const firebaseAdmin = getFirebaseAdmin();

    if (firebaseAdmin) {
      console.log(`[FCM] Sending live push notification to ${pushTokens.length} devices...`);
      const response = await firebaseAdmin.messaging().sendEachForMulticast(payload);
      console.log(`[FCM] Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);
    } else {
      console.log(`[PUSH NOTIFICATION SIMULATION] Firebase keys missing in .env.local! Simulating send to ${pushTokens.length} devices:`, payload.notification);
    }

  } catch (err) {
    console.error('Error notifying subscribers:', err);
  }
}
