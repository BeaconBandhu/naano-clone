/* Real MongoDB connection (Atlas) — the hosted-database step BACKEND.md
 * flagged as the one piece SQLite can't do on Vercel (its filesystem isn't
 * durable outside /tmp). Everything else in this repo avoids npm packages
 * (node:sqlite, node:crypto, raw fetch for Stripe/OpenAI) because those are
 * plain REST/HTTP underneath. MongoDB's wire protocol isn't — there's no
 * REST equivalent to hand-roll here, so this is the one real dependency
 * (`mongodb`, the official driver).
 *
 * Serverless-safe connection reuse: Vercel can keep a function instance warm
 * across requests, so the client is cached on `global` rather than
 * reconnecting every invocation (MongoDB's own guidance for serverless).
 */
import { MongoClient } from "mongodb";

// process.env.MONGODB_URI is read lazily inside each function, never at
// module top level - local dev loads .env *after* this module is imported
// (see server/serve.mjs), so a top-level read would always see it as unset.
// Same convention as api/_lib/stripe.mjs and api/_lib/rag.mjs.
let cached = globalThis.__naanoMongo;
if (!cached) cached = globalThis.__naanoMongo = { client: null, promise: null };

export function hasMongo() {
  return !!process.env.MONGODB_URI;
}

export async function getMongoDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw Object.assign(new Error("MONGODB_URI is not set."), { status: 503 });
  }
  if (!cached.promise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    cached.promise = client.connect().then((c) => {
      cached.client = c;
      return c;
    });
  }
  const client = await cached.promise;
  return client.db(); // uses the database named in the connection string
}

export async function getCollection(name) {
  const db = await getMongoDb();
  return db.collection(name);
}
