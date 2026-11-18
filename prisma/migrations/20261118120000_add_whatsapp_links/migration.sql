-- WhatsApp identity capture, phase 1.
--
-- One row per AP-Lab account (user_id unique) holding a pending link attempt.
-- The phone number is deliberately nullable: it is resolved by the host
-- provisioner from Hermes' pairing store after the member proves possession by
-- receiving the code on that phone. Until then the row records only which code
-- the signed-in member confirmed.
--
-- phone is unique so two accounts can never claim one number — PostgreSQL
-- treats NULLs as distinct, so rows still in PENDING do not collide.
--
-- request_id is the 8-character pairing code: single-use, 1 h TTL, never a
-- credential. It is stored so the provisioner approves exactly the attempt the
-- member confirmed, not whichever code happens to be pending.

CREATE TYPE "ap_whatsapp_link_status" AS ENUM ('PENDING', 'VERIFIED', 'FAILED', 'EXPIRED');

CREATE TABLE "ap_whatsapp_links" (
    "id"          TEXT NOT NULL,
    "user_id"     TEXT NOT NULL,
    "phone"       TEXT,
    "status"      "ap_whatsapp_link_status" NOT NULL DEFAULT 'PENDING',
    "request_id"  TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "last_error"  TEXT,

    CONSTRAINT "ap_whatsapp_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ap_whatsapp_links_user_id_key"    ON "ap_whatsapp_links"("user_id");
CREATE UNIQUE INDEX "ap_whatsapp_links_phone_key"      ON "ap_whatsapp_links"("phone");
CREATE UNIQUE INDEX "ap_whatsapp_links_request_id_key" ON "ap_whatsapp_links"("request_id");
CREATE INDEX        "ap_whatsapp_links_status_idx"     ON "ap_whatsapp_links"("status");

ALTER TABLE "ap_whatsapp_links"
    ADD CONSTRAINT "ap_whatsapp_links_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "ap_users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
