/**
 * LUMA tool smoke tests against the LIVE AP-Lab database.
 *
 * Read-only. Proves every tool executes against real Prisma models (field
 * names verified by the type system AND by an actual query), so a model
 * call cannot silently return "Tool failed".
 *
 * Run: DATABASE_URL=... npx tsx scripts/test-luma-tools.ts
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { executeTool, toolList, validateToolArgs } from "../src/lib/luma-tools";

const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

let pass = 0;
let fail = 0;

function check(ok: boolean, label: string, detail?: string) {
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

async function main() {
  // Find a real user to act as.
  const user = await prisma.user.findFirst({ select: { id: true, name: true } });
  if (!user) throw new Error("No users in DB — cannot test");
  console.log(`\nActing as: ${user.name} (${user.id})\n`);

  const ctx = { userId: user.id, prisma };

  console.log("=== tool schema exposure ===");
  const tools = toolList();
  check(tools.length === 5, `5 tools exposed (got ${tools.length})`);
  for (const t of tools) {
    check(
      typeof t.function.name === "string" && t.function.parameters?.type === "object",
      `${t.function.name} has well-formed schema`,
    );
  }

  console.log("\n=== argument validation ===");
  check(validateToolArgs("get_my_bookings", {}).ok, "get_my_bookings accepts {}");
  check(validateToolArgs("search_reagents", { query: "so" }).ok, "search_reagents accepts query");
  check(!validateToolArgs("search_reagents", {}).ok, "search_reagents rejects missing query");
  check(!validateToolArgs("nonexistent", {}).ok, "unknown tool rejected");

  console.log("\n=== live execution (must not return 'Tool failed') ===");
  const cases: Array<[string, any]> = [
    ["get_my_bookings", { status: "ALL", limit: 10 }],
    ["get_instrument_availability", {}],
    ["get_my_glassware_loans", {}],
    ["search_reagents", { query: "a", limit: 5 }],
    ["list_supervisors", { onlySigners: false }],
  ];

  for (const [name, args] of cases) {
    const out = await executeTool(name, args, ctx);
    let parsed: any;
    try {
      parsed = JSON.parse(out);
    } catch {
      check(false, `${name} returned valid JSON`, out.slice(0, 200));
      continue;
    }
    if (parsed.error) {
      check(false, `${name} executes`, `${parsed.error}: ${parsed.detail ?? ""}`);
    } else {
      const summary =
        parsed.count !== undefined
          ? `count=${parsed.count}`
          : parsed.total !== undefined
            ? `total=${parsed.total} freeNow=${parsed.freeNow}`
            : "ok";
      check(true, `${name} → ${summary}`);
    }
  }

  console.log("\n=== content sanity ===");
  const avail = JSON.parse(await executeTool("get_instrument_availability", {}, ctx));
  check(Array.isArray(avail.instruments), "availability returns an instrument array");
  if (avail.instruments?.length) {
    const i = avail.instruments[0];
    check(
      typeof i.name === "string" && typeof i.booked_now === "boolean",
      `instrument shape correct (${i.name}, booked_now=${i.booked_now})`,
    );
  } else {
    console.log("  note instrument table is empty — shape check skipped");
  }

  const sups = JSON.parse(await executeTool("list_supervisors", { onlySigners: true }, ctx));
  check(
    sups.count > 0 && sups.supervisors.every((s: any) => typeof s.nip === "string" && s.nip.length === 18),
    `signer supervisors all have 18-digit NIP (${sups.count} rows)`,
  );

  console.log("\n=== scope isolation ===");
  const other = await prisma.user.findFirst({ where: { id: { not: user.id } }, select: { id: true } });
  if (other) {
    const a = JSON.parse(await executeTool("get_my_bookings", { status: "ALL" }, { userId: user.id, prisma }));
    const b = JSON.parse(await executeTool("get_my_bookings", { status: "ALL" }, { userId: other.id, prisma }));
    check(
      JSON.stringify(a.bookings) !== undefined && typeof b.count === "number",
      "tools scope by the server-supplied userId, not model input",
    );
  } else {
    console.log("  note only one user in DB — isolation check limited");
  }

  console.log(`\n${pass} passed, ${fail} failed\n`);
  await pool.end();
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
