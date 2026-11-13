import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  calculateSubjectWiseRanking,
  calculateClassWiseRanking,
  calculateBatchWiseRanking,
  getGradeFromPercentage,
} from "@/lib/ranking/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT" || !session.studentId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const requestedExamId = searchParams.get("examId");

    const student = await prisma.student.findUnique({
      where: { id: session.studentId },
      include: {
        department: true,
        branch: true,
        batch: true,
        currentSemester: true,
        currentSection: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const gradeScale = await prisma.gradeScale.findMany({ orderBy: { minPercentage: "desc" } });

    // Fetch published examinations the student is enrolled in
    const examEnrollments = await prisma.studentExamEnrollment.findMany({
      where: {
        studentId: student.id,
        examination: {
          status: "PUBLISHED",
        },
      },
      include: {
        examination: {
          include: {
            academicYear: true,
            semester: true,
            batch: true,
            examSubjects: {
              include: {
                subject: true,
                marks: {
                  where: { status: "PUBLISHED" },
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
                batch: true,
              },
            },
          },
        },
        section: true,
        semester: true,
        batch: true,
      },
      orderBy: {
        examination: {
          examDate: "desc",
        },
      },
    });

    if (examEnrollments.length === 0) {
      return NextResponse.json({
        success: true,
        publishedResults: [],
        latestResult: null,
        performanceTrends: [],
      });
    }

    // Process each published exam to compute exact ranks and statistics
    const processedResults = examEnrollments.map((enrollment) => {
      const exam = enrollment.examination;
      const historicalSectionId = enrollment.sectionId;
      const historicalBatchId = enrollment.batchId;

      // 1. Prepare raw aggregates for all students in this exam to compute batch & class ranks
      const cohortStudentsMap = new Map<string, {
        studentId: string;
        rollNo: string;
        studentName: string;
        sectionId?: string;
        sectionName?: string;
        batchId: string;
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
          batchId: enr.batchId,
          batchName: enr.batch?.name || undefined,
          isEligible: enr.isEligible,
          subjectResults: [],
        });
      }

      // Build a complete subject matrix from the historical exam enrollment snapshot.
      // Missing marks are represented explicitly rather than silently omitted from aggregates.
      for (const es of exam.examSubjects) {
        const marksByStudent = new Map(es.marks.map((mark) => [mark.studentId, mark]));
        for (const enr of exam.studentExamEnrollments) {
          const sEntry = cohortStudentsMap.get(enr.studentId);
          if (!sEntry) continue;
          const mark = marksByStudent.get(enr.studentId);
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

      const allCohortStudents = Array.from(cohortStudentsMap.values());

      // 2. Compute Batch-wide Ranking
      const batchRankings = calculateBatchWiseRanking(allCohortStudents, gradeScale);
      const studentBatchRank = batchRankings.find((r) => r.studentId === student.id);

      // 3. Compute Class-wide Ranking (students within same historical section)
      const sectionCohortStudents = historicalSectionId
        ? allCohortStudents.filter((s) => s.sectionId === historicalSectionId)
        : allCohortStudents;
      const classRankings = calculateClassWiseRanking(sectionCohortStudents, gradeScale);
      const studentClassRank = classRankings.find((r) => r.studentId === student.id);

      // 4. Compute Subject-wise Ranking for each subject in this exam
      const subjectResultsForStudent = exam.examSubjects.map((es) => {
        // Collect all student marks in this subject
        const marksByStudent = new Map(es.marks.map((mark) => [mark.studentId, mark]));
        const rawSubjectMarks = exam.studentExamEnrollments.map((enr) => {
          const sEnr = cohortStudentsMap.get(enr.studentId);
          const mark = marksByStudent.get(enr.studentId);
          return {
            studentId: enr.studentId,
            rollNo: sEnr?.rollNo || "",
            studentName: sEnr?.studentName || "",
            marksObtained: mark?.marksObtained ?? null,
            maxMarks: es.maxMarks,
            passingMarks: es.passingMarks,
            isAbsent: mark?.isAbsent ?? false,
            isWithheld: mark?.isWithheld ?? false,
            isEligible: enr.isEligible,
          };
        });

        // Subject rankings
        const subjectRanks = calculateSubjectWiseRanking(rawSubjectMarks);
        const mySubRank = subjectRanks.find((r) => r.studentId === student.id);

        const myMarkRecord = es.marks.find((m) => m.studentId === student.id);
        const obtained: number | null =
          myMarkRecord?.isAbsent || myMarkRecord?.marksObtained === null || myMarkRecord?.marksObtained === undefined
            ? null
            : (myMarkRecord.marksObtained as number);

        const percentage = obtained !== null && es.maxMarks > 0 ? (obtained / es.maxMarks) * 100 : 0;
        const gradeInfo = getGradeFromPercentage(percentage, gradeScale);

        // Class average for comparison chart
        const validMarks = es.marks.filter((m) => !m.isAbsent && m.marksObtained !== null).map((m) => m.marksObtained!);
        const classAvg = validMarks.length > 0
          ? Number((validMarks.reduce((a, b) => a + b, 0) / validMarks.length).toFixed(1))
          : 0;

        const isPass = obtained !== null && obtained >= es.passingMarks && !myMarkRecord?.isAbsent;

        return {
          subjectId: es.subject.id,
          subjectCode: es.subject.code,
          subjectName: es.subject.name,
          credits: es.subject.credits,
          type: es.subject.type,
          maxMarks: es.maxMarks,
          passingMarks: es.passingMarks,
          marksObtained: obtained,
          isAbsent: myMarkRecord?.isAbsent || false,
          isWithheld: myMarkRecord?.isWithheld || false,
          percentage: Number(percentage.toFixed(2)),
          grade: gradeInfo.grade,
          gradePoint: gradeInfo.gradePoint,
          gradeDescription: gradeInfo.description,
          status: isPass ? "PASS" : (myMarkRecord?.isAbsent ? "ABSENT" : "FAIL"),
          subjectRank: mySubRank ? mySubRank.rank : null,
          totalInSubject: mySubRank ? mySubRank.totalEligible : 0,
          diffFromHighest: mySubRank ? mySubRank.diffFromHighest : 0,
          classAverage: classAvg,
        };
      });

      // Overall totals for this exam
      let totalObtained = 0;
      let totalMax = 0;
      let hasPassedAll = subjectResultsForStudent.length > 0 && subjectResultsForStudent.every((subject) => !subject.isWithheld);

      for (const sr of subjectResultsForStudent) {
        if (sr.isWithheld) continue;
        totalMax += sr.maxMarks;
        totalObtained += sr.marksObtained || 0;
        if (sr.status !== "PASS") {
          hasPassedAll = false;
        }
      }

      const overallPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
      const overallGrade = getGradeFromPercentage(overallPercentage);

      return {
        examId: exam.id,
        examName: exam.name,
        examDate: exam.examDate.toISOString().split("T")[0],
        academicYear: exam.academicYear.name,
        semesterName: enrollment.semester.name,
        sectionName: enrollment.section?.name || "A",
        batchName: enrollment.batch.name,
        subjects: subjectResultsForStudent,
        totalObtained: Number(totalObtained.toFixed(2)),
        totalMax: Number(totalMax.toFixed(2)),
        percentage: Number(overallPercentage.toFixed(2)),
        sgpa: studentClassRank?.sgpa,
        overallGrade: overallGrade.grade,
        overallStatus: hasPassedAll ? "PASS" : "FAIL",
        classRank: studentClassRank
          ? { rank: studentClassRank.rank, totalEligible: studentClassRank.totalEligible }
          : null,
        batchRank: studentBatchRank
          ? { rank: studentBatchRank.rank, totalEligible: studentBatchRank.totalEligible }
          : null,
      };
    });

    // Determine selected result (or latest)
    const selectedResult = requestedExamId
      ? processedResults.find((r) => r.examId === requestedExamId)
      : processedResults[0];

    if (requestedExamId && !selectedResult) {
      return NextResponse.json({ error: "No published result found for this examination." }, { status: 404 });
    }

    // Performance trend across published exams (sorted chronologically)
    const performanceTrends = [...processedResults]
      .reverse()
      .map((r) => ({
        examName: r.examName,
        percentage: r.percentage,
        sgpa: r.sgpa || 0,
        totalObtained: r.totalObtained,
        totalMax: r.totalMax,
      }));

    return NextResponse.json({
      success: true,
      student,
      results: processedResults,
      selectedResult,
      performanceTrends,
    });
  } catch (error) {
    console.error("Student results API error:", error);
    return NextResponse.json({ error: "Failed to load examination results" }, { status: 500 });
  }
}
