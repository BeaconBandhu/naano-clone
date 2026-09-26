/* Real, persistent, zero-dependency database access — Node's built-in
 * node:sqlite (stable since Node 22.5, no flag needed on the Node 24+ this
 * repo already requires). No npm package, matching this repo's existing
 * "plain fetch/plain APIs, no SDK" convention one layer further down: even
 * the database driver is something Node ships, not something installed.
 *
 * IMPORTANT — this is real for local dev / a self-hosted deploy, but NOT a
 * substitute for a hosted database in a Vercel deployment: Vercel's
 * filesystem is read-only outside /tmp, and /tmp is wiped between
 * invocations and not shared across concurrent instances. On Vercel this
 * still runs (writes to /tmp so it doesn't crash) but will NOT reliably
 * persist data across requests. Swapping this module for a hosted
 * SQLite-compatible store (e.g. Turso/libSQL, same SQL dialect) is the one
 * change needed to make it production-durable — every other file in this
 * backend (auth, wallet, creators, campaigns) talks to the small interface
 * below, not to node:sqlite directly, specifically so that swap stays
 * localized to this one file.
 */
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCHEMA_PATH = join(ROOT, "db", "schema.sql");
const DEFAULT_PATH = process.env.VERCEL ? "/tmp/naano.db" : join(ROOT, "data", "naano.db");
const DB_PATH = process.env.SQLITE_PATH || DEFAULT_PATH;

let _db = null;

export function getDb() {
  if (_db) return _db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  _db = new DatabaseSync(DB_PATH);
  _db.exec(readFileSync(SCHEMA_PATH, "utf8"));
  if (process.env.VERCEL) {
    console.warn(
      "[db] Running on Vercel with the local-file SQLite backend (%s). " +
        "This works but /tmp is not durable storage - data will not reliably " +
        "survive between invocations. See api/_lib/db.mjs's header comment.",
      DB_PATH
    );
  }
  return _db;
}

export function all(sql, params = []) {
  return getDb().prepare(sql).all(...params);
}

export function get(sql, params = []) {
  return getDb().prepare(sql).get(...params);
}

export function run(sql, params = []) {
  return getDb().prepare(sql).run(...params);
}

/** Run `fn` inside a transaction; rolls back if `fn` throws. */
export function transaction(fn) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}
