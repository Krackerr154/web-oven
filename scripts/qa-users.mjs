/**
 * Create (or refresh) the two QA accounts used for authenticated testing.
 *
 * Passwords are generated here, written only to 0600 files under ~/.secrets,
 * and never printed. Emails are stable so re-running rotates the password
 * instead of piling up accounts.
 *
 *   node scripts/qa-users.mjs
 *   docker exec -i ap_lab_db psql -U ap_user -d ap_lab_db < /tmp/qa-users.sql
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";

const SECRETS = path.join(process.env.HOME ?? "/home/arya", ".secrets");
fs.mkdirSync(SECRETS, { recursive: true });

const USERS = [
    { key: "member", name: "QA Member", email: "qa.member@ap-lab.internal", phone: "6200000000001", roles: "USER" },
    { key: "admin", name: "QA Admin", email: "qa.admin@ap-lab.internal", phone: "6200000000002", roles: "ADMIN" },
];

const lines = ["BEGIN;"];
const created = [];

for (const u of USERS) {
    const password = crypto.randomBytes(24).toString("base64url");
    const hash = bcrypt.hashSync(password, 10);
    const id = crypto.randomUUID();

    fs.writeFileSync(
        path.join(SECRETS, `ap-lab-qa-${u.key}.json`),
        JSON.stringify({ email: u.email, password, role: u.roles }, null, 1) + "\n",
        { mode: 0o600 },
    );

    lines.push(`
INSERT INTO ap_users (id, name, email, phone, nickname, nim, supervisors, "hasSeenTour",
                     password_hash, roles, status, is_contact_person, email_verified, created_at, updated_at)
VALUES ('${id}', '${u.name}', '${u.email}', '${u.phone}', NULL, NULL, ARRAY[]::text[], true,
        '${hash}', ARRAY['${u.roles}']::ap_role[], 'APPROVED', false, NOW(), NOW(), NOW())
ON CONFLICT (email) DO UPDATE
    SET password_hash = EXCLUDED.password_hash,
        roles         = EXCLUDED.roles,
        status        = 'APPROVED',
        "hasSeenTour" = true,
        email_verified = NOW(),
        updated_at    = NOW();
`);
    created.push({ key: u.key, email: u.email, role: u.roles, hashPrefix: hash.slice(0, 7) + "…" });
}

lines.push("COMMIT;");
fs.writeFileSync("/tmp/qa-users.sql", lines.join("\n"), { mode: 0o600 });

console.log(JSON.stringify({ accounts: created, credentialsAt: SECRETS + "/ap-lab-qa-*.json" }, null, 1));
