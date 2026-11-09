import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface PDFResultSubject {
  code: string;
  name: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
  grade: string;
  gradePoint: number;
  status: "PASS" | "FAIL" | "ABSENT";
}

export interface PDFResultData {
  collegeName: string;
  collegeCode: string;
  accreditation?: string;
  studentName: string;
  rollNo: string;
  enrollmentNo: string;
  departmentName: string;
  branchName: string;
  batchName: string;
  semesterName: string;
  sectionName?: string;
  examName: string;
  academicYear: string;
  examDate: string;
  publicationDate: string;
  subjects: PDFResultSubject[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  overallGrade: string;
  overallStatus: "PASS" | "FAIL";
  sgpa?: number;
  classRank?: { rank: number; totalEligible: number };
  batchRank?: { rank: number; totalEligible: number };
  verificationCode: string;
}

export function generateResultPDF(data: PDFResultData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Outer Border & Decorative Frame
  doc.setDrawColor(30, 58, 138); // Navy blue
  doc.setLineWidth(1);
  doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

  doc.setDrawColor(203, 213, 225); // Light slate inner border
  doc.setLineWidth(0.3);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Header Banner
  doc.setFillColor(241, 245, 249);
  doc.rect(10.5, 10.5, pageWidth - 21, 32, "F");

  // Institution Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 58, 138);
  doc.text(data.collegeName.toUpperCase(), pageWidth / 2, 20, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  if (data.accreditation) {
    doc.text(data.accreditation, pageWidth / 2, 25, { align: "center" });
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(`OFFICIAL STATEMENT OF INTERNAL MARKS & PERFORMANCE`, pageWidth / 2, 32, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  doc.text(`${data.examName} | Academic Year: ${data.academicYear}`, pageWidth / 2, 38, { align: "center" });

  // Divider Line
  doc.setDrawColor(30, 58, 138);
  doc.setLineWidth(0.8);
  doc.line(14, 44, pageWidth - 14, 44);

  // Student Details Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 47, pageWidth - 28, 38, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 47, pageWidth - 28, 38, 2, 2, "S");

  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const col1X = 18;
  const col2X = 108;
  let rowY = 54;
  const rowGap = 7;

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Student Name:", col1X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(data.studentName, col1X + 26, rowY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Roll Number:", col2X, rowY);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text(data.rollNo, col2X + 24, rowY);

  // Row 2
  rowY += rowGap;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Enrollment No:", col1X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(data.enrollmentNo, col1X + 26, rowY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Branch & Dept:", col2X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.branchName}`, col2X + 24, rowY);

  // Row 3
  rowY += rowGap;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Semester / Sec:", col1X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.semesterName} (Section ${data.sectionName || "N/A"})`, col1X + 26, rowY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Academic Batch:", col2X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(data.batchName, col2X + 24, rowY);

  // Row 4
  rowY += rowGap;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Examination Date:", col1X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(data.examDate, col1X + 28, rowY);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Publication Date:", col2X, rowY);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(data.publicationDate, col2X + 28, rowY);

  // Subjects Marks Table
  const tableData = data.subjects.map((sub, index) => [
    (index + 1).toString(),
    sub.code,
    sub.name,
    sub.credits.toFixed(1),
    sub.maxMarks.toString(),
    sub.passingMarks.toString(),
    sub.isAbsent ? "ABSENT" : (sub.marksObtained !== null ? sub.marksObtained.toString() : "-"),
    sub.grade,
    sub.status,
  ]);

  autoTable(doc, {
    startY: 90,
    head: [["S.No", "Course Code", "Course Title", "Credits", "Max", "Min", "Obtained", "Grade", "Status"]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 22, fontStyle: "bold" },
      2: { halign: "left", cellWidth: 62 },
      3: { halign: "center", cellWidth: 15 },
      4: { halign: "center", cellWidth: 14 },
      5: { halign: "center", cellWidth: 14 },
      6: { halign: "center", cellWidth: 18, fontStyle: "bold" },
      7: { halign: "center", cellWidth: 14 },
      8: { halign: "center", cellWidth: 15, fontStyle: "bold" },
    },
    didParseCell: (hookData) => {
      if (hookData.section === "body" && hookData.column.index === 8) {
        if (hookData.cell.raw === "FAIL" || hookData.cell.raw === "ABSENT") {
          hookData.cell.styles.textColor = [220, 38, 38]; // Red
        } else {
          hookData.cell.styles.textColor = [22, 101, 52]; // Green
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  // Performance Summary Card
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, finalY, pageWidth - 28, 32, 2, 2, "F");
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, finalY, pageWidth - 28, 32, 2, 2, "S");

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Aggregate Marks:", 18, finalY + 8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`${data.totalObtained} / ${data.totalMax}`, 48, finalY + 8);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Percentage:", 88, finalY + 8);
  doc.setTextColor(30, 58, 138);
  doc.text(`${data.percentage.toFixed(2)}%`, 110, finalY + 8);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Result Status:", 140, finalY + 8);
  if (data.overallStatus === "PASS") {
    doc.setTextColor(22, 101, 52);
    doc.text("PASSED", 164, finalY + 8);
  } else {
    doc.setTextColor(220, 38, 38);
    doc.text("FAILED", 164, finalY + 8);
  }

  // Row 2 of Performance Summary
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("SGPA:", 18, finalY + 16);
  doc.setTextColor(15, 23, 42);
  doc.text(data.sgpa ? data.sgpa.toFixed(2) : "N/A", 48, finalY + 16);

  doc.setTextColor(71, 85, 105);
  doc.text("Class Rank:", 88, finalY + 16);
  doc.setTextColor(15, 23, 42);
  doc.text(
    data.classRank ? `Rank ${data.classRank.rank} of ${data.classRank.totalEligible}` : "N/A",
    110,
    finalY + 16
  );

  doc.setTextColor(71, 85, 105);
  doc.text("Batch Rank:", 140, finalY + 16);
  doc.setTextColor(15, 23, 42);
  doc.text(
    data.batchRank ? `Rank ${data.batchRank.rank} of ${data.batchRank.totalEligible}` : "N/A",
    164,
    finalY + 16
  );

  // Grade Interpretation Legend
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(
    "Grading Scale: O (Outstanding >=90%), A+ (>=80%), A (>=70%), B+ (>=60%), B (>=50%), C (>=45%), P (Pass >=40%), F (Fail <40%)",
    18,
    finalY + 26
  );

  // Footer / Verification Section
  const signY = pageHeight - 34;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, signY - 4, pageWidth - 14, signY - 4);

  // Verification Code
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Result Reference / Verification Code:", 14, signY + 2);
  doc.setFont("courier", "bold");
  doc.setTextColor(30, 58, 138);
  doc.text(data.verificationCode, 14, signY + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Generated securely via College Student Result Portal (SRP).", 14, signY + 12);
  doc.text("This is a computer generated academic report and does not require a physical stamp.", 14, signY + 16);

  // Signatures
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);

  doc.text("Prepared By", 110, signY + 14);
  doc.line(100, signY + 10, 135, signY + 10);

  doc.text("Controller of Examinations", 152, signY + 14);
  doc.line(146, signY + 10, 192, signY + 10);

  return doc;
}

