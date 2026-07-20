import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function main() {
  const uri = process.env.DATABASE_URL || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Missing DATABASE_URL in environment.');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db();

    // Create 2dsphere index on memories collection
    console.log('Creating 2dsphere index on memories.location...');
    await db.collection('memories').createIndex({ location: '2dsphere' });
    console.log('Successfully created 2dsphere index on memories.');

    // Create index on location_subscriptions
    console.log('Creating indexes on location_subscriptions...');
    await db.collection('location_subscriptions').createIndex({ locationName: 1, userId: 1 }, { unique: true });
    await db.collection('location_subscriptions').createIndex({ locationName: 1 });
    await db.collection('location_subscriptions').createIndex({ userId: 1 });
    console.log('Successfully created indexes on location_subscriptions.');

  } catch (err) {
    console.error('Error setting up DB:', err);
  } finally {
    await client.close();
  }
}

main();
