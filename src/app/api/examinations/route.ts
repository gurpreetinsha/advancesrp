import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createExamSchema = z.object({
  name: z.string().min(2, "Examination name is required"),
  examDate: z.string().min(1, "Examination date is required"),
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

    // Faculty can view examinations relevant to their assigned subjects/semesters
    if (session.role === "FACULTY" && session.facultyId) {
      const assignments = await prisma.facultyAssignment.findMany({
        where: { facultyId: session.facultyId },
        select: { semesterId: true },
      });
      const allowedSemesters = Array.from(new Set(assignments.map((a) => a.semesterId)));
      whereClause.semesterId = { in: allowedSemesters };
    }

    // Students only ever see PUBLISHED examinations
    if (session.role === "STUDENT") {
      whereClause.status = "PUBLISHED";
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

      // 3. Find and enroll eligible students matching batch and semester
      const eligibleStudents = await tx.student.findMany({
        where: {
          batchId: data.batchId,
          currentSemesterId: data.semesterId,
          isActive: true,
        },
      });

      for (const stu of eligibleStudents) {
        await tx.studentExamEnrollment.create({
          data: {
            examId: createdExam.id,
            studentId: stu.id,
            batchId: stu.batchId,
            semesterId: stu.currentSemesterId,
            sectionId: stu.currentSectionId,
            isEligible: true,
          },
        });
      }

      return createdExam;
    });

    await logAudit({
      userId: session.id,
      action: "EXAM_CREATED",
      entityType: "Examination",
      entityId: exam.id,
      details: { name: exam.name, date: exam.examDate, batchId: exam.batchId },
    });

    return NextResponse.json({ success: true, examination: exam }, { status: 201 });
  } catch (error) {
    console.error("Exam create error:", error);
    return NextResponse.json({ error: "Failed to create examination" }, { status: 500 });
  }
}
