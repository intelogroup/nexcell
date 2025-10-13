-- AlterTable
ALTER TABLE "users" ALTER COLUMN "credits" SET DEFAULT 100.0;

-- Update existing users' credits to 100 if they have less than 100
UPDATE "users" SET "credits" = 100.0 WHERE "credits" < 100.0;
