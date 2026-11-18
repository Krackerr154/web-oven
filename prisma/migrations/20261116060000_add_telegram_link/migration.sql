-- Telegram identity capture, phase 1.
--
-- Stores the Telegram account id returned by the Login Widget on /profile.
-- The id is account-global in Telegram (the same value for every bot), so a
-- single link survives any future change of bot. It is NOT a bot-scoped
-- handle and must never be treated as a secret — it is an identifier, not a
-- credential.
--
-- The unique index is the enforcement of "one Telegram per AP-Lab account".
-- PostgreSQL treats NULLs as distinct, so unlinked users do not collide.

ALTER TABLE "ap_users"
    ADD COLUMN "telegram_user_id"   BIGINT,
    ADD COLUMN "telegram_username"  TEXT,
    ADD COLUMN "telegram_linked_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "ap_users_telegram_user_id_key"
    ON "ap_users"("telegram_user_id");
