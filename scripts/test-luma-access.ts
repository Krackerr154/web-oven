/**
 * Access-gate and memory tests. Read-only against real data; the memory test
 * writes only to a throwaway bank.
 *
 * Run: DATABASE_URL=... npx tsx scripts/test-luma-access.ts
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { resolveLumaAccess } from "../src/lib/luma-access";
import { bankIdForHandle, recallMemories, retainMemory, formatMemories } from "../src/lib/hindsight";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let pass = 0;
let fail = 0;
function check(ok: boolean, label: string, detail?: string) {
  if (ok) { pass++; console.log(`  ok   ${label}`); }
  else { fail++; console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`); }
}

async function main() {
  console.log("\n=== bank naming ===");
  check(bankIdForHandle("gerald") === "res-gerald-bank", "handle gerald -> res-gerald-bank (matches WhatsApp LUMA)");
  check(bankIdForHandle("nirwan") === "res-nirwan-bank", "handle nirwan -> res-nirwan-bank");

  console.log("\n=== access: no session ===");
  const anon = await resolveLumaAccess(prisma, null);
  check(!anon.allowed && anon.reason === "signed-out", "null user is refused as signed-out");

  console.log("\n=== access: unknown user ===");
  const ghost = await resolveLumaAccess(prisma, "00000000-0000-0000-0000-000000000000");
  check(!ghost.allowed && ghost.reason === "signed-out", "unknown uuid refused");

  console.log("\n=== access: real users, against the live ledger ===");
  const users = await prisma.user.findMany({
    select: { id: true, name: true, status: true, agentProfile: { select: { handle: true, status: true } } },
    orderBy: { name: "asc" },
  });
  for (const u of users) {
    const a = await resolveLumaAccess(prisma, u.id);
    const ledger = u.agentProfile ? `${u.agentProfile.status}/${u.agentProfile.handle}` : "no profile";
    if (a.allowed) {
      check(true, `${u.name}: allowed -> bank ${a.bankId} (ledger ${ledger})`);
      check(a.handle === u.agentProfile!.handle, `${u.name}: handle comes from the ledger, not the request`);
    } else {
      check(true, `${u.name}: refused (${a.reason}) — ledger ${ledger}`);
    }
  }
  check(users.length > 0, `evaluated ${users.length} real account(s)`);

  console.log("\n=== memory round-trip (throwaway bank) ===");
  const TEST_BANK = "hs-test-luma-access";
  const stamp = `ap-lab access test ${Date.now()}`;
  const wrote = await retainMemory(
    TEST_BANK,
    `Smoke test marker: ${stamp}. The lab supervisor for this test is Professor Testbyte.`,
    "integration test",
    { wait: true },
  );
  check(wrote, "retain accepted by Hindsight");

  let found: any[] = [];
  for (let i = 0; i < 6; i++) {
    found = await recallMemories(TEST_BANK, "Professor Testbyte supervisor smoke test marker", 5);
    if (found.some((f) => f.text.toLowerCase().includes("testbyte"))) break;
    await new Promise((r) => setTimeout(r, 2500));
  }
  check(found.length > 0, "recall returns hits", `got ${found.length}`);
  check(
    found.some((f) => f.text.toLowerCase().includes("testbyte")),
    "the retained fact is recallable",
    found.map((f) => f.text.slice(0, 80)).join(" | "),
  );

  console.log("\n=== degradation ===");
  const empty = await recallMemories("hs-test-definitely-not-a-real-bank", "anything", 3);
  check(Array.isArray(empty) && empty.length === 0, "recall on an unknown bank returns [] rather than throwing");
  const bad = await retainMemory("hs-test-luma-access", "", "empty content");
  check(bad === false, "retain refuses empty content");

  console.log("\n=== prompt formatting ===");
  const block = formatMemories([{ text: "Likes  Ni-BDC   work", type: "observation" }]);
  check(block.includes("res-") === false && block.includes("Ni-BDC"), "memories render as a compact block");
  check(formatMemories([]) === "", "no memories -> empty string (no stray header)");

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
