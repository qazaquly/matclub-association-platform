import "dotenv/config";
import { defineConfig } from "prisma/config";

const datasourceUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/rmb_phase_one?sslmode=disable";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: datasourceUrl,
  },
});
