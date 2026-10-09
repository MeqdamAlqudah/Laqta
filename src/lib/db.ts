import { PrismaClient } from "@prisma/client";

// Singleton pattern: Next.js hot-reload would otherwise create a new
// connection pool on every file change and exhaust the database.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
