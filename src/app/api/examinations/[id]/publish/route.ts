import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Only administrators can publish results." }, { status: 403 });

    const result = await prisma.$transaction(async (tx) => {
      const exam = await tx.examination.findUnique({
        where: { id: params.id },
        include: {
          examSubjects: { include: { marks: true } },
          studentExamEnrollments: { where: { isEligible: true } },
          publications: { orderBy: { version: "desc" }, take: 1 },
        },
      });
      if (!exam) throw new Error("EXAM_NOT_FOUND");
      if (exam.status !== "UNDER_REVIEW") throw new Error("EXAM_NOT_UNDER_REVIEW");
      if (!exam.examSubjects.length || !exam.studentExamEnrollments.length) throw new Error("EMPTY_EXAM_COHORT");

      const expected = exam.examSubjects.length * exam.studentExamEnrollments.length;
      let complete = 0;
      let submitted = 0;
      for (const subject of exam.examSubjects) {
        const marksByStudent = new Map(subject.marks.map((mark) => [mark.studentId, mark]));
        for (const enrollment of exam.studentExamEnrollments) {
          const mark = marksByStudent.get(enrollment.studentId);
          if (!mark) continue;
          complete += 1;
          if (mark.status === "UNDER_REVIEW") submitted += 1;
        }
      }
      if (complete !== expected) throw new Error(`INCOMPLETE_MARKS:${expected - complete}`);
      if (submitted !== expected) throw new Error(`MARKS_NOT_SUBMITTED:${expected - submitted}`);

      const transition = await tx.examination.updateMany({
        where: { id: exam.id, status: "UNDER_REVIEW" },
        data: { status: "PUBLISHED", publishedAt: new Date(), publishedById: session.id },
      });
      if (transition.count !== 1) throw new Error("EXAM_STATE_CHANGED");
      await tx.mark.updateMany({
        where: { examSubjectId: { in: exam.examSubjects.map((subject) => subject.id) }, studentId: { in: exam.studentExamEnrollments.map((e) => e.studentId) } },
        data: { status: "PUBLISHED" },
      });

      const version = (exam.publications[0]?.version || 0) + 1;
      await tx.resultPublication.create({
        data: { examId: exam.id, publishedById: session.id, isActive: true, version },
      });
      await tx.auditLog.create({
        data: {
          userId: session.id, action: "RESULT_PUBLISHED", entityType: "Examination", entityId: exam.id,
          details: JSON.stringify({ examName: exam.name, subjectsCount: exam.examSubjects.length, studentsCount: exam.studentExamEnrollments.length, version }),
        },
      });
      return { examName: exam.name, version };
    });

    return NextResponse.json({ success: true, message: `Results for '${result.examName}' have been published (version ${result.version}).` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "EXAM_NOT_FOUND") return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    if (message === "EXAM_STATE_CHANGED") return NextResponse.json({ error: "Examination state changed during publication. Refresh and retry." }, { status: 409 });
    if (message === "EXAM_NOT_UNDER_REVIEW") return NextResponse.json({ error: "Only examinations under review can be published." }, { status: 409 });
    if (message === "EMPTY_EXAM_COHORT") return NextResponse.json({ error: "Examination must contain subjects and eligible students." }, { status: 400 });
    if (message.startsWith("INCOMPLETE_MARKS:")) return NextResponse.json({ error: `Cannot publish: ${message.split(":")[1]} eligible student-subject mark records are missing.` }, { status: 409 });
    if (message.startsWith("MARKS_NOT_SUBMITTED:")) return NextResponse.json({ error: `Cannot publish: ${message.split(":")[1]} mark records have not been submitted for review.` }, { status: 409 });
    console.error("Exam publish error:", error);
    return NextResponse.json({ error: "Failed to publish examination results" }, { status: 500 });
  }
}
