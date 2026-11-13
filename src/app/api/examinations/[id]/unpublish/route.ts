import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ reason: z.string().trim().min(5).max(1000) });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can unpublish results." }, { status: 403 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "A valid unpublishing reason is required.", details: parsed.error.flatten() }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.findUnique({
        where: { id: params.id },
        include: { examSubjects: { select: { id: true } }, publications: { where: { isActive: true } } },
      });
      if (!exam) throw new Error("EXAM_NOT_FOUND");
      if (exam.status !== "PUBLISHED" || exam.publications.length === 0) throw new Error("EXAM_NOT_PUBLISHED");

      const transition = await tx.examination.updateMany({
        where: { id: exam.id, status: "PUBLISHED" },
        data: { status: "UNDER_REVIEW" },
      });
      if (transition.count !== 1) throw new Error("EXAM_STATE_CHANGED");
      await tx.mark.updateMany({
        where: { examSubjectId: { in: exam.examSubjects.map((s) => s.id) }, status: "PUBLISHED" },
        data: { status: "UNDER_REVIEW" },
      });
      await tx.resultPublication.updateMany({
        where: { examId: exam.id, isActive: true },
        data: { isActive: false, unpublishReason: parsed.data.reason },
      });
      await tx.auditLog.create({
        data: {
          userId: session.id, action: "RESULT_UNPUBLISHED", entityType: "Examination", entityId: exam.id,
          details: JSON.stringify({ examName: exam.name, reason: parsed.data.reason }),
        },
      });
      return exam.name;
    });

    return NextResponse.json({ success: true, message: `Results for '${result}' have been unpublished for review/correction.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "EXAM_NOT_FOUND") return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    if (message === "EXAM_STATE_CHANGED") return NextResponse.json({ error: "Examination state changed during unpublishing. Refresh and retry." }, { status: 409 });
    if (message === "EXAM_NOT_PUBLISHED") return NextResponse.json({ error: "Only currently published examinations can be unpublished." }, { status: 409 });
    console.error("Exam unpublish error:", error);
    return NextResponse.json({ error: "Failed to unpublish results" }, { status: 500 });
  }
}
