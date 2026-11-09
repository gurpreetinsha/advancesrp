import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const correctionSchema = z.object({
  markId: z.string().min(1, "Mark ID is required"),
  marksObtained: z.number().nullable(),
  isAbsent: z.boolean().default(false),
  reason: z.string().min(5, "A descriptive reason (min 5 characters) is required for audit compliance"),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators are authorized to perform official result corrections" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = correctionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { markId, marksObtained, isAbsent, reason } = parsed.data;

    const existingMark = await prisma.mark.findUnique({
      where: { id: markId },
      include: {
        examSubject: {
          include: {
            examination: true,
            subject: true,
          },
        },
        student: true,
      },
    });

    if (!existingMark) {
      return NextResponse.json({ error: "Marks record not found" }, { status: 404 });
    }

    // Validate marks limit
    if (!isAbsent && marksObtained !== null) {
      if (marksObtained < 0 || marksObtained > existingMark.examSubject.maxMarks) {
        return NextResponse.json(
          {
            error: `Marks must be between 0 and ${existingMark.examSubject.maxMarks}. Provided: ${marksObtained}`,
          },
          { status: 400 }
        );
      }
    }

    const newMarksVal = isAbsent ? null : marksObtained;

    // Transaction to update mark and create audit trail entry
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Create MarkCorrectionAudit entry
      await tx.markCorrectionAudit.create({
        data: {
          markId: existingMark.id,
          examSubjectId: existingMark.examSubjectId,
          studentId: existingMark.studentId,
          previousMarks: existingMark.marksObtained,
          newMarks: newMarksVal,
          previousStatus: existingMark.status,
          newStatus: existingMark.status,
          reason,
          correctedById: session.id,
        },
      });

      // 2. Update Mark record
      const updatedMark = await tx.mark.update({
        where: { id: markId },
        data: {
          marksObtained: newMarksVal,
          isAbsent,
          remarks: `Corrected: ${reason}`,
        },
      });

      return updatedMark;
    });

    await logAudit({
      userId: session.id,
      action: "RESULT_CORRECTED",
      entityType: "Mark",
      entityId: markId,
      details: {
        studentRoll: existingMark.student.rollNo,
        examName: existingMark.examSubject.examination.name,
        subjectCode: existingMark.examSubject.subject.code,
        previousMarks: existingMark.marksObtained,
        newMarks: newMarksVal,
        reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Result correction recorded and audit trail created successfully.",
      mark: updated,
    });
  } catch (error) {
    console.error("Result correction error:", error);
    return NextResponse.json({ error: "Failed to apply result correction" }, { status: 500 });
  }
}

