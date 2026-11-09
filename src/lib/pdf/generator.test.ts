import { describe, it, expect } from "vitest";
import { generateResultPDF, PDFResultData } from "./generator";

describe("PDF Result Generator", () => {
  it("should generate a valid PDF document with all required verification details", () => {
    const mockData: PDFResultData = {
      collegeName: "Apex Institute of Technology & Engineering",
      collegeCode: "AITE",
      accreditation: "Autonomous Institution | Approved by AICTE",
      studentName: "Aarav Patel",
      rollNo: "23CS001",
      enrollmentNo: "ENR2023001",
      departmentName: "Computer Science & Engineering",
      branchName: "B.Tech Computer Science & Engineering",
      batchName: "2023-2027",
      semesterName: "Semester 5",
      sectionName: "A",
      examName: "Internal Assessment 1",
      academicYear: "2025-2026",
      examDate: "2025-10-10",
      publicationDate: "2025-10-15",
      subjects: [
        {
          code: "CS501",
          name: "Database Management Systems",
          credits: 4,
          maxMarks: 100,
          passingMarks: 40,
          marksObtained: 94,
          isAbsent: false,
          grade: "O",
          gradePoint: 10,
          status: "PASS",
        },
        {
          code: "CS505",
          name: "Web Technologies Lab",
          credits: 3,
          maxMarks: 50,
          passingMarks: 20,
          marksObtained: 47,
          isAbsent: false,
          grade: "O",
          gradePoint: 10,
          status: "PASS",
        },
      ],
      totalObtained: 141,
      totalMax: 150,
      percentage: 94.0,
      overallGrade: "O",
      overallStatus: "PASS",
      sgpa: 10.0,
      classRank: { rank: 1, totalEligible: 5 },
      batchRank: { rank: 1, totalEligible: 10 },
      verificationCode: "AITE-VERIFY-IA1-23CS001-K99",
    };

    const doc = generateResultPDF(mockData);
    expect(doc).toBeDefined();
    const outputBuffer = doc.output("arraybuffer");
    expect(outputBuffer.byteLength).toBeGreaterThan(1000); // Valid PDF binary bytes generated
  });
});

