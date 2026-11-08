/**
 * Handle allocator tests. Run: npx tsx scripts/test-handles.ts
 *
 * These exist because a silent bug here is expensive: a duplicate handle hands
 * one student's memory to another, and a bad slug writes a directory nobody
 * can type. Both fail quietly in production.
 */
import {
  allocateHandle,
  preferredHandle,
  validateHandle,
  slugifyHandle,
  profileDirFor,
} from "../src/lib/agents";

let pass = 0;
let fail = 0;

function eq(actual: unknown, expected: unknown, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}\n       expected ${JSON.stringify(expected)}\n       got      ${JSON.stringify(actual)}`);
  }
}

console.log("\nslugify");
eq(slugifyHandle("Gerald Arya"), "gerald-arya", "spaces to hyphen");
eq(slugifyHandle("  Gerald  "), "gerald", "trims");
eq(slugifyHandle("José Ramírez"), "jose-ramirez", "strips diacritics");
eq(slugifyHandle("O'Brien"), "o-brien", "apostrophe to separator");
eq(slugifyHandle("日本語"), "", "non-latin collapses to empty");
eq(slugifyHandle("A"), "a", "single char survives");
eq(slugifyHandle("---"), "", "separators only -> empty");
eq(slugifyHandle("x".repeat(50)).length <= 32, true, "truncates to 32");
eq(slugifyHandle("Gerald---Arya"), "gerald-arya", "collapses runs");

console.log("\npreferredHandle");
const UUID = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
eq(preferredHandle("Gerald Arya", UUID), "gerald-arya", "normal name");
eq(preferredHandle("日本語", UUID), "user-3f2504e0", "non-latin falls back to uuid");
eq(preferredHandle("A", UUID), "user-3f2504e0", "too-short slug falls back");
eq(preferredHandle("admin", UUID), "user-3f2504e0", "reserved word falls back");
eq(preferredHandle("Luma", UUID), "user-3f2504e0", "reserved is case-insensitive");

console.log("\nallocateHandle — collisions");
eq(allocateHandle("Gerald", UUID, []), "gerald", "free handle kept bare");
eq(allocateHandle("Gerald", UUID, ["gerald"]), "gerald-2", "first collision -> -2");
eq(allocateHandle("Gerald", UUID, ["gerald", "gerald-2"]), "gerald-3", "second collision -> -3");
eq(
  allocateHandle("Gerald", UUID, ["GERALD"]),
  "gerald-2",
  "collision check is case-insensitive",
);
eq(
  allocateHandle("Gerald", UUID, ["gerald", "gerald-3"]),
  "gerald-2",
  "fills the gap rather than skipping to -4",
);

console.log("\nallocateHandle — suspended handles still reserved");
eq(
  allocateHandle("Nirwan", UUID, ["nirwan"]),
  "nirwan-2",
  "a suspended agent keeps its handle",
);

console.log("\nvalidateHandle");
eq(validateHandle("gerald"), null, "valid simple");
eq(validateHandle("gerald-arya"), null, "valid with hyphen");
eq(validateHandle("gerald2"), null, "valid with digit");
eq(validateHandle(""), "Handle cannot be empty", "empty rejected");
eq(validateHandle("a"), "Handle must be at least 2 characters", "too short");
eq(validateHandle("Gerald"), "Use lowercase letters, digits and hyphens only; must start and end with a letter or digit", "uppercase rejected");
eq(validateHandle("-gerald"), "Use lowercase letters, digits and hyphens only; must start and end with a letter or digit", "leading hyphen rejected");
eq(validateHandle("gerald-"), "Use lowercase letters, digits and hyphens only; must start and end with a letter or digit", "trailing hyphen rejected");
eq(validateHandle("gerald_arya"), "Use lowercase letters, digits and hyphens only; must start and end with a letter or digit", "underscore rejected");
eq(validateHandle("gerald--arya"), "Handle cannot contain consecutive hyphens", "double hyphen rejected");
eq(validateHandle("admin"), '"admin" is reserved', "reserved rejected");
eq(validateHandle("x".repeat(33)), "Handle must be at most 32 characters", "too long rejected");

console.log("\nprofileDirFor");
eq(profileDirFor("gerald"), "res-gerald", "res- prefix");
eq(profileDirFor("gerald-arya"), "res-gerald-arya", "res- prefix with hyphen");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
