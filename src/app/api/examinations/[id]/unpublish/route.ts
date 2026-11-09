import { NextResponse } from "next/server";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators can unpublish examination results" }, { status: 403 });
    }

    const body = await req.json();
    const reason = body.reason?.trim();

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "A valid reason (minimum 5 characters) is required to unpublish results." },
        { status: 400 }
      );
    }

    const examId = params.id;
    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: { examSubjects: true },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // 1. Set exam status to UNDER_REVIEW
      await tx.examination.update({
        where: { id: examId },
        data: {
          status: "UNDER_REVIEW",
        },
      });

      // 2. Set marks back to UNDER_REVIEW
      for (const es of exam.examSubjects) {
        await tx.mark.updateMany({
          where: { examSubjectId: es.id },
          data: { status: "UNDER_REVIEW" },
        });
      }

      // 3. Mark active publication as inactive with reason
      await tx.resultPublication.updateMany({
        where: { examId, isActive: true },
        data: {
          isActive: false,
          unpublishReason: reason,
        },
      });
    });

    await logAudit({
      userId: session.id,
      action: "RESULT_UNPUBLISHED",
      entityType: "Examination",
      entityId: examId,
      details: { examName: exam.name, reason },
    });

    return NextResponse.json({
      success: true,
      message: `Results for '${exam.name}' have been unpublished for review/correction.`,
    });
  } catch (error) {
    console.error("Exam unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish results" }, { status: 500 });
  }
}

