-- CreateEnum
CREATE TYPE "ContextType" AS ENUM ('project', 'cellule');

-- CreateEnum
CREATE TYPE "TeamContext" AS ENUM ('global', 'project', 'cellule');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('actif', 'en_pause', 'bloque', 'termine');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('en_attente', 'approuve', 'rejete');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('a_faire', 'en_cours', 'bloque', 'termine');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('urgent', 'eleve', 'moyen', 'faible');

-- CreateEnum
CREATE TYPE "TeamEventType" AS ENUM ('activite', 'action', 'reunion', 'evenement');

-- CreateEnum
CREATE TYPE "TeamEventVisibility" AS ENUM ('tous', 'invites');

-- CreateEnum
CREATE TYPE "Rsvp" AS ENUM ('oui', 'non', 'en_attente');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email_notifications" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "cellules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cellules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cellule_positions" (
    "id" UUID NOT NULL,
    "cellule_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "cellule_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cellule_members" (
    "id" UUID NOT NULL,
    "cellule_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,

    CONSTRAINT "cellule_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'actif',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'approuve',
    "is_multi_activite" BOOLEAN NOT NULL DEFAULT false,
    "parent_project_id" UUID,
    "proposed_by" UUID,
    "start_date" DATE,
    "end_date" DATE,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_positions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "project_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_members" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "position_id" UUID NOT NULL,

    CONSTRAINT "project_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_proposals" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'Projet',
    "is_activity" BOOLEAN NOT NULL DEFAULT false,
    "parent_project_id" UUID,
    "proposed_by" UUID NOT NULL,
    "suggested_chef" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'en_attente',
    "review_notes" TEXT,
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "context_type" "ContextType" NOT NULL,
    "context_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'a_faire',
    "priority" "TaskPriority" NOT NULL DEFAULT 'moyen',
    "due_date" TIMESTAMPTZ(3),
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID NOT NULL,
    "last_updated_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_assignees" (
    "task_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,

    CONSTRAINT "task_assignees_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateTable
CREATE TABLE "task_contexts" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "context_type" "ContextType" NOT NULL,
    "context_id" UUID NOT NULL,

    CONSTRAINT "task_contexts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_events" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "TeamEventType" NOT NULL DEFAULT 'reunion',
    "context_type" "TeamContext" NOT NULL DEFAULT 'global',
    "context_id" UUID,
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3),
    "location" TEXT,
    "visibility" "TeamEventVisibility" NOT NULL DEFAULT 'tous',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "team_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_event_attendees" (
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rsvp" "Rsvp" NOT NULL DEFAULT 'en_attente',

    CONSTRAINT "team_event_attendees_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "team_event_invites" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "context_type" "ContextType" NOT NULL,
    "context_id" UUID NOT NULL,

    CONSTRAINT "team_event_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "target_id" UUID,
    "message" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_queue" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "send_after" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_queue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cellule_positions_cellule_id_idx" ON "cellule_positions"("cellule_id");

-- CreateIndex
CREATE INDEX "cellule_members_user_id_idx" ON "cellule_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cellule_members_cellule_id_user_id_key" ON "cellule_members"("cellule_id", "user_id");

-- CreateIndex
CREATE INDEX "projects_parent_project_id_idx" ON "projects"("parent_project_id");

-- CreateIndex
CREATE INDEX "project_positions_project_id_idx" ON "project_positions"("project_id");

-- CreateIndex
CREATE INDEX "project_members_user_id_idx" ON "project_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_members_project_id_user_id_key" ON "project_members"("project_id", "user_id");

-- CreateIndex
CREATE INDEX "project_proposals_status_created_at_idx" ON "project_proposals"("status", "created_at");

-- CreateIndex
CREATE INDEX "tasks_context_type_context_id_idx" ON "tasks"("context_type", "context_id");

-- CreateIndex
CREATE INDEX "tasks_status_archived_idx" ON "tasks"("status", "archived");

-- CreateIndex
CREATE INDEX "task_assignees_user_id_idx" ON "task_assignees"("user_id");

-- CreateIndex
CREATE INDEX "task_contexts_context_type_context_id_idx" ON "task_contexts"("context_type", "context_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_contexts_task_id_context_type_context_id_key" ON "task_contexts"("task_id", "context_type", "context_id");

-- CreateIndex
CREATE INDEX "task_comments_task_id_created_at_idx" ON "task_comments"("task_id", "created_at");

-- CreateIndex
CREATE INDEX "team_events_start_at_idx" ON "team_events"("start_at");

-- CreateIndex
CREATE INDEX "team_event_attendees_user_id_idx" ON "team_event_attendees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_event_invites_event_id_context_type_context_id_key" ON "team_event_invites"("event_id", "context_type", "context_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_read_at_created_at_idx" ON "notifications"("recipient_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "email_queue_send_after_idx" ON "email_queue"("send_after");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AddForeignKey
ALTER TABLE "cellule_positions" ADD CONSTRAINT "cellule_positions_cellule_id_fkey" FOREIGN KEY ("cellule_id") REFERENCES "cellules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cellule_members" ADD CONSTRAINT "cellule_members_cellule_id_fkey" FOREIGN KEY ("cellule_id") REFERENCES "cellules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cellule_members" ADD CONSTRAINT "cellule_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cellule_members" ADD CONSTRAINT "cellule_members_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "cellule_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_positions" ADD CONSTRAINT "project_positions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "project_positions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposals" ADD CONSTRAINT "project_proposals_parent_project_id_fkey" FOREIGN KEY ("parent_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposals" ADD CONSTRAINT "project_proposals_proposed_by_fkey" FOREIGN KEY ("proposed_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposals" ADD CONSTRAINT "project_proposals_suggested_chef_fkey" FOREIGN KEY ("suggested_chef") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_proposals" ADD CONSTRAINT "project_proposals_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_last_updated_by_fkey" FOREIGN KEY ("last_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_assignees" ADD CONSTRAINT "task_assignees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_contexts" ADD CONSTRAINT "task_contexts_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_events" ADD CONSTRAINT "team_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_event_attendees" ADD CONSTRAINT "team_event_attendees_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "team_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_event_attendees" ADD CONSTRAINT "team_event_attendees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_event_invites" ADD CONSTRAINT "team_event_invites_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "team_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_queue" ADD CONSTRAINT "email_queue_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

