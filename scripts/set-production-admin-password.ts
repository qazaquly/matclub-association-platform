import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma-node/client";
import { hashPassword } from "../lib/security";

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.env.ENVIRONMENT !== "production") throw new Error("ENVIRONMENT=production is required.");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const role = requiredEnvironment("BOOTSTRAP_ADMIN_ROLE");
if (role !== "president" && role !== "vice_president_2") throw new Error("INVALID_PRODUCTION_ADMIN_ROLE");
const email = requiredEnvironment("BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
const password = requiredEnvironment("BOOTSTRAP_ADMIN_PASSWORD");
if (password.length < 14 || password.length > 128) throw new Error("INVALID_PRODUCTION_ADMIN_PASSWORD");

const database = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const user = await database.user.findFirst({
    where: {
      email,
      status: "active",
      archivedAt: null,
      roleAssignments: {
        some: { revokedAt: null, scopeType: "global", role: { slug: role } },
      },
    },
    select: { id: true },
  });
  if (!user) throw new Error("PRODUCTION_ADMIN_NOT_FOUND");
  const passwordHash = await hashPassword(password);
  await database.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: user.id }, data: { passwordHash } });
    await transaction.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        actorUserId: null,
        actionType: "production_bootstrap.password_set",
        targetEntity: "user",
        targetEntityId: user.id,
        newValue: JSON.stringify({ email, role, passwordStorage: "pbkdf2_sha256" }),
        reason: "Secure interactive production bootstrap password setting",
        createdAt: new Date(),
      },
    });
  });
  console.log(`Production administrator password set securely for ${role}. Password and hash were not logged.`);
} finally {
  await database.$disconnect();
}
