const { Client } = require('pg');

async function migrate() {
    const client = new Client({
        connectionString: "postgresql://oven_user:x154@localhost:5432/ap_lab_db"
    });

    try {
        await client.connect();

        console.log("Adding new roles array column...");
        await client.query(`ALTER TABLE "ap_users" ADD COLUMN IF NOT EXISTS "roles" "ap_role"[] DEFAULT ARRAY['USER']::"ap_role"[];`);

        console.log("Migrating existing data from role to roles array...");
        // Check if "role" column still exists before trying to copy
        const res = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='ap_users' AND column_name='role';
    `);

        if (res.rows.length > 0) {
            await client.query(`UPDATE "ap_users" SET "roles" = ARRAY["role"]::"ap_role"[];`);
            console.log("Dropping old role column...");
            await client.query(`ALTER TABLE "ap_users" DROP COLUMN "role";`);
        } else {
            console.log("Old role column already dropped, skipping data migration.");
        }

        console.log("Migration successful!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await client.end();
    }
}

migrate();
