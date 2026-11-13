import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "FACULTY")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (session.role === "ADMIN") {
      // Admin Dashboard Metrics
      const [
        totalStudents,
        totalFaculty,
        totalDepartments,
        totalBatches,
        totalExams,
        publishedExams,
        draftExams,
        underReviewExams,
        recentAuditLogs,
      ] = await Promise.all([
        prisma.student.count({ where: { isActive: true } }),
        prisma.faculty.count({ where: { isActive: true } }),
        prisma.department.count(),
        prisma.batch.count(),
        prisma.examination.count(),
        prisma.examination.count({ where: { status: "PUBLISHED" } }),
        prisma.examination.count({ where: { status: "DRAFT" } }),
        prisma.examination.count({ where: { status: "UNDER_REVIEW" } }),
        prisma.auditLog.findMany({
          take: 8,
          orderBy: { createdAt: "desc" },
          include: {
            user: {
              select: { email: true, role: true },
            },
          },
        }),
      ]);

      // Calculate overall pass / fail stats across all published marks
      const publishedMarks = await prisma.mark.findMany({
        where: {
          status: "PUBLISHED",
          isAbsent: false,
          marksObtained: { not: null },
        },
        include: {
          examSubject: true,
        },
      });

      let passCount = 0;
      let failCount = 0;
      let totalScoreSum = 0;
      let maxScoreSum = 0;
      let highestPercentage = 0;
      let lowestPercentage = 100;

      for (const m of publishedMarks) {
        if (m.marksObtained !== null) {
          const max = m.examSubject.maxMarks;
          const pct = max > 0 ? (m.marksObtained / max) * 100 : 0;
          totalScoreSum += m.marksObtained;
          maxScoreSum += max;

          if (pct > highestPercentage) highestPercentage = pct;
          if (pct < lowestPercentage) lowestPercentage = pct;

          if (m.marksObtained >= m.examSubject.passingMarks) {
            passCount++;
          } else {
            failCount++;
          }
        }
      }

      const totalEvaluations = passCount + failCount;
      const overallPassPercentage = totalEvaluations > 0 ? (passCount / totalEvaluations) * 100 : 0;
      const averagePercentage = maxScoreSum > 0 ? (totalScoreSum / maxScoreSum) * 100 : 0;

      // Subject-wise performance summary
      const subjectsWithMarks = await prisma.subject.findMany({
        take: 6,
        include: {
          examSubjects: {
            include: {
              marks: {
                where: { status: "PUBLISHED", isAbsent: false, marksObtained: { not: null } },
              },
            },
          },
        },
      });

      const subjectAnalytics = subjectsWithMarks.map((sub) => {
        let subObtained = 0;
        let subMax = 0;
        let count = 0;
        for (const es of sub.examSubjects) {
          for (const m of es.marks) {
            if (m.marksObtained !== null) {
              subObtained += m.marksObtained;
              subMax += es.maxMarks;
              count++;
            }
          }
        }
        const avg = subMax > 0 ? (subObtained / subMax) * 100 : 0;
        return {
          subjectCode: sub.code,
          subjectName: sub.name,
          evaluatedCount: count,
          averageScore: Number(avg.toFixed(1)),
        };
      });

      return NextResponse.json({
        success: true,
        role: "ADMIN",
        metrics: {
          totalStudents,
          totalFaculty,
          totalDepartments,
          totalBatches,
          totalExams,
          publishedExams,
          draftExams,
          underReviewExams,
          passCount,
          failCount,
          overallPassPercentage: Number(overallPassPercentage.toFixed(1)),
          averagePercentage: Number(averagePercentage.toFixed(1)),
          highestPercentage: Number(highestPercentage.toFixed(1)),
          lowestPercentage: Number(lowestPercentage.toFixed(1)),
        },
        recentAuditLogs,
        subjectAnalytics,
      });
    }

    // Faculty Dashboard Metrics
    if (session.role === "FACULTY" && session.facultyId) {
      const assignments = await prisma.facultyAssignment.findMany({
        where: { facultyId: session.facultyId, canEnterMarks: true },
        include: {
          subject: true,
          semester: true,
          section: true,
        },
      });

      const assignedSubjectIds = Array.from(new Set(assignments.map((a) => a.subjectId)));
      const assignedAcademicYearIds = Array.from(new Set(assignments.map((a) => a.academicYearId)));
      const assignedSemesterIds = Array.from(new Set(assignments.map((a) => a.semesterId)));

      const activeExams = await prisma.examination.findMany({
        where: {
          academicYearId: { in: assignedAcademicYearIds },
          semesterId: { in: assignedSemesterIds },
          examSubjects: {
            some: {
              subjectId: { in: assignedSubjectIds },
            },
          },
        },
        include: {
          semester: true,
          batch: true,
          examSubjects: {
            where: { subjectId: { in: assignedSubjectIds } },
            include: {
              subject: true,
              _count: {
                select: { marks: true },
              },
            },
          },
          _count: {
            select: { studentExamEnrollments: true },
          },
        },
        orderBy: { examDate: "desc" },
      });

      return NextResponse.json({
        success: true,
        role: "FACULTY",
        assignments,
        activeExams,
      });
    }

    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  } catch (error) {
    console.error("Analytics error:", error);
    return NextResponse.json({ error: "Failed to load dashboard metrics" }, { status: 500 });
  }
}
