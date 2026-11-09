import { NextResponse } from "next/server";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can publish examination results" }, { status: 403 });
    }

    const examId = params.id;
    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: {
        examSubjects: {
          include: {
            marks: true,
          },
        },
        studentExamEnrollments: true,
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    }

    // Verify marks exist
    const totalMarksRecorded = exam.examSubjects.reduce((acc, es) => acc + es.marks.length, 0);
    if (totalMarksRecorded === 0) {
      return NextResponse.json(
        { error: "Cannot publish examination without any entered marks records." },
        { status: 400 }
      );
    }

    // Transaction to update exam and all its marks to PUBLISHED and record publication
    await prisma.$transaction(async (tx) => {
      // 1. Update Examination status
      await tx.examination.update({
        where: { id: examId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          publishedById: session.id,
        },
      });

      // 2. Update all marks to PUBLISHED
      for (const es of exam.examSubjects) {
        await tx.mark.updateMany({
          where: { examSubjectId: es.id },
          data: { status: "PUBLISHED" },
        });
      }

      // 3. Create ResultPublication record
      await tx.resultPublication.create({
        data: {
          examId,
          publishedById: session.id,
          isActive: true,
        },
      });
    });

    await logAudit({
      userId: session.id,
      action: "RESULT_PUBLISHED",
      entityType: "Examination",
      entityId: examId,
      details: {
        examName: exam.name,
        subjectsCount: exam.examSubjects.length,
        studentsCount: exam.studentExamEnrollments.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Results for '${exam.name}' have been successfully published.`,
    });
  } catch (error) {
    console.error("Exam publish error:", error);
    return NextResponse.json({ error: "Failed to publish examination results" }, { status: 500 });
  }
}

