import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const correctionSchema = z.object({
  markId: z.string().min(1),
  marksObtained: z.number().finite().nullable(),
  isAbsent: z.boolean().default(false),
  reason: z.string().trim().min(5).max(1000),
}).refine((value) => value.isAbsent || value.marksObtained !== null, {
  message: "A numeric mark is required unless the student is marked absent.",
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Only administrators may correct official results." }, { status: 403 });
    }

    const parsed = correctionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
    const { markId, marksObtained, isAbsent, reason } = parsed.data;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.mark.findUnique({
        where: { id: markId },
        include: {
          examSubject: { include: { examination: true, subject: true } },
          student: { select: { id: true, rollNo: true } },
        },
      });
      if (!existing) throw new Error("MARK_NOT_FOUND");
      if (existing.examSubject.examination.status !== "PUBLISHED") throw new Error("CORRECTION_REQUIRES_PUBLISHED_RESULT");
      if (existing.isWithheld) throw new Error("WITHHELD_MARK_REQUIRES_SEPARATE_RELEASE");

      const newMarks = isAbsent ? null : marksObtained;
      if (!isAbsent && (newMarks === null || newMarks < 0 || newMarks > existing.examSubject.maxMarks)) {
        throw new Error("MARKS_OUT_OF_RANGE");
      }

      await tx.markCorrectionAudit.create({
        data: {
          markId: existing.id, examSubjectId: existing.examSubjectId, studentId: existing.studentId,
          previousMarks: existing.marksObtained, newMarks,
          previousStatus: existing.status, newStatus: "PUBLISHED",
          reason, correctedById: session.id,
        },
      });

      const changed = await tx.mark.updateMany({
        where: { id: markId, updatedAt: existing.updatedAt },
        data: { marksObtained: newMarks, isAbsent, remarks: `Corrected: ${reason}`, status: "PUBLISHED" },
      });
      if (changed.count !== 1) throw new Error("MARK_CHANGED");
      const updatedMark = await tx.mark.findUniqueOrThrow({ where: { id: markId } });

      await tx.auditLog.create({
        data: {
          userId: session.id, action: "RESULT_CORRECTED", entityType: "Mark", entityId: markId,
          details: JSON.stringify({
            studentRoll: existing.student.rollNo,
            examName: existing.examSubject.examination.name,
            subjectCode: existing.examSubject.subject.code,
            previousMarks: existing.marksObtained, newMarks, reason,
          }),
        },
      });
      return updatedMark;
    });

    return NextResponse.json({
      success: true,
      message: "Result correction recorded with its permanent audit history.",
      mark: updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "MARK_NOT_FOUND") return NextResponse.json({ error: "Marks record not found" }, { status: 404 });
    if (message === "MARK_CHANGED") return NextResponse.json({ error: "This mark was changed by another administrator. Reload the record before retrying." }, { status: 409 });
    if (message === "CORRECTION_REQUIRES_PUBLISHED_RESULT") return NextResponse.json({ error: "Corrections are only permitted for published results." }, { status: 409 });
    if (message === "WITHHELD_MARK_REQUIRES_SEPARATE_RELEASE") return NextResponse.json({ error: "Withheld marks require the separate administrative release workflow." }, { status: 409 });
    if (message === "MARKS_OUT_OF_RANGE") return NextResponse.json({ error: "Marks are outside the permitted range." }, { status: 400 });
    console.error("Result correction error:", error);
    return NextResponse.json({ error: "Failed to apply result correction" }, { status: 500 });
  }
}
