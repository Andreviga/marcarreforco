-- Add eligible school years for each subject
ALTER TABLE "Subject"
ADD COLUMN "eligibleSeries" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "Subject"
SET "eligibleSeries" = ARRAY[]::TEXT[]
WHERE "eligibleSeries" IS NULL;

ALTER TABLE "Subject"
ALTER COLUMN "eligibleSeries" SET NOT NULL;
