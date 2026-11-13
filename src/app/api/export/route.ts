import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateCSV, generateExcelBuffer } from "@/lib/export/helpers";
import {
  calculateSubjectWiseRanking,
  calculateClassWiseRanking,
  calculateBatchWiseRanking,
} from "@/lib/ranking/engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      // Exports contain bulk student identifiers and marks. Until a fully
      // scoped faculty export workflow is available, keep bulk export admin-only.
      return NextResponse.json({ error: "Only administrators may export bulk student or examination data." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "csv"; // "csv" | "excel"
    const type = searchParams.get("type"); // "ranking" | "marks" | "students"
    const examId = searchParams.get("examId");
    const subjectId = searchParams.get("subjectId");
    const rankingType = searchParams.get("rankingType") || "batch"; // "subject" | "class" | "batch"

    let exportRows: Record<string, unknown>[] = [];
    let filename = `export-${Date.now()}`;

    // 1. Export Rankings
    if (type === "ranking" && examId) {
      const exam = await prisma.examination.findUnique({
        where: { id: examId },
        include: {
          batch: true,
          semester: true,
          examSubjects: {
            include: {
              subject: true,
              marks: {
                include: { student: true },
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
      if (exam.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Ranking exports are available only for published examinations." }, { status: 409 });
      }

      if (rankingType === "subject" && subjectId) {
        const examSub = exam.examSubjects.find((es) => es.subjectId === subjectId);
        if (!examSub) return NextResponse.json({ error: "Subject not found in exam" }, { status: 404 });

        const marksByStudent = new Map(examSub.marks.map((mark) => [mark.studentId, mark]));
        const rawMarks = exam.studentExamEnrollments.map((enrollment) => {
          const mark = marksByStudent.get(enrollment.studentId);
          return {
            studentId: enrollment.studentId,
            rollNo: enrollment.student.rollNo,
            studentName: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
            marksObtained: mark?.marksObtained ?? null,
            maxMarks: examSub.maxMarks,
            passingMarks: examSub.passingMarks,
            isAbsent: mark?.isAbsent ?? false,
            isWithheld: mark?.isWithheld ?? false,
            isEligible: enrollment.isEligible,
          };
        });

        const ranks = calculateSubjectWiseRanking(rawMarks);
        exportRows = ranks.map((r) => ({
          Rank: r.rank,
          "Roll No": r.rollNo,
          "Student Name": r.studentName,
          "Marks Obtained": r.isAbsent ? "ABSENT" : r.marksObtained,
          "Max Marks": r.maxMarks,
          "Percentage (%)": r.percentage,
          "Diff From Highest": r.diffFromHighest,
          "Total In Cohort": r.totalEligible,
        }));
        filename = `${exam.name.replace(/\s+/g, "_")}_${examSub.subject.code}_Subject_Rankings`;
      } else {
        // Class or Batch ranking
        const cohortMap = new Map<string, {
          studentId: string;
          rollNo: string;
          studentName: string;
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
          cohortMap.set(enr.studentId, {
            studentId: enr.student.id,
            rollNo: enr.student.rollNo,
            studentName: `${enr.student.firstName} ${enr.student.lastName}`,
            sectionName: enr.section?.name || "A",
            batchName: exam.batch.name,
            isEligible: enr.isEligible,
            subjectResults: [],
          });
        }

        for (const es of exam.examSubjects) {
          const marksByStudent = new Map(es.marks.map((mark) => [mark.studentId, mark]));
          for (const enrollment of exam.studentExamEnrollments) {
            const entry = cohortMap.get(enrollment.studentId);
            if (!entry) continue;
            const mark = marksByStudent.get(enrollment.studentId);
            entry.subjectResults.push({
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

        const studentsList = Array.from(cohortMap.values());

        if (rankingType === "class") {
          const classRanks = calculateClassWiseRanking(studentsList);
          exportRows = classRanks.map((r) => ({
            Rank: r.rank,
            "Roll No": r.rollNo,
            "Student Name": r.studentName,
            Section: r.sectionName || "A",
            "Total Obtained": r.totalObtained,
            "Total Max": r.totalMax,
            "Aggregate (%)": r.aggregatePercentage,
            SGPA: r.sgpa || "N/A",
            Status: r.hasPassedAll ? "PASS" : "FAIL",
            "Total Eligible": r.totalEligible,
          }));
          filename = `${exam.name.replace(/\s+/g, "_")}_Class_Rankings`;
        } else {
          const batchRanks = calculateBatchWiseRanking(studentsList);
          exportRows = batchRanks.map((r) => ({
            Rank: r.rank,
            "Roll No": r.rollNo,
            "Student Name": r.studentName,
            Section: r.sectionName || "A",
            Batch: r.batchName,
            "Total Obtained": r.totalObtained,
            "Total Max": r.totalMax,
            "Normalized (%)": r.normalizedPercentage,
            SGPA: r.sgpa || "N/A",
            Status: r.hasPassedAll ? "PASS" : "FAIL",
            "Total Eligible": r.totalEligible,
          }));
          filename = `${exam.name.replace(/\s+/g, "_")}_Batch_Rankings`;
        }
      }
    } else if (type === "students") {
      const students = await prisma.student.findMany({
        where: { isActive: true },
        include: {
          department: true,
          branch: true,
          batch: true,
          currentSemester: true,
          currentSection: true,
        },
        orderBy: { rollNo: "asc" },
      });

      exportRows = students.map((s) => ({
        "Roll No": s.rollNo,
        "Enrollment No": s.enrollmentNo,
        "First Name": s.firstName,
        "Last Name": s.lastName,
        Email: s.email,
        Department: s.department.code,
        Branch: s.branch.code,
        Batch: s.batch.name,
        Semester: s.currentSemester.name,
        Section: s.currentSection?.name || "N/A",
      }));
      filename = `Active_Students_Roster`;
    }

    if (exportRows.length === 0) {
      return NextResponse.json({ error: "No data available for export" }, { status: 400 });
    }

    if (format === "excel") {
      const buffer = generateExcelBuffer([{ name: "Export", data: exportRows }]);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
    }

    // Default CSV
    const csvData = generateCSV(exportRows);
    return new NextResponse(csvData, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}.csv"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to generate export file" }, { status: 500 });
  }
}
