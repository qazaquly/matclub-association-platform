import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { bootstrapPrivilegedAccount, type BootstrapAdminRole } from "../lib/bootstrap-admin";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.env.ENVIRONMENT !== "production") throw new Error("ENVIRONMENT=production is required for the production bootstrap command.");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required for the production bootstrap command.");

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const result = await bootstrapPrivilegedAccount(database as never, {
    role: requiredEnvironment("BOOTSTRAP_ADMIN_ROLE") as BootstrapAdminRole,
    email: requiredEnvironment("BOOTSTRAP_ADMIN_EMAIL"),
    password: requiredEnvironment("BOOTSTRAP_ADMIN_PASSWORD"),
    fullName: requiredEnvironment("BOOTSTRAP_ADMIN_FULL_NAME"),
    regionCode: requiredEnvironment("BOOTSTRAP_ADMIN_REGION_CODE"),
    cityDistrict: requiredEnvironment("BOOTSTRAP_ADMIN_CITY_DISTRICT"),
    phone: requiredEnvironment("BOOTSTRAP_ADMIN_PHONE"),
  });
  console.log(`Privileged account created once with role ${result.role}. Password was not logged.`);
} finally {
  await database.$disconnect();
}
