import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAndValidateMarksCSV } from "@/lib/export/helpers";

export const runtime = "nodejs";
const importSchema = z.object({
  examSubjectId: z.string().min(1),
  csvContent: z.string().min(1).max(2_000_000),
  commit: z.boolean().optional(),
  ignoreErrors: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "FACULTY"].includes(session.role)) return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });

    const raw = await req.json();
    const parsed = importSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Invalid import request", details: parsed.error.flatten() }, { status: 400 });
    const { examSubjectId, csvContent, commit, ignoreErrors } = parsed.data;

    const examSubject = await prisma.examSubject.findUnique({
      where: { id: examSubjectId }, include: { examination: true, subject: true },
    });
    if (!examSubject) return NextResponse.json({ error: "Exam subject not found" }, { status: 404 });
    if (["PUBLISHED", "ARCHIVED"].includes(examSubject.examination.status)) {
      return NextResponse.json({ error: "Published/archived results cannot be changed through CSV import. Use the correction workflow." }, { status: 409 });
    }

    let sectionScope: string[] | null = null;
    if (session.role === "FACULTY") {
      if (!session.facultyId) return NextResponse.json({ error: "Faculty profile is unavailable" }, { status: 403 });
      const assignments = await prisma.facultyAssignment.findMany({
        where: {
          facultyId: session.facultyId, subjectId: examSubject.subjectId,
          academicYearId: examSubject.examination.academicYearId,
          semesterId: examSubject.examination.semesterId, canEnterMarks: true,
        },
        select: { sectionId: true },
      });
      if (!assignments.length) return NextResponse.json({ error: "You are not assigned to this subject and academic year." }, { status: 403 });
      if (!assignments.some((a) => a.sectionId === null)) {
        sectionScope = assignments.map((a) => a.sectionId).filter((id): id is string => Boolean(id));
        if (!sectionScope.length) return NextResponse.json({ error: "No eligible section assignment found." }, { status: 403 });
      }
    }

    const enrollments = await prisma.studentExamEnrollment.findMany({
      where: {
        examId: examSubject.examId, isEligible: true,
        ...(sectionScope ? { sectionId: { in: sectionScope } } : {}),
      },
      include: { student: { select: { id: true, rollNo: true } } },
    });
    const studentByRoll = new Map(enrollments.map((e) => [e.student.rollNo, e.student]));
    const validation = parseAndValidateMarksCSV(csvContent, examSubject.maxMarks, new Set(studentByRoll.keys()));

    if (!commit) return NextResponse.json({
      success: true, preview: true,
      totalRowsParsed: validation.validRows.length + validation.errors.length,
      validCount: validation.validRows.length, errorCount: validation.errors.length,
      errors: validation.errors, sampleValid: validation.validRows.slice(0, 5),
    });
    if (validation.errors.length && !ignoreErrors) return NextResponse.json({
      error: "Validation failed. No records were imported.", details: validation.errors,
      validCount: validation.validRows.length, errorCount: validation.errors.length,
    }, { status: 400 });
    if (ignoreErrors && session.role !== "ADMIN") return NextResponse.json({ error: "Only administrators may authorize partial imports." }, { status: 403 });
    if (!validation.validRows.length) return NextResponse.json({ error: "No valid rows to import." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      for (const row of validation.validRows) {
        const student = studentByRoll.get(row.rollNo);
        if (!student) throw new Error("Validated student disappeared from the cohort");
        await tx.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: student.id } },
          update: {
            marksObtained: row.isAbsent ? null : row.marksObtained,
            isAbsent: row.isAbsent, isWithheld: false, remarks: row.remarks || null, status: "DRAFT",
          },
          create: {
            examSubjectId, studentId: student.id,
            marksObtained: row.isAbsent ? null : row.marksObtained,
            isAbsent: row.isAbsent, isWithheld: false, remarks: row.remarks || null,
            status: "DRAFT", enteredById: session.id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: session.id, action: "MARKS_CSV_IMPORTED", entityType: "ExamSubject", entityId: examSubjectId,
          details: JSON.stringify({
            examName: examSubject.examination.name, subjectCode: examSubject.subject.code,
            importedCount: validation.validRows.length, skippedCount: validation.errors.length,
            partialImportAuthorized: Boolean(ignoreErrors),
          }),
        },
      });
    });

    return NextResponse.json({
      success: true, message: `Successfully imported ${validation.validRows.length} marks records.`,
      importedCount: validation.validRows.length, skippedCount: validation.errors.length,
    });
  } catch (error) {
    console.error("Marks import error:", error);
    return NextResponse.json({ error: "Failed to process marks import" }, { status: 500 });
  }
}
