import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateSubjectWiseRanking,
  calculateClassWiseRanking,
  calculateBatchWiseRanking,
} from "@/lib/ranking/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // "subject", "class", "batch"
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const sectionId = searchParams.get("sectionId");

    if (!examId) {
      return NextResponse.json({ error: "examId query parameter is required" }, { status: 400 });
    }

    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: {
        academicYear: true,
        semester: true,
        batch: {
          include: { branch: true },
        },
        examSubjects: {
          include: {
            subject: true,
            marks: {
              where: session.role === "STUDENT" ? { status: "PUBLISHED" } : {},
              include: {
                student: true,
              },
            },
          },
        },
        studentExamEnrollments: {
          include: {
            student: true,
            section: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examination not found" }, { status: 404 });
    }

    if (!["ADMIN", "FACULTY", "STUDENT"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (session.role === "STUDENT") {
      if (!session.studentId || exam.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Rankings are unavailable" }, { status: 403 });
      }
      const ownEnrollment = exam.studentExamEnrollments.find((e) => e.studentId === session.studentId && e.isEligible);
      if (!ownEnrollment) return NextResponse.json({ error: "You are not enrolled in this examination." }, { status: 403 });
    }

    // Faculty access is restricted to assigned subjects and sections.
    let facultyAllowedSections: string[] | null = null;
    if (session.role === "FACULTY") {
      if (!session.facultyId || type !== "subject" || !subjectId) {
        return NextResponse.json({ error: "Faculty may view only rankings for assigned subjects." }, { status: 403 });
      }
      const facultyAssignments = await prisma.facultyAssignment.findMany({
        where: {
          facultyId: session.facultyId, subjectId,
          academicYearId: exam.academicYearId, semesterId: exam.semesterId,
          canEnterMarks: true,
        },
        select: { sectionId: true },
      });
      if (!facultyAssignments.length) return NextResponse.json({ error: "Not assigned to this subject and academic year." }, { status: 403 });
      facultyAllowedSections = facultyAssignments.some((a) => a.sectionId === null)
        ? null
        : facultyAssignments.map((a) => a.sectionId).filter((id): id is string => Boolean(id));
      if (sectionId && facultyAllowedSections && !facultyAllowedSections.includes(sectionId)) {
        return NextResponse.json({ error: "Not assigned to this section." }, { status: 403 });
      }
    }

    // Students can only access rankings of PUBLISHED examinations
    if (session.role === "STUDENT" && exam.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Rankings are not available until the examination is officially published." },
        { status: 403 }
      );
    }

    // 1. Subject-wise ranking
    if (type === "subject") {
      if (!subjectId) {
        return NextResponse.json({ error: "subjectId is required for subject-wise ranking" }, { status: 400 });
      }

      const examSub = exam.examSubjects.find((es) => es.subjectId === subjectId);
      if (!examSub) {
        return NextResponse.json({ error: "Subject not found in this examination" }, { status: 404 });
      }

      // Check Faculty permission
      if (session.role === "FACULTY" && session.facultyId) {
        const assignment = await prisma.facultyAssignment.findFirst({
          where: {
            facultyId: session.facultyId,
            subjectId,
            semesterId: exam.semesterId,
          },
        });
        if (!assignment) {
          return NextResponse.json({ error: "Forbidden: Not assigned to this subject" }, { status: 403 });
        }
      }

      const enrollmentsMap = new Map(exam.studentExamEnrollments.map((e) => [e.studentId, e]));
      const marksMap = new Map(examSub.marks.map((m) => [m.studentId, m]));
      const scopedEnrollments = exam.studentExamEnrollments.filter((enr) =>
        (!sectionId || enr.sectionId === sectionId) &&
        (!facultyAllowedSections || facultyAllowedSections.includes(enr.sectionId || ""))
      );
      const rawSubjectMarks = scopedEnrollments.map((enr) => {
        const mark = marksMap.get(enr.studentId);
        return {
          studentId: enr.studentId,
          rollNo: enr.student.rollNo,
          studentName: `${enr.student.firstName} ${enr.student.lastName}`,
          marksObtained: mark?.marksObtained ?? null,
          maxMarks: examSub.maxMarks,
          passingMarks: examSub.passingMarks,
          isAbsent: mark?.isAbsent ?? false,
          isWithheld: mark?.isWithheld ?? false,
          isEligible: enr.isEligible,
        };
      });

      const rankings = calculateSubjectWiseRanking(rawSubjectMarks);
      const visibleRankings = session.role === "STUDENT"
        ? rankings.filter((r) => r.studentId === session.studentId).map((r) => ({ ...r, studentName: "You", rollNo: session.rollNo || "", studentId: session.studentId }))
        : rankings;

      return NextResponse.json({
        success: true,
        type: "subject",
        examName: exam.name,
        subjectCode: examSub.subject.code,
        subjectName: examSub.subject.name,
        maxMarks: examSub.maxMarks,
        rankings: visibleRankings,
        totalEligible: rankings.length,
      });
    }

    // Prepare Cohort Aggregate students for Class and Batch rankings
    const cohortStudentsMap = new Map<string, {
      studentId: string;
      rollNo: string;
      studentName: string;
      sectionId?: string;
      sectionName?: string;
      batchName?: string;
      isEligible: boolean;
      subjectResults: Array<{
        subjectId: string;
        subjectCode: string;
        subjectName: string;
        credits: number;
        maxMarks: number;
        passingMarks: number;
        marksObtained: number | null;
        isAbsent: boolean;
        isWithheld: boolean;
      }>;
    }>();

    for (const enr of exam.studentExamEnrollments) {
      cohortStudentsMap.set(enr.studentId, {
        studentId: enr.student.id,
        rollNo: enr.student.rollNo,
        studentName: `${enr.student.firstName} ${enr.student.lastName}`,
        sectionId: enr.sectionId || undefined,
        sectionName: enr.section?.name || undefined,
        batchName: exam.batch.name,
        isEligible: enr.isEligible,
        subjectResults: [],
      });
    }

    for (const es of exam.examSubjects) {
      const marksByStudent = new Map(es.marks.map((mark) => [mark.studentId, mark]));
      for (const enrollment of exam.studentExamEnrollments) {
        const sEntry = cohortStudentsMap.get(enrollment.studentId);
        if (!sEntry) continue;
        const mark = marksByStudent.get(enrollment.studentId);
        // Include every configured subject in every eligible student's denominator.
        // A missing mark is incomplete (zero for provisional arithmetic), never silently omitted.
        sEntry.subjectResults.push({
          subjectId: es.subject.id,
          subjectCode: es.subject.code,
          subjectName: es.subject.name,
          credits: es.subject.credits,
          maxMarks: es.maxMarks,
          passingMarks: es.passingMarks,
          marksObtained: mark?.marksObtained ?? null,
          isAbsent: mark?.isAbsent ?? false,
          isWithheld: mark?.isWithheld ?? false,
        });
      }
    }

    const allStudents = Array.from(cohortStudentsMap.values());

    // 2. Class-wise ranking
    if (type === "class") {
      let filteredStudents = allStudents;
      if (sectionId) {
        filteredStudents = allStudents.filter((s) => s.sectionId === sectionId);
      }

      const classRankings = calculateClassWiseRanking(filteredStudents);

      const visible = session.role === "STUDENT"
        ? classRankings.filter((r) => r.studentId === session.studentId).map((r) => ({ ...r, studentName: "You", rollNo: session.rollNo || "", studentId: session.studentId }))
        : classRankings;
      return NextResponse.json({
        success: true,
        type: "class",
        examName: exam.name,
        sectionId: sectionId || "ALL",
        totalEligible: classRankings.length > 0 ? classRankings[0].totalEligible : 0,
        rankings: visible,
      });
    }

    // 3. Batch-wise ranking (across all sections)
    const batchRankings = calculateBatchWiseRanking(allStudents);

    const visibleBatch = session.role === "STUDENT"
      ? batchRankings.filter((r) => r.studentId === session.studentId).map((r) => ({ ...r, studentName: "You", rollNo: session.rollNo || "", studentId: session.studentId }))
      : batchRankings;
    return NextResponse.json({
      success: true,
      type: "batch",
      examName: exam.name,
      batchName: exam.batch.name,
      totalEligible: batchRankings.length > 0 ? batchRankings[0].totalEligible : 0,
      rankings: visibleBatch,
    });
  } catch (error) {
    console.error("Rankings API error:", error);
    return NextResponse.json({ error: "Failed to compute rankings" }, { status: 500 });
  }
}
