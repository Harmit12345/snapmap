/**
 * MongoDB Index Setup Script
 * 
 * Run this script to create required indexes for SnapMap:
 *   npx tsx scripts/setup-indexes.ts
 * 
 * Required indexes:
 * - 2dsphere on memories.location (for $near geospatial queries)
 * - Text indexes on searchable fields
 * - Compound indexes for pagination performance
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || 'mongodb://localhost:27017/snapmap';

async function setupIndexes() {
  const client = new MongoClient(connectionString);
  
  try {
    await client.connect();
    const dbName = new URL(connectionString).pathname.slice(1) || 'snapmap';
    const db = client.db(dbName);
    
    console.log(`Connected to MongoDB: ${dbName}`);
    console.log('Creating indexes...\n');

    // ---- memories collection ----
    const memories = db.collection('memories');
    
    // 2dsphere index for geospatial queries ($near)
    await memories.createIndex({ location: '2dsphere' });
    console.log('✅ memories.location (2dsphere)');
    
    // Compound index for timeline pagination
    await memories.createIndex({ userId: 1, createdAt: -1, _id: -1 });
    console.log('✅ memories.userId + createdAt + _id (compound)');
    
    // Index for location-based queries
    await memories.createIndex({ locationName: 1, status: 1, visibility: 1 });
    console.log('✅ memories.locationName + status + visibility');
    
    // Index for city-based queries (hierarchical matching)
    await memories.createIndex({ city: 1, status: 1 });
    console.log('✅ memories.city + status');
    
    // Text index for search
    await memories.createIndex(
      { title: 'text', body: 'text', locationName: 'text', address: 'text', hashtags: 'text' },
      { name: 'memories_text_search' }
    );
    console.log('✅ memories text index (title, body, locationName, address, hashtags)');

    // ---- location_subscriptions collection ----
    const subscriptions = db.collection('location_subscriptions');
    
    // Compound index for subscription lookups
    await subscriptions.createIndex({ userId: 1, locationName: 1 }, { unique: true });
    console.log('✅ location_subscriptions.userId + locationName (unique compound)');
    
    // Index for notification matching by city
    await subscriptions.createIndex({ city: 1 });
    console.log('✅ location_subscriptions.city');
    
    // Index for finding all subscribers of a location
    await subscriptions.createIndex({ locationName: 1 });
    console.log('✅ location_subscriptions.locationName');

    // ---- notifications collection ----
    const notifications = db.collection('notifications');
    
    // Index for fetching user's notifications
    await notifications.createIndex({ userId: 1, createdAt: -1 });
    console.log('✅ notifications.userId + createdAt');
    
    // Index for de-duplication check
    await notifications.createIndex({ memoryId: 1, userId: 1 });
    console.log('✅ notifications.memoryId + userId');

    // ---- memory_likes collection ----
    const likes = db.collection('memory_likes');
    await likes.createIndex({ memoryId: 1, userId: 1 }, { unique: true });
    console.log('✅ memory_likes.memoryId + userId (unique)');

    // ---- memory_favorites collection ----
    const favorites = db.collection('memory_favorites');
    await favorites.createIndex({ memoryId: 1, userId: 1 }, { unique: true });
    console.log('✅ memory_favorites.memoryId + userId (unique)');

    // ---- categories collection ----
    const categories = db.collection('categories');
    await categories.createIndex({ id: 1 }, { unique: true });
    console.log('✅ categories.id (unique)');

    console.log('\n🎉 All indexes created successfully!');
    
  } catch (err) {
    console.error('❌ Error creating indexes:', err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupIndexes();
