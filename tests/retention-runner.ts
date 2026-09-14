import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { runArchiveRetentionWithDependencies } from "../lib/archive-retention";

const connectionString = process.env.DATABASE_URL;
const nowValue = process.env.RETENTION_TEST_NOW;
if (!connectionString || !nowValue) throw new Error("RETENTION_TEST_CONFIGURATION_REQUIRED");
const now = new Date(nowValue);
if (Number.isNaN(now.getTime())) throw new Error("RETENTION_TEST_TIME_INVALID");

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  // Both generated clients share the same Prisma schema; only their runtime-specific transaction types are nominally distinct.
  await runArchiveRetentionWithDependencies(database as never, {
    async put() { throw new Error("not used by retention"); },
    async get() { throw new Error("not used by retention"); },
    async delete(key) { await database.publicObject.deleteMany({ where: { objectKey: key } }); },
  }, now);
} finally {
  await database.$disconnect();
}
