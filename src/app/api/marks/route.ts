import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

async function facultyScope(session: { role: string; facultyId?: string }, exam: { academicYearId: string; semesterId: string }, subjectId: string) {
  if (session.role !== "FACULTY" || !session.facultyId) return null;
  const assignments = await prisma.facultyAssignment.findMany({
    where: {
      facultyId: session.facultyId,
      subjectId,
      academicYearId: exam.academicYearId,
      semesterId: exam.semesterId,
      canEnterMarks: true,
    },
    select: { sectionId: true },
  });
  if (!assignments.length) return [];
  return assignments.some((a) => a.sectionId === null)
    ? null
    : assignments.map((a) => a.sectionId).filter((id): id is string => Boolean(id));
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "FACULTY"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const requestedSectionId = searchParams.get("sectionId");
    if (!examId || !subjectId) return NextResponse.json({ error: "examId and subjectId are required" }, { status: 400 });

    const examSubject = await prisma.examSubject.findUnique({
      where: { examId_subjectId: { examId, subjectId } },
      include: { examination: true, subject: true },
    });
    if (!examSubject) return NextResponse.json({ error: "Exam subject configuration not found" }, { status: 404 });

    const allowedSections = await facultyScope(session, examSubject.examination, subjectId);
    if (allowedSections && allowedSections.length === 0) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (allowedSections && requestedSectionId && !allowedSections.includes(requestedSectionId)) {
      return NextResponse.json({ error: "You are not assigned to this section" }, { status: 403 });
    }

    const enrollments = await prisma.studentExamEnrollment.findMany({
      where: {
        examId, isEligible: true,
        ...(requestedSectionId ? { sectionId: requestedSectionId } : {}),
        ...(allowedSections ? { sectionId: { in: allowedSections } } : {}),
      },
      include: { student: { include: { currentSection: true } }, section: true },
      orderBy: { student: { rollNo: "asc" } },
    });
    const marks = await prisma.mark.findMany({
      where: { examSubjectId: examSubject.id, studentId: { in: enrollments.map((e) => e.studentId) } },
    });
    const markMap = new Map(marks.map((m) => [m.studentId, m]));

    return NextResponse.json({
      success: true,
      examSubject: {
        id: examSubject.id, examId, examName: examSubject.examination.name,
        examStatus: examSubject.examination.status, subjectId,
        subjectCode: examSubject.subject.code, subjectName: examSubject.subject.name,
        maxMarks: examSubject.maxMarks, passingMarks: examSubject.passingMarks,
      },
      students: enrollments.map((enr) => {
        const mark = markMap.get(enr.studentId);
        return {
          studentId: enr.student.id, rollNo: enr.student.rollNo, enrollmentNo: enr.student.enrollmentNo,
          studentName: `${enr.student.firstName} ${enr.student.lastName}`,
          sectionId: enr.sectionId, sectionName: enr.section?.name || enr.student.currentSection?.name || "N/A",
          markId: mark?.id || null, marksObtained: mark?.marksObtained ?? null,
          isAbsent: mark?.isAbsent || false, isWithheld: mark?.isWithheld || false,
          status: mark?.status || "DRAFT", remarks: mark?.remarks || "",
        };
      }),
    });
  } catch (error) {
    console.error("Marks GET error:", error);
    return NextResponse.json({ error: "Failed to fetch marks" }, { status: 500 });
  }
}

