-- Add eligible class shifts for each subject
ALTER TABLE "Subject"
ADD COLUMN "eligibleTurmas" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Subject"
SET "eligibleTurmas" = ARRAY[]::TEXT[]
WHERE "eligibleTurmas" IS NULL;

ALTER TABLE "Subject"
ALTER COLUMN "eligibleTurmas" SET NOT NULL;
