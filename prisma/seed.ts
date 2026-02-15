import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Seed Ovens ──────────────────────────────────────────────────────
  const oven1 = await prisma.oven.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      name: "Oven 1",
      type: "NON_AQUEOUS",
      status: "AVAILABLE",
      description: "Non-aqueous sample drying oven",
    },
  });

  const oven2 = await prisma.oven.upsert({
    where: { id: 2 },
    update: {},
    create: {
      id: 2,
      name: "Oven 2",
      type: "AQUEOUS",
      status: "AVAILABLE",
      description: "Aqueous sample drying oven",
    },
  });

  console.log(`  ✅ Ovens: ${oven1.name}, ${oven2.name}`);

  // ── Bootstrap Admin User ────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Admin";

  if (adminEmail && adminPassword) {
    const passwordHash = await hash(adminPassword, 12);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {},
      create: {
        name: adminName,
        email: adminEmail,
        phone: "+0000000000",
        passwordHash,
        role: "ADMIN",
        status: "APPROVED",
      },
    });

    console.log(`  ✅ Admin user: ${admin.email}`);
  } else {
    console.log("  ⚠️  ADMIN_EMAIL/ADMIN_PASSWORD not set, skipping admin bootstrap");
  }

  console.log("🌱 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
