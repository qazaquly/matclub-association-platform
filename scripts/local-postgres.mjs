import { access } from "node:fs/promises";
import { resolve } from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const databaseDir = resolve(".postgres", "development");
const databaseName = process.env.POSTGRES_DATABASE ?? "rmb_phase_one";
const port = Number(process.env.POSTGRES_PORT ?? 55432);
const user = process.env.POSTGRES_USER ?? "postgres";
const password = process.env.POSTGRES_PASSWORD ?? "postgres";
if (!/^[a-z][a-z0-9_]*$/.test(databaseName)) throw new Error("POSTGRES_DATABASE must be a lowercase SQL identifier.");

const postgres = new EmbeddedPostgres({
  databaseDir,
  port,
  user,
  password,
  persistent: true,
  onLog: () => {},
  onError: (error) => console.error(error),
});

try {
  await access(resolve(databaseDir, "PG_VERSION"));
} catch {
  await postgres.initialise();
}

await postgres.start();

const client = postgres.getPgClient("postgres");
await client.connect();
const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
if (existing.rowCount === 0) {
  await client.query(`CREATE DATABASE ${databaseName} WITH ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
}
await client.end();

console.log(`PostgreSQL is ready on 127.0.0.1:${port}/${databaseName}`);

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await postgres.stop();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
