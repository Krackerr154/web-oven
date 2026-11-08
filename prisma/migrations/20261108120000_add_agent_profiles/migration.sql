-- Agent access infrastructure, phase 1.
--
-- Creates the desired-state table only. Nothing here touches the filesystem,
-- and no WhatsApp identifier is stored: the reconciler derives transport
-- details from the user's phone at apply time.

CREATE TYPE "ap_agent_status" AS ENUM ('PENDING', 'GRANTED', 'SUSPENDED');

CREATE TABLE "ap_agent_profiles" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "handle"          TEXT NOT NULL,
    "status"          "ap_agent_status" NOT NULL DEFAULT 'PENDING',
    "granted_at"      TIMESTAMP(3),
    "granted_by_id"   TEXT,
    "revoked_at"      TIMESTAMP(3),
    "revoked_by_id"   TEXT,
    "revoked_reason"  TEXT,
    "provisioned_at"  TIMESTAMP(3),
    "last_error"      TEXT,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ap_agent_profiles_pkey" PRIMARY KEY ("id")
);

-- One agent per person, forever. The unique constraint is the enforcement.
CREATE UNIQUE INDEX "ap_agent_profiles_user_id_key" ON "ap_agent_profiles"("user_id");
CREATE UNIQUE INDEX "ap_agent_profiles_handle_key" ON "ap_agent_profiles"("handle");
CREATE INDEX "ap_agent_profiles_status_idx" ON "ap_agent_profiles"("status");
CREATE INDEX "ap_agent_profiles_granted_by_id_idx" ON "ap_agent_profiles"("granted_by_id");
CREATE INDEX "ap_agent_profiles_revoked_by_id_idx" ON "ap_agent_profiles"("revoked_by_id");

ALTER TABLE "ap_agent_profiles"
    ADD CONSTRAINT "ap_agent_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "ap_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ap_agent_profiles"
    ADD CONSTRAINT "ap_agent_profiles_granted_by_id_fkey"
    FOREIGN KEY ("granted_by_id") REFERENCES "ap_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ap_agent_profiles"
    ADD CONSTRAINT "ap_agent_profiles_revoked_by_id_fkey"
    FOREIGN KEY ("revoked_by_id") REFERENCES "ap_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