const marksBatchSchema = z.object({
  examSubjectId: z.string().min(1),
  marks: z.array(z.object({
    studentId: z.string().min(1),
    marksObtained: z.number().finite().nullable(),
    isAbsent: z.boolean().default(false),
    isWithheld: z.boolean().default(false),
    remarks: z.string().max(1000).optional(),
  }).refine((m) => !(m.isAbsent && m.isWithheld), { message: "A mark cannot be both absent and withheld" })).min(1).max(1000),
  submitForReview: z.boolean().optional(),
}).refine((body) => new Set(body.marks.map((m) => m.studentId)).size === body.marks.length, {
  message: "Duplicate student IDs are not allowed",
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "FACULTY"].includes(session.role)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

    const body = await req.json();
    const parsed = marksBatchSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    const { examSubjectId, marks, submitForReview } = parsed.data;

    const examSubject = await prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { examination: true, subject: true },
    });
    if (!examSubject) return NextResponse.json({ error: "Exam subject not found" }, { status: 404 });

    // Published and archived results are immutable through the ordinary entry endpoint.
    if (["PUBLISHED", "ARCHIVED"].includes(examSubject.examination.status)) {
      return NextResponse.json({ error: "Published/archived results can only be changed through the dedicated correction workflow." }, { status: 409 });
    }

    const allowedSections = await facultyScope(session, examSubject.examination, examSubject.subjectId);
    if (allowedSections && allowedSections.length === 0) return NextResponse.json({ error: "You are not assigned to enter marks for this subject and academic year." }, { status: 403 });

    const enrollments = await prisma.studentExamEnrollment.findMany({
      where: {
        examId: examSubject.examId,
        isEligible: true,
        ...(allowedSections ? { sectionId: { in: allowedSections } } : {}),
        studentId: { in: marks.map((m) => m.studentId) },
      },
      select: { studentId: true },
    });
    const enrolledIds = new Set(enrollments.map((e) => e.studentId));
    const unauthorizedIds = marks.filter((m) => !enrolledIds.has(m.studentId));
    if (unauthorizedIds.length) return NextResponse.json({ error: "One or more students are not eligible members of your assigned examination cohort." }, { status: 403 });

    for (const m of marks) {
      if (m.isAbsent) {
        if (m.marksObtained !== null) return NextResponse.json({ error: "Absent students must not have a numeric mark." }, { status: 400 });
      } else if (!m.isWithheld) {
        if (m.marksObtained === null || m.marksObtained < 0 || m.marksObtained > examSubject.maxMarks) {
          return NextResponse.json({ error: `Marks must be between 0 and ${examSubject.maxMarks}; withheld marks may be null.` }, { status: 400 });
        }
      }
    }

    const targetStatus = submitForReview ? "UNDER_REVIEW" : "DRAFT";
    await prisma.$transaction(async (tx) => {
      for (const mark of marks) {
        await tx.mark.upsert({
          where: { examSubjectId_studentId: { examSubjectId, studentId: mark.studentId } },
          update: {
            marksObtained: mark.isAbsent || mark.isWithheld ? null : mark.marksObtained,
            isAbsent: mark.isAbsent, isWithheld: mark.isWithheld, status: targetStatus,
            remarks: mark.remarks || null,
          },
          create: {
            examSubjectId, studentId: mark.studentId,
            marksObtained: mark.isAbsent || mark.isWithheld ? null : mark.marksObtained,
            isAbsent: mark.isAbsent, isWithheld: mark.isWithheld, status: targetStatus,
            remarks: mark.remarks || null, enteredById: session.id,
          },
        });
      }
      if (submitForReview && examSubject.examination.status === "DRAFT") {
        await tx.examination.update({ where: { id: examSubject.examId }, data: { status: "UNDER_REVIEW" } });
      }
      await tx.auditLog.create({
        data: {
          userId: session.id, action: submitForReview ? "MARKS_SUBMITTED_FOR_REVIEW" : "MARKS_SAVED_DRAFT",
          entityType: "ExamSubject", entityId: examSubjectId,
          details: JSON.stringify({ examName: examSubject.examination.name, subjectCode: examSubject.subject.code, marksUpdated: marks.length, status: targetStatus }),
        },
      });
    });

    return NextResponse.json({ success: true, message: submitForReview ? "Marks submitted for review." : "Marks saved as draft." });
  } catch (error) {
    console.error("Marks POST error:", error);
    return NextResponse.json({ error: "Failed to save marks" }, { status: 500 });
  }
}
