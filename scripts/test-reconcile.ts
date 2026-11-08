/**
 * Reconciler dry-run check. Run: npx tsx scripts/test-reconcile.ts
 *
 * Verifies the plan logic against the real machine: the actual profiles
 * directory and the actual pairing store. Read-only.
 */
import { planForUser, probeEnvironment, readPairingStore, listExistingProfiles } from "../src/lib/agents-reconcile";

let fail = 0;
function check(cond: boolean, label: string, detail?: string) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
  }
}

async function main() {
  const env = await probeEnvironment();
  const profiles = await listExistingProfiles();
  const pairing = await readPairingStore();

  console.log("\n=== ENVIRONMENT (real, read-only) ===");
  console.log(`hermes home      : ${env.hermesHome}`);
  console.log(`profiles dir     : ${env.profilesDirReadable ? "readable" : "NOT readable"}`);
  console.log(`profile count    : ${env.profileCount}  [${profiles.join(", ")}]`);
  console.log(`pairing store    : ${env.pairingStoreReadable ? "readable" : "absent"}`);
  console.log(`pairing entries  : ${env.pairingEntryCount}  ${JSON.stringify(pairing)}`);
  console.log(`canWrite         : ${env.canWrite}  (phase 1 is dry-run only)`);

  check(env.canWrite === false, "phase 1 reports canWrite=false");
  check(env.profilesDirReadable, "profiles directory is readable");
  check(profiles.includes("res-gerald"), "res-gerald exists on disk (known state)");

  console.log("\n=== GRANTED, profile missing, phone present ===");
  const g = await planForUser({
    handle: "nirwan",
    name: "Nirwan",
    phone: "6281234567890",
    status: "GRANTED",
  });
  console.log(JSON.stringify(g.actions, null, 2));
  check(g.blockers.length === 0, "no blockers when phone exists");
  check(g.actions[0].verb === "create", "creates profile FIRST (ordering matters)");
  check(
    g.actions.some((a) => a.verb === "write" && a.target.includes("pairing")),
    "writes pairing entry",
  );
  check(
    g.actions.findIndex((a) => a.verb === "create") <
      g.actions.findIndex((a) => a.verb === "write"),
    "profile create precedes pairing write — prevents routing to default",
  );
  check(!g.inSync, "reports not-in-sync");

  console.log("\n=== GRANTED, already provisioned (res-gerald) ===");
  const g2 = await planForUser({
    handle: "gerald",
    name: "Gerald",
    phone: "6282247077893",
    status: "GRANTED",
  });
  console.log(JSON.stringify(g2.actions, null, 2));
  check(
    g2.actions.some((a) => a.verb === "skip" && a.target.includes("res-gerald")),
    "skips existing profile",
  );

  console.log("\n=== GRANTED but no phone ===");
  const g3 = await planForUser({
    handle: "someone",
    name: "Someone",
    phone: null,
    status: "GRANTED",
  });
  console.log(JSON.stringify(g3.blockers, null, 2));
  check(g3.blockers.length === 1, "blocks without a phone number");
  check(g3.blockers[0].includes("phone"), "blocker names the missing phone");

  console.log("\n=== SUSPENDED ===");
  const s = await planForUser({
    handle: "gerald",
    name: "Gerald",
    phone: "6282247077893",
    status: "SUSPENDED",
  });
  console.log(JSON.stringify(s.actions, null, 2));
  check(
    s.actions.some((a) => a.verb === "skip" && a.target.includes("res-gerald")),
    "suspended keeps profile on disk (archive, not delete)",
  );
  check(
    !s.actions.some((a) => a.verb === "create"),
    "suspended never proposes creating anything",
  );

  console.log("\n=== PENDING ===");
  const p = await planForUser({
    handle: "",
    name: "Nobody",
    phone: "6280000000000",
    status: "PENDING",
  });
  console.log(JSON.stringify(p.actions, null, 2));
  check(p.inSync, "PENDING is already in sync — nothing to do");
  check(
    p.actions.every((a) => a.verb === "skip"),
    "PENDING proposes no writes",
  );

  console.log(fail === 0 ? "\nALL CHECKS PASSED\n" : `\n${fail} CHECK(S) FAILED\n`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
