import { MongoClient } from 'mongodb';
import fs from 'node:fs';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'eee_sim';
const c = new MongoClient(uri);
await c.connect();
const col = c.db(dbName).collection('benches');
const docs = await col.find({}).toArray();
console.log('total docs:', docs.length);
for (const d of docs) {
  console.log('---', d.roll, '|', d.name, '| dev:', d.devices, 'wires:', d.wires);
}
fs.writeFileSync('/tmp/all-benches.json', JSON.stringify(docs, null, 2));
await c.close();
