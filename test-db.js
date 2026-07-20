const { MongoClient } = require('mongodb');
const uri = "mongodb+srv://harmit123%40admin:harmit123@cluster0.0swjwzv.mongodb.net/snapmap?appName=Cluster0";

async function run() {
  try {
    const client = new MongoClient(uri);
    await client.connect();
    console.log("Connected successfully to server");
    await client.close();
  } catch (error) {
    console.error("Connection error:", error);
  }
}
run();
