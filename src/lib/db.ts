import { createClient } from '@supabase/supabase-js';
import { MongoClient, Db } from 'mongodb';

// 1. Supabase Client for Storage (Media Uploads)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 2. MongoDB Client for database queries
const connectionString = process.env.DATABASE_URL || 'mongodb://localhost:27017/snapmap';
let mongoClient: MongoClient;

// In Next.js, we want to reuse the connection in development mode
const globalForMongo = global as unknown as { mongoClient: MongoClient };

if (process.env.NODE_ENV === 'development') {
  if (!globalForMongo.mongoClient) {
    globalForMongo.mongoClient = new MongoClient(connectionString);
  }
  mongoClient = globalForMongo.mongoClient;
} else {
  mongoClient = new MongoClient(connectionString);
}

let clientPromise: Promise<MongoClient> | null = null;

export async function getDb(): Promise<Db> {
  if (!clientPromise) {
    clientPromise = mongoClient.connect().catch(err => {
      clientPromise = null; // Reset so next try can attempt again
      console.error('MongoDB connection failed:', err.message);
      throw err;
    });
  }
  
  const client = await clientPromise;
  const dbName = new URL(connectionString).pathname.slice(1) || 'snapmap';
  return client.db(dbName);
}

// UUID Helper
export function genId(): string {
  return crypto.randomUUID();
}
