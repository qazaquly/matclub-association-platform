import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runtimeEnv } from "@/lib/runtime-env";

interface DatabaseRequestContext {
  client?: PrismaClient;
}

const globalForPrisma = globalThis as unknown as {
  phaseOnePrisma?: PrismaClient;
  phaseOneDatabaseContext?: AsyncLocalStorage<DatabaseRequestContext>;
};
const databaseContext = globalForPrisma.phaseOneDatabaseContext ??= new AsyncLocalStorage<DatabaseRequestContext>();

function connectionString() {
  const url = runtimeEnv("DATABASE_URL");
  if (!url) {
    throw new Error("DATABASE_URL is required for the PostgreSQL connection.");
  }
  return url;
}

function createDatabaseClient() {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString() }),
  });
}

export async function withRequestDatabase<T>(callback: () => Promise<T>): Promise<T> {
  if (databaseContext.getStore()) return callback();

  const requestContext: DatabaseRequestContext = {};
  return databaseContext.run(requestContext, async () => {
    try {
      return await callback();
    } finally {
      await requestContext.client?.$disconnect();
    }
  });
}

export function getDb() {
  const requestContext = databaseContext.getStore();
  if (requestContext) return requestContext.client ??= createDatabaseClient();
  return globalForPrisma.phaseOnePrisma ??= createDatabaseClient();
}

export type DatabaseClient = ReturnType<typeof getDb>;
