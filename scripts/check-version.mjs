/**
 * Guards the one invariant that makes the changelog trustworthy.
 *
 * The version shown in the sidebar comes from src/lib/changelog.ts, while the
 * version in package.json is what anyone inspecting the build will read. If
 * these drift, the app lies to one of those two readers — and drift is the
 * default outcome of "remember to bump both".
 *
 * Run with: node scripts/check-version.mjs
 * Exits non-zero on mismatch so it can gate a deploy.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const changelogSrc = readFileSync(join(root, "src/lib/changelog.ts"), "utf8");

const m = changelogSrc.match(/export const CURRENT_VERSION\s*=\s*"([^"]+)"/);
if (!m) {
    console.error("check-version: CURRENT_VERSION not found in src/lib/changelog.ts");
    process.exit(1);
}
const current = m[1];

// The newest release entry must be the version the app reports, otherwise the
// sidebar claims a release that does not exist at the top of its own history.
const firstRelease = changelogSrc.match(/version:\s*"([^"]+)"/);
if (!firstRelease) {
    console.error("check-version: no release entries found in src/lib/changelog.ts");
    process.exit(1);
}

const problems = [];
if (pkg.version !== current) {
    problems.push(`package.json ${pkg.version} != CURRENT_VERSION ${current}`);
}
if (firstRelease[1] !== current) {
    problems.push(
        `newest release is ${firstRelease[1]} but CURRENT_VERSION is ${current} — add the release entry or fix the constant`,
    );
}

if (problems.length) {
    console.error("check-version FAILED:");
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
}

console.log(`check-version ok: v${current} (package.json, CURRENT_VERSION, newest release all agree)`);
