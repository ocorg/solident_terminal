-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('consommable', 'instrument', 'equipement');

-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('entree', 'consommation', 'perte', 'transfert', 'ajustement');

-- CreateEnum
CREATE TYPE "InventorySource" AS ENUM ('don', 'achat', 'emprunt');

-- CreateEnum
CREATE TYPE "InventoryCountStatus" AS ENUM ('brouillon', 'valide');

-- CreateEnum
CREATE TYPE "InventoryLineOutcome" AS ENUM ('ok', 'consommation', 'perte', 'ajustement');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "subcategory" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pièces',
    "min_qty" DECIMAL(10,2),
    "photo_url" TEXT,
    "notes" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty" DECIMAL(10,2) NOT NULL,
    "from_holder_id" UUID,
    "to_holder_id" UUID,
    "type" "InventoryMovementType" NOT NULL,
    "source" "InventorySource",
    "is_estimate" BOOLEAN NOT NULL DEFAULT false,
    "project_id" UUID,
    "count_id" UUID,
    "reverses_id" UUID,
    "note" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_counts" (
    "id" UUID NOT NULL,
    "project_id" UUID,
    "status" "InventoryCountStatus" NOT NULL DEFAULT 'brouillon',
    "notes" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "inventory_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_count_lines" (
    "id" UUID NOT NULL,
    "count_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "holder_id" UUID NOT NULL,
    "snapshot_qty" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expected_qty" DECIMAL(10,2),
    "counted_qty" DECIMAL(10,2),
    "outcome" "InventoryLineOutcome",
    "note" TEXT,

    CONSTRAINT "inventory_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_needs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_needed" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "inventory_needs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_items_category_is_deleted_idx" ON "inventory_items"("category", "is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_reverses_id_key" ON "inventory_movements"("reverses_id");

-- CreateIndex
CREATE INDEX "inventory_movements_item_id_idx" ON "inventory_movements"("item_id");

-- CreateIndex
CREATE INDEX "inventory_movements_from_holder_id_idx" ON "inventory_movements"("from_holder_id");

-- CreateIndex
CREATE INDEX "inventory_movements_to_holder_id_idx" ON "inventory_movements"("to_holder_id");

-- CreateIndex
CREATE INDEX "inventory_movements_project_id_idx" ON "inventory_movements"("project_id");

-- CreateIndex
CREATE INDEX "inventory_movements_count_id_idx" ON "inventory_movements"("count_id");

-- CreateIndex
CREATE INDEX "inventory_movements_created_at_idx" ON "inventory_movements"("created_at");

-- CreateIndex
CREATE INDEX "inventory_counts_project_id_status_idx" ON "inventory_counts"("project_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_count_lines_count_id_item_id_holder_id_key" ON "inventory_count_lines"("count_id", "item_id", "holder_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_needs_project_id_item_id_key" ON "inventory_needs"("project_id", "item_id");

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_from_holder_id_fkey" FOREIGN KEY ("from_holder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_to_holder_id_fkey" FOREIGN KEY ("to_holder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reverses_id_fkey" FOREIGN KEY ("reverses_id") REFERENCES "inventory_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_counts" ADD CONSTRAINT "inventory_counts_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_count_id_fkey" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_holder_id_fkey" FOREIGN KEY ("holder_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_needs" ADD CONSTRAINT "inventory_needs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_needs" ADD CONSTRAINT "inventory_needs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Ledger rules enforced by the database too (Prisma does not manage CHECK constraints).
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_qty_positive" CHECK ("qty" > 0);
-- An undo row ("reverses_id" set) keeps the original type with holders swapped, so only the basics apply to it.
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_shape" CHECK (
  ("reverses_id" IS NOT NULL AND ("from_holder_id" IS NOT NULL OR "to_holder_id" IS NOT NULL) AND "from_holder_id" IS DISTINCT FROM "to_holder_id") OR
  ("type" = 'entree'       AND "from_holder_id" IS NULL     AND "to_holder_id" IS NOT NULL AND "source" IS NOT NULL) OR
  ("type" = 'ajustement'   AND "from_holder_id" IS NULL     AND "to_holder_id" IS NOT NULL AND "source" IS NULL) OR
  ("type" IN ('consommation', 'perte') AND "from_holder_id" IS NOT NULL AND "to_holder_id" IS NULL AND "source" IS NULL) OR
  ("type" = 'transfert'    AND "from_holder_id" IS NOT NULL AND "to_holder_id" IS NOT NULL AND "from_holder_id" <> "to_holder_id" AND "source" IS NULL)
);
ALTER TABLE "inventory_needs" ADD CONSTRAINT "inventory_needs_qty_positive" CHECK ("qty_needed" > 0);
ALTER TABLE "inventory_count_lines" ADD CONSTRAINT "inventory_count_lines_counted_not_negative" CHECK ("counted_qty" IS NULL OR "counted_qty" >= 0);
