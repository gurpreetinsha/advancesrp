import { NextResponse } from "next/server";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseAndValidateMarksCSV } from "@/lib/export/helpers";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "FACULTY")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const body = await req.json();
    const { examSubjectId, csvContent, commit } = body;

    if (!examSubjectId || !csvContent) {
      return NextResponse.json(
        { error: "examSubjectId and csvContent are required" },
        { status: 400 }
      );
    }

    const examSubject = await prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: {
        examination: true,
        subject: true,
      },
    });

    if (!examSubject) {
      return NextResponse.json({ error: "Exam subject not found" }, { status: 404 });
    }

    // Role check for faculty
    if (session.role === "FACULTY" && session.facultyId) {
      const assignment = await prisma.facultyAssignment.findFirst({
        where: {
          facultyId: session.facultyId,
          subjectId: examSubject.subjectId,
          semesterId: examSubject.examination.semesterId,
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: "Forbidden: You are not assigned to this subject." },
          { status: 403 }
        );
      }
    }

    // Fetch enrolled students for this examination
    const enrollments = await prisma.studentExamEnrollment.findMany({
      where: {
        examId: examSubject.examId,
        isEligible: true,
      },
      include: {
        student: true,
      },
    });

    const studentByRoll = new Map(enrollments.map((e) => [e.student.rollNo, e.student]));
    const validRollNumbers = new Set(enrollments.map((e) => e.student.rollNo));

    // Parse and validate CSV
    const validationResult = parseAndValidateMarksCSV(
      csvContent,
      examSubject.maxMarks,
      validRollNumbers
    );

    // If commit is false, return the validation report preview
    if (!commit) {
      return NextResponse.json({
        success: true,
        preview: true,
        totalRowsParsed: validationResult.validRows.length + validationResult.errors.length,
        validCount: validationResult.validRows.length,
        errorCount: validationResult.errors.length,
        errors: validationResult.errors,
        sampleValid: validationResult.validRows.slice(0, 5),
      });
    }

    // If commit is true but there are errors, stop or allow importing only valid if requested
    if (validationResult.errors.length > 0 && !body.ignoreErrors) {
      return NextResponse.json(
        {
          error: "Validation failed for some records in import file.",
          details: validationResult.errors,
          validCount: validationResult.validRows.length,
          errorCount: validationResult.errors.length,
        },
        { status: 400 }
      );
    }

    // Commit valid rows in transaction
    await prisma.$transaction(async (tx) => {
      for (const row of validationResult.validRows) {
        const student = studentByRoll.get(row.rollNo);
        if (!student) continue;

        await tx.mark.upsert({
          where: {
            examSubjectId_studentId: {
              examSubjectId,
              studentId: student.id,
            },
          },
          update: {
            marksObtained: row.marksObtained,
            isAbsent: row.isAbsent,
            remarks: row.remarks || null,
            status: "DRAFT",
          },
          create: {
            examSubjectId,
            studentId: student.id,
            marksObtained: row.marksObtained,
            isAbsent: row.isAbsent,
            remarks: row.remarks || null,
            status: "DRAFT",
            enteredById: session.id,
          },
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "MARKS_CSV_IMPORTED",
      entityType: "ExamSubject",
      entityId: examSubjectId,
      details: {
        examName: examSubject.examination.name,
        subjectCode: examSubject.subject.code,
        importedCount: validationResult.validRows.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${validationResult.validRows.length} student marks records.`,
      importedCount: validationResult.validRows.length,
      skippedCount: validationResult.errors.length,
    });
  } catch (error) {
    console.error("Marks import error:", error);
    return NextResponse.json({ error: "Failed to process marks import" }, { status: 500 });
  }
}

