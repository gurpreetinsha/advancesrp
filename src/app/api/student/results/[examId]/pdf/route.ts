import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateResultPDF, PDFResultData } from "@/lib/pdf/generator";
import {
  calculateSubjectWiseRanking,
  calculateClassWiseRanking,
  calculateBatchWiseRanking,
  getGradeFromPercentage,
} from "@/lib/ranking/engine";

export async function GET(req: Request, { params }: { params: { examId: string } }) {
  try {
    const session = await getSession();
    if (!session || !session.studentId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const examId = params.examId;

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
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: {
        academicYear: true,
        semester: true,
        batch: true,
        examSubjects: {
          include: {
            subject: true,
            marks: {
              where: { status: "PUBLISHED" },
            },
          },
        },
        studentExamEnrollments: {
          include: {
            student: true,
            section: true,
          },
        },
        publications: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    if (!exam || exam.status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "Result report cannot be generated for an unpublished examination." },
        { status: 400 }
      );
    }

    // Historical student enrollment in this exam
    const myExamEnrollment = exam.studentExamEnrollments.find((e) => e.studentId === student.id);
    if (!myExamEnrollment) {
      return NextResponse.json({ error: "Student is not enrolled in this examination" }, { status: 404 });
    }

    // Gather cohort data for ranking calculation
    const cohortMap = new Map<string, {
      studentId: string;
      rollNo: string;
      studentName: string;
      sectionId?: string;
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
        sectionId: enr.sectionId || undefined,
        isEligible: enr.isEligible,
        subjectResults: [],
      });
    }

    for (const es of exam.examSubjects) {
      for (const m of es.marks) {
        const entry = cohortMap.get(m.studentId);
        if (entry) {
          entry.subjectResults.push({
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

    const allCohort = Array.from(cohortMap.values());
    const batchRanks = calculateBatchWiseRanking(allCohort);
    const myBatchRank = batchRanks.find((r) => r.studentId === student.id);

    const sectionCohort = myExamEnrollment.sectionId
      ? allCohort.filter((s) => s.sectionId === myExamEnrollment.sectionId)
      : allCohort;
    const classRanks = calculateClassWiseRanking(sectionCohort);
    const myClassRank = classRanks.find((r) => r.studentId === student.id);

    // Subject lines
    let totalObtained = 0;
    let totalMax = 0;
    let hasPassedAll = true;

    const subjectsPDF = exam.examSubjects.map((es) => {
      const myMark = es.marks.find((m) => m.studentId === student.id);
      const obtained: number | null =
        myMark?.isAbsent || myMark?.marksObtained === null || myMark?.marksObtained === undefined
          ? null
          : (myMark.marksObtained as number);

      totalMax += es.maxMarks;
      totalObtained += obtained || 0;

      const isPass = obtained !== null && obtained >= es.passingMarks && !myMark?.isAbsent;
      if (!isPass) hasPassedAll = false;

      const pct = obtained !== null && es.maxMarks > 0 ? (obtained / es.maxMarks) * 100 : 0;
      const grade = getGradeFromPercentage(pct);

      return {
        code: es.subject.code,
        name: es.subject.name,
        credits: es.subject.credits,
        maxMarks: es.maxMarks,
        passingMarks: es.passingMarks,
        marksObtained: obtained,
        isAbsent: Boolean(myMark?.isAbsent),
        grade: grade.grade,
        gradePoint: grade.gradePoint,
        status: (isPass ? "PASS" : (myMark?.isAbsent ? "ABSENT" : "FAIL")) as "PASS" | "FAIL" | "ABSENT",
      };
    });

    const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const overallGrade = getGradeFromPercentage(percentage);

    const verificationCode = `AITE-VERIFY-${exam.id.substring(0, 6).toUpperCase()}-${student.rollNo}-${Date.now().toString(36).toUpperCase()}`;

    const pdfData: PDFResultData = {
      collegeName: process.env.COLLEGE_NAME || "Apex Institute of Technology & Engineering",
      collegeCode: process.env.COLLEGE_CODE || "AITE",
      accreditation: "Autonomous Institution | Approved by AICTE & Accredited with Grade A++",
      studentName: `${student.firstName} ${student.lastName}`,
      rollNo: student.rollNo,
      enrollmentNo: student.enrollmentNo,
      departmentName: student.department.name,
      branchName: student.branch.name,
      batchName: exam.batch.name,
      semesterName: exam.semester.name,
      sectionName: myExamEnrollment.section?.name || "A",
      examName: exam.name,
      academicYear: exam.academicYear.name,
      examDate: exam.examDate.toISOString().split("T")[0],
      publicationDate: exam.publishedAt ? exam.publishedAt.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      subjects: subjectsPDF,
      totalObtained: Number(totalObtained.toFixed(2)),
      totalMax: Number(totalMax.toFixed(2)),
      percentage: Number(percentage.toFixed(2)),
      overallGrade: overallGrade.grade,
      overallStatus: hasPassedAll ? "PASS" : "FAIL",
      sgpa: myClassRank?.sgpa,
      classRank: myClassRank ? { rank: myClassRank.rank, totalEligible: myClassRank.totalEligible } : undefined,
      batchRank: myBatchRank ? { rank: myBatchRank.rank, totalEligible: myBatchRank.totalEligible } : undefined,
      verificationCode,
    };

    const doc = generateResultPDF(pdfData);
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${student.rollNo}_${exam.name.replace(/\s+/g, "_")}_Result.pdf"`,
      },
    });
  } catch (error) {
    console.error("Result PDF generation error:", error);
    return NextResponse.json({ error: "Failed to generate result PDF" }, { status: 500 });
  }
}
