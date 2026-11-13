import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createExamSchema = z.object({
  name: z.string().min(2, "Examination name is required"),
  examDate: z.string().min(1, "Examination date is required").refine((value) => !Number.isNaN(Date.parse(value)), "Invalid examination date"),
  academicYearId: z.string().min(1, "Academic year is required"),
  semesterId: z.string().min(1, "Semester is required"),
  batchId: z.string().min(1, "Batch is required"),
  description: z.string().optional(),
  subjects: z.array(
    z.object({
      subjectId: z.string(),
      maxMarks: z.number().positive("Maximum marks must be greater than 0"),
      passingMarks: z.number().nonnegative("Passing marks cannot be negative"),
    })
  ).min(1, "At least one subject must be configured for the examination"),
}).refine((data) => new Set(data.subjects.map((s) => s.subjectId)).size === data.subjects.length, {
  message: "Duplicate subjects are not allowed",
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const semesterId = searchParams.get("semesterId");
    const batchId = searchParams.get("batchId");

    const whereClause: Record<string, unknown> = {};
    if (status) whereClause.status = status;
    if (semesterId) whereClause.semesterId = semesterId;
    if (batchId) whereClause.batchId = batchId;

    // Faculty see only examinations containing their assigned subjects in
    // the assigned academic years and semesters.
    if (session.role === "FACULTY") {
      if (!session.facultyId) return NextResponse.json({ success: true, examinations: [] });
      const assignments = await prisma.facultyAssignment.findMany({
        where: { facultyId: session.facultyId, canEnterMarks: true },
        select: { semesterId: true, academicYearId: true, subjectId: true },
      });
      if (!assignments.length) return NextResponse.json({ success: true, examinations: [] });
      whereClause.semesterId = { in: Array.from(new Set(assignments.map((a) => a.semesterId))) };
      whereClause.academicYearId = { in: Array.from(new Set(assignments.map((a) => a.academicYearId))) };
      whereClause.examSubjects = { some: { subjectId: { in: Array.from(new Set(assignments.map((a) => a.subjectId))) } } };
    }

    // Students see only published examinations in which they have an enrollment snapshot.
    if (session.role === "STUDENT") {
      if (!session.studentId) return NextResponse.json({ success: true, examinations: [] });
      whereClause.status = "PUBLISHED";
      whereClause.studentExamEnrollments = { some: { studentId: session.studentId } };
    }

    const examinations = await prisma.examination.findMany({
      where: whereClause,
      include: {
        academicYear: true,
        semester: true,
        batch: {
          include: {
            branch: true,
          },
        },
        examSubjects: {
          include: {
            subject: true,
            _count: {
              select: { marks: true },
            },
          },
        },
        _count: {
          select: {
            studentExamEnrollments: true,
          },
        },
      },
      orderBy: { examDate: "desc" },
    });

    return NextResponse.json({ success: true, examinations });
  } catch (error) {
    console.error("Examinations GET error:", error);
    return NextResponse.json({ error: "Failed to fetch examinations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can create examinations" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createExamSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Validate the academic configuration before writing any records.
    const [batch, semester, academicYear, configuredSubjects] = await Promise.all([
      prisma.batch.findUnique({ where: { id: data.batchId }, select: { id: true, branchId: true } }),
      prisma.semester.findUnique({ where: { id: data.semesterId }, select: { id: true } }),
      prisma.academicYear.findUnique({ where: { id: data.academicYearId }, select: { id: true, startDate: true, endDate: true } }),
      prisma.subject.findMany({
        where: { id: { in: data.subjects.map((s) => s.subjectId) } },
        select: { id: true, branchId: true, semesterId: true },
      }),
    ]);
    if (!batch || !semester || !academicYear || configuredSubjects.length !== data.subjects.length) {
      return NextResponse.json({ error: "Invalid batch, semester, academic year, or subject selection." }, { status: 400 });
    }
    if (configuredSubjects.some((subject) => subject.branchId !== batch.branchId || subject.semesterId !== data.semesterId)) {
      return NextResponse.json({ error: "Every examination subject must belong to the selected batch branch and semester." }, { status: 400 });
    }
    const examDate = new Date(data.examDate);
    if (examDate < academicYear.startDate || examDate > academicYear.endDate) {
      return NextResponse.json({ error: "Examination date must fall within the selected academic year." }, { status: 400 });
    }

    // Validate passing marks <= max marks
    for (const sub of data.subjects) {
      if (sub.passingMarks > sub.maxMarks) {
        return NextResponse.json(
          { error: `Passing marks (${sub.passingMarks}) cannot exceed maximum marks (${sub.maxMarks})` },
          { status: 400 }
        );
      }
    }

    // Database transaction to create Examination, ExamSubjects, and enroll eligible students
    const exam = await prisma.$transaction(async (tx) => {
      // 1. Create Examination
      const createdExam = await tx.examination.create({
        data: {
          name: data.name,
          examDate: new Date(data.examDate),
          academicYearId: data.academicYearId,
          semesterId: data.semesterId,
          batchId: data.batchId,
          description: data.description || null,
          status: "DRAFT",
        },
      });

      // 2. Create ExamSubjects
      for (const sub of data.subjects) {
        await tx.examSubject.create({
          data: {
            examId: createdExam.id,
            subjectId: sub.subjectId,
            maxMarks: sub.maxMarks,
            passingMarks: sub.passingMarks,
          },
        });
      }

      // Snapshot the active historical enrollment for this academic year/semester.
      // Do not derive examination eligibility from mutable current-profile fields.
      const eligibleEnrollments = await tx.studentEnrollment.findMany({
        where: {
          academicYearId: data.academicYearId,
          batchId: data.batchId,
          semesterId: data.semesterId,
          status: "ACTIVE",
          student: { isActive: true },
        },
        select: { studentId: true, batchId: true, semesterId: true, sectionId: true },
      });

      for (const enrollment of eligibleEnrollments) {
        await tx.studentExamEnrollment.create({
          data: {
            examId: createdExam.id,
            studentId: enrollment.studentId,
            batchId: enrollment.batchId,
            semesterId: enrollment.semesterId,
            sectionId: enrollment.sectionId,
            isEligible: true,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id, action: "EXAM_CREATED", entityType: "Examination", entityId: createdExam.id,
          details: JSON.stringify({ name: createdExam.name, examDate: createdExam.examDate, batchId: createdExam.batchId, enrolledStudents: eligibleEnrollments.length }),
        },
      });

      return createdExam;
    });

    return NextResponse.json({ success: true, examination: exam }, { status: 201 });
  } catch (error) {
    console.error("Exam create error:", error);
    return NextResponse.json({ error: "Failed to create examination" }, { status: 500 });
  }
}
