/**
 * Bootstrap an agent grant from the CLI.
 *
 * Why this exists: Agent Access is ADMIN-gated in the UI, but the very first
 * grant has no admin who already holds one. Someone has to write the initial
 * row. This is that escape hatch, and it is the ONLY sanctioned way to grant
 * outside /admin/agents.
 *
 * It enforces the same rules as the server action — APPROVED account, validated
 * handle, unique handle, audit fields — by reusing the same helpers. It is not
 * a bypass of the policy, only of the session requirement.
 *
 * Usage:
 *   DATABASE_URL=... npx tsx scripts/grant-agent.ts <email> [handle]
 *   DATABASE_URL=... npx tsx scripts/grant-agent.ts --list
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { allocateHandle, validateHandle } from "../src/lib/agents";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--list") {
    const rows = await prisma.agentProfile.findMany({
      include: { user: { select: { name: true, email: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });
    console.log(`\n${rows.length} agent profile(s):`);
    for (const r of rows) {
      console.log(
        `  ${r.handle.padEnd(20)} ${r.status.padEnd(10)} ${r.user.email} (${r.user.status})`,
      );
    }
    console.log();
    await pool.end();
    return;
  }

  const email = args[0];
  const requestedHandle = args[1];

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, status: true, agentProfile: true },
  });
  if (!user) {
    console.error(`No account for ${email}`);
    process.exit(1);
  }
  if (user.status !== "APPROVED") {
    console.error(`${user.name}'s account is ${user.status} — approve it first.`);
    process.exit(1);
  }
  if (user.agentProfile) {
    console.error(
      `${user.name} already has handle "${user.agentProfile.handle}" (${user.agentProfile.status}).`,
    );
    process.exit(1);
  }

  const taken = (await prisma.agentProfile.findMany({ select: { handle: true } })).map(
    (r) => r.handle,
  );

  let handle: string;
  if (requestedHandle) {
    const problem = validateHandle(requestedHandle);
    if (problem) {
      console.error(`Invalid handle: ${problem}`);
      process.exit(1);
    }
    if (taken.some((h) => h.toLowerCase() === requestedHandle.toLowerCase())) {
      console.error(`Handle "${requestedHandle}" is already taken.`);
      process.exit(1);
    }
    handle = requestedHandle;
  } else {
    handle = allocateHandle(user.name, user.id, taken);
  }

  const created = await prisma.agentProfile.create({
    data: {
      userId: user.id,
      handle,
      status: "GRANTED",
      grantedAt: new Date(),
      // Self-granted: there is no prior admin to attribute this to.
      grantedById: user.id,
    },
  });

  console.log(`\nGranted agent access:`);
  console.log(`  user   : ${user.name} <${user.email}>`);
  console.log(`  handle : ${created.handle}`);
  console.log(`  bank   : res-${created.handle}-bank`);
  console.log(`  id     : ${created.id}\n`);
  await pool.end();
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
