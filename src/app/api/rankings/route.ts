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

      let marksList = examSub.marks;
      if (sectionId) {
        marksList = marksList.filter((m) => enrollmentsMap.get(m.studentId)?.sectionId === sectionId);
      }

      const rawSubjectMarks = marksList.map((m) => {
        const enr = enrollmentsMap.get(m.studentId);
        return {
          studentId: m.studentId,
          rollNo: m.student.rollNo,
          studentName: `${m.student.firstName} ${m.student.lastName}`,
          marksObtained: m.marksObtained,
          maxMarks: examSub.maxMarks,
          passingMarks: examSub.passingMarks,
          isAbsent: m.isAbsent,
          isWithheld: m.isWithheld,
          isEligible: enr?.isEligible ?? true,
        };
      });

      const rankings = calculateSubjectWiseRanking(rawSubjectMarks);

      // If student viewer, redact other students' names/roll numbers if desired or show self rank clearly
      return NextResponse.json({
        success: true,
        type: "subject",
        examName: exam.name,
        subjectCode: examSub.subject.code,
        subjectName: examSub.subject.name,
        maxMarks: examSub.maxMarks,
        rankings,
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
      for (const m of es.marks) {
        const sEntry = cohortStudentsMap.get(m.studentId);
        if (sEntry) {
          sEntry.subjectResults.push({
            subjectId: es.subject.id,
            subjectCode: es.subject.code,
            subjectName: es.subject.name,
            credits: es.subject.credits,
            maxMarks: es.maxMarks,
            passingMarks: es.passingMarks,
            marksObtained: m.marksObtained,
            isAbsent: m.isAbsent,
            isWithheld: m.isWithheld,
          });
        }
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

      return NextResponse.json({
        success: true,
        type: "class",
        examName: exam.name,
        sectionId: sectionId || "ALL",
        totalEligible: classRankings.length > 0 ? classRankings[0].totalEligible : 0,
        rankings: classRankings,
      });
    }

    // 3. Batch-wise ranking (across all sections)
    const batchRankings = calculateBatchWiseRanking(allStudents);

    return NextResponse.json({
      success: true,
      type: "batch",
      examName: exam.name,
      batchName: exam.batch.name,
      totalEligible: batchRankings.length > 0 ? batchRankings[0].totalEligible : 0,
      rankings: batchRankings,
    });
  } catch (error) {
    console.error("Rankings API error:", error);
    return NextResponse.json({ error: "Failed to compute rankings" }, { status: 500 });
  }
}
