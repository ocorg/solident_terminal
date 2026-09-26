-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "partner_id" UUID;

-- CreateIndex
CREATE INDEX "donations_partner_id_idx" ON "donations"("partner_id");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

