import { NextResponse } from "next/server";
import { getSession, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const exam = await prisma.examination.findUnique({
      where: { id: params.id },
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
        studentExamEnrollments: {
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
        },
        publications: {
          include: {
            publishedBy: {
              select: { email: true },
            },
          },
          orderBy: { publishedAt: "desc" },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    }

    if (session.role === "STUDENT" && exam.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({ success: true, examination: exam });
  } catch (error) {
    console.error("Exam GET error:", error);
    return NextResponse.json({ error: "Failed to fetch examination" }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "FACULTY")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { status, name, description, examDate } = body;

    const existingExam = await prisma.examination.findUnique({
      where: { id: params.id },
    });

    if (!existingExam) {
      return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    }

    // Faculty can only transition from DRAFT -> UNDER_REVIEW
    if (session.role === "FACULTY") {
      if (status && status !== "UNDER_REVIEW") {
        return NextResponse.json(
          { error: "Faculty can only submit examination for review" },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.examination.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(examDate && { examDate: new Date(examDate) }),
        ...(status && { status }),
      },
    });

    await logAudit({
      userId: session.id,
      action: "EXAM_UPDATED",
      entityType: "Examination",
      entityId: updated.id,
      details: { previousStatus: existingExam.status, newStatus: updated.status },
    });

    return NextResponse.json({ success: true, examination: updated });
  } catch (error) {
    console.error("Exam PUT error:", error);
    return NextResponse.json({ error: "Failed to update examination" }, { status: 500 });
  }
}

