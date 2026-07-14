require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const connectionString = process.env.DATABASE_URL || 'mongodb://localhost:27017/snapmap';

const categories = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    slug: "nature",
    displayName: "Nature",
    icon: "leaf",
    color: "#2D6A4F", // Dark Green
    sortOrder: 1,
    isActive: true
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    slug: "urban",
    displayName: "Urban",
    icon: "building",
    color: "#264653", // Dark Slate Blue
    sortOrder: 2,
    isActive: true
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    slug: "food",
    displayName: "Food",
    icon: "utensils",
    color: "#E76F51", // Burnt Orange
    sortOrder: 3,
    isActive: true
  },
  {
    id: "00000000-0000-0000-0000-000000000004",
    slug: "event",
    displayName: "Event",
    icon: "calendar",
    color: "#E63946", // Map Pin Red
    sortOrder: 4,
    isActive: true
  },
  {
    id: "00000000-0000-0000-0000-000000000005",
    slug: "art",
    displayName: "Art",
    icon: "palette",
    color: "#E9C46A", // Golden Yellow
    sortOrder: 5,
    isActive: true
  }
];

async function seed() {
  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const dbName = new URL(connectionString).pathname.slice(1) || 'snapmap';
    const db = client.db(dbName);

    console.log(`Connected to database: ${dbName}`);

    // Create collections if they don't exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('categories')) await db.createCollection('categories');
    if (!collectionNames.includes('memories')) await db.createCollection('memories');
    if (!collectionNames.includes('memory_likes')) await db.createCollection('memory_likes');
    if (!collectionNames.includes('memory_favorites')) await db.createCollection('memory_favorites');

    // Indexes
    await db.collection('memories').createIndex({ location: "2dsphere" });
    await db.collection('memory_likes').createIndex({ memoryId: 1, userId: 1 }, { unique: true });
    await db.collection('memory_favorites').createIndex({ memoryId: 1, userId: 1 }, { unique: true });

    // Seed categories
    await db.collection('categories').deleteMany({});
    await db.collection('categories').insertMany(categories);

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await client.close();
  }
}

seed();
