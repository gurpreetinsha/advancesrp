-- SRGC production hardening indexes.
-- Run after taking a verified database backup and checking for duplicate rows.
-- These partial indexes close PostgreSQL NULL-uniqueness and active-publication gaps
-- that cannot be represented by the current Prisma @@unique declarations.

-- Prevent duplicate "all sections" faculty assignments (NULL sectionId).
CREATE UNIQUE INDEX IF NOT EXISTS "FacultyAssignment_all_sections_unique"
ON "FacultyAssignment" ("facultyId", "subjectId", "academicYearId", "semesterId")
WHERE "sectionId" IS NULL;

-- Prevent more than one active publication for the same examination.
CREATE UNIQUE INDEX IF NOT EXISTS "ResultPublication_one_active_per_exam"
ON "ResultPublication" ("examId")
WHERE "isActive" = TRUE;

-- A publication version must be unique within an examination.
CREATE UNIQUE INDEX IF NOT EXISTS "ResultPublication_exam_version_unique"
ON "ResultPublication" ("examId", "version");
