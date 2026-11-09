import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "FACULTY")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const sectionId = searchParams.get("sectionId");

    if (!examId || !subjectId) {
      return NextResponse.json(
        { error: "examId and subjectId query parameters are required" },
        { status: 400 }
      );
    }

    // Find the ExamSubject
    const examSubject = await prisma.examSubject.findUnique({
      where: {
        examId_subjectId: { examId, subjectId },
      },
      include: {
        examination: {
          include: {
            semester: true,
            batch: true,
          },
        },
        subject: true,
      },
    });

    if (!examSubject) {
      return NextResponse.json({ error: "Exam subject configuration not found" }, { status: 404 });
    }

    // Role check for Faculty: must be assigned to this subject and semester!
    if (session.role === "FACULTY" && session.facultyId) {
      const assignment = await prisma.facultyAssignment.findFirst({
        where: {
          facultyId: session.facultyId,
          subjectId,
          semesterId: examSubject.examination.semesterId,
          ...(sectionId ? { sectionId } : {}),
        },
      });

      if (!assignment) {
        return NextResponse.json(
          { error: "Forbidden: You are not assigned to manage marks for this subject and class." },
          { status: 403 }
        );
      }
    }

    // Fetch enrolled students for this examination
    const whereEnrollment: Record<string, unknown> = {
      examId,
      isEligible: true,
    };
    if (sectionId) {
      whereEnrollment.sectionId = sectionId;
    }

    const studentEnrollments = await prisma.studentExamEnrollment.findMany({
      where: whereEnrollment,
      include: {
        student: {
          include: {
            currentSection: true,
          },
        },
        section: true,
      },
      orderBy: {
        student: { rollNo: "asc" },
      },
    });

    // Fetch existing marks for this examSubject
    const existingMarks = await prisma.mark.findMany({
      where: {
        examSubjectId: examSubject.id,
      },
    });

    const marksMap = new Map(existingMarks.map((m) => [m.studentId, m]));

    const studentsWithMarks = studentEnrollments.map((enr) => {
      const markRecord = marksMap.get(enr.studentId);
      return {
        studentId: enr.student.id,
        rollNo: enr.student.rollNo,
        enrollmentNo: enr.student.enrollmentNo,
        studentName: `${enr.student.firstName} ${enr.student.lastName}`,
        sectionId: enr.sectionId,
        sectionName: enr.section?.name || enr.student.currentSection?.name || "N/A",
        markId: markRecord?.id || null,
        marksObtained: markRecord?.marksObtained ?? null,
        isAbsent: markRecord?.isAbsent || false,
        isWithheld: markRecord?.isWithheld || false,
        status: markRecord?.status || "DRAFT",
        remarks: markRecord?.remarks || "",
      };
    });

    return NextResponse.json({
      success: true,
      examSubject: {
        id: examSubject.id,
        examId: examSubject.examId,
        examName: examSubject.examination.name,
        examStatus: examSubject.examination.status,
        subjectId: examSubject.subjectId,
        subjectCode: examSubject.subject.code,
        subjectName: examSubject.subject.name,
        maxMarks: examSubject.maxMarks,
        passingMarks: examSubject.passingMarks,
      },
      students: studentsWithMarks,
    });
  } catch (error) {
    console.error("Marks GET error:", error);
    return NextResponse.json({ error: "Failed to fetch marks" }, { status: 500 });
  }
}

const marksBatchSchema = z.object({
  examSubjectId: z.string(),
  marks: z.array(
    z.object({
      studentId: z.string(),
      marksObtained: z.number().nullable(),
      isAbsent: z.boolean().default(false),
      isWithheld: z.boolean().default(false),
      remarks: z.string().optional(),
    })
  ),
  submitForReview: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "FACULTY")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = marksBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { examSubjectId, marks, submitForReview } = parsed.data;

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

    // If published, only admin can perform corrections through the correction workflow
    if (examSubject.examination.status === "PUBLISHED" && session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden: This examination is already published. Modifications require administrative correction." },
        { status: 403 }
      );
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
          { error: "Forbidden: You are not assigned to manage marks for this subject." },
          { status: 403 }
        );
      }
    }

    // Validate all marks values
    for (const m of marks) {
      if (!m.isAbsent && m.marksObtained !== null) {
        if (m.marksObtained < 0) {
          return NextResponse.json(
            { error: `Marks cannot be negative. Given: ${m.marksObtained}` },
            { status: 400 }
          );
        }
        if (m.marksObtained > examSubject.maxMarks) {
          return NextResponse.json(
            { error: `Marks (${m.marksObtained}) exceed maximum allowed marks (${examSubject.maxMarks}).` },
            { status: 400 }
          );
        }
      }
    }

    const targetStatus = submitForReview ? "UNDER_REVIEW" : "DRAFT";

    // Transaction to batch upsert marks
    await prisma.$transaction(async (tx) => {
      for (const m of marks) {
        const marksVal = m.isAbsent ? null : m.marksObtained;
        await tx.mark.upsert({
          where: {
            examSubjectId_studentId: {
              examSubjectId,
              studentId: m.studentId,
            },
          },
          update: {
            marksObtained: marksVal,
            isAbsent: m.isAbsent,
            isWithheld: m.isWithheld,
            status: targetStatus,
            remarks: m.remarks || null,
          },
          create: {
            examSubjectId,
            studentId: m.studentId,
            marksObtained: marksVal,
            isAbsent: m.isAbsent,
            isWithheld: m.isWithheld,
            status: targetStatus,
            remarks: m.remarks || null,
            enteredById: session.id,
          },
        });
      }

      if (submitForReview && examSubject.examination.status === "DRAFT") {
        await tx.examination.update({
          where: { id: examSubject.examId },
          data: { status: "UNDER_REVIEW" },
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: submitForReview ? "MARKS_SUBMITTED_FOR_REVIEW" : "MARKS_SAVED_DRAFT",
      entityType: "ExamSubject",
      entityId: examSubjectId,
      details: {
        examName: examSubject.examination.name,
        subjectCode: examSubject.subject.code,
        marksUpdated: marks.length,
        status: targetStatus,
      },
    });

    return NextResponse.json({
      success: true,
      message: submitForReview
        ? "Marks successfully submitted for review and approval."
        : "Marks saved as draft successfully.",
    });
  } catch (error) {
    console.error("Marks POST error:", error);
    return NextResponse.json({ error: "Failed to save marks" }, { status: 500 });
  }
}
