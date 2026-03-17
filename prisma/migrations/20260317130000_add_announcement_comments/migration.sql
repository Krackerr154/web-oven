-- CreateTable
CREATE TABLE "ap_announcement_comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "announcement_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ap_announcement_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ap_announcement_comments_announcement_id_idx" ON "ap_announcement_comments"("announcement_id");

-- CreateIndex
CREATE INDEX "ap_announcement_comments_author_id_idx" ON "ap_announcement_comments"("author_id");

-- AddForeignKey
ALTER TABLE "ap_announcement_comments" ADD CONSTRAINT "ap_announcement_comments_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "ap_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ap_announcement_comments" ADD CONSTRAINT "ap_announcement_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "ap_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
