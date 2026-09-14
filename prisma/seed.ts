import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { seedDatabase } from "../db/bootstrap";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required for the PostgreSQL development seed.");

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
await seedDatabase(database as unknown as Parameters<typeof seedDatabase>[0]);
await database.$disconnect();
