-- Supervisor registry: one row ties a supervisor name to its NIP so a signed
-- document can never pair the wrong two strings.
CREATE TABLE "ap_supervisors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nip" TEXT,
    "email" TEXT,
    "research_group" TEXT,
    "research_topic" TEXT,
    "academic_rank" TEXT,
    "profile_url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nip_missing" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ap_supervisors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ap_supervisors_nip_key" ON "ap_supervisors"("nip");
CREATE UNIQUE INDEX "ap_supervisors_email_key" ON "ap_supervisors"("email");
CREATE INDEX "ap_supervisors_name_idx" ON "ap_supervisors"("name");
