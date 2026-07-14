require('dotenv').config({ path: '.env.local' });
const { MongoClient } = require('mongodb');

const connectionString = process.env.DATABASE_URL || 'mongodb://localhost:27017/snapmap';

async function fix() {
  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const dbName = new URL(connectionString).pathname.slice(1) || 'snapmap';
    const db = client.db(dbName);

    // Fetch the new categories
    const categories = await db.collection('categories').find({}).toArray();
    const colorMap = {};
    categories.forEach(c => { colorMap[c.slug] = c.color; });

    // Update existing memories
    const memories = await db.collection('memories').find({}).toArray();
    let updatedCount = 0;

    for (const mem of memories) {
      if (mem.categories && mem.categories.length > 0) {
        let changed = false;
        mem.categories = mem.categories.map(cat => {
          if (colorMap[cat.slug] && colorMap[cat.slug] !== cat.color) {
            changed = true;
            return { ...cat, color: colorMap[cat.slug] };
          }
          return cat;
        });

        if (changed) {
          await db.collection('memories').updateOne({ _id: mem._id }, { $set: { categories: mem.categories } });
          updatedCount++;
        }
      }
    }
    
    console.log(`Updated ${updatedCount} memories with new colors.`);
  } catch (error) {
    console.error(error);
  } finally {
    await client.close();
  }
}

fix();
