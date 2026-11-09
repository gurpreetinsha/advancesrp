import Papa from "papaparse";
import * as XLSX from "xlsx";

export function generateCSV(data: Record<string, unknown>[]): string {
  return Papa.unparse(data);
}

export function generateExcelBuffer(sheets: { name: string; data: Record<string, unknown>[] }[]): Buffer {
  const workbook = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.data);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.substring(0, 31));
  }

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export interface CSVImportResult<T> {
  validRows: T[];
  errors: { row: number; rollNo?: string; reason: string }[];
}

export interface RawMarkImportRow {
  rollNo: string;
  marks: string | number;
  isAbsent?: boolean | string;
  remarks?: string;
}

export function parseAndValidateMarksCSV(
  csvContent: string,
  maxMarks: number,
  validRollNumbers: Set<string>
): CSVImportResult<{ rollNo: string; marksObtained: number | null; isAbsent: boolean; remarks?: string }> {
  const parsed = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  const validRows: { rollNo: string; marksObtained: number | null; isAbsent: boolean; remarks?: string }[] = [];
  const errors: { row: number; rollNo?: string; reason: string }[] = [];
  const seenRollNumbers = new Set<string>();

  parsed.data.forEach((row, index) => {
    const rowNum = index + 2; // header is row 1
    // flexible header lookup
    const rollNo = (row.rollNo || row.RollNo || row["Roll No"] || row["Roll Number"] || row["roll_number"] || "").trim();
    const rawMarks = (row.marks || row.Marks || row["Marks Obtained"] || row["marks_obtained"] || "").trim();
    const rawAbsent = (row.isAbsent || row.Absent || row["Is Absent"] || "").trim().toLowerCase();
    const remarks = (row.remarks || row.Remarks || "").trim();

    if (!rollNo) {
      errors.push({ row: rowNum, reason: "Missing Roll Number" });
      return;
    }

    if (!validRollNumbers.has(rollNo)) {
      errors.push({ row: rowNum, rollNo, reason: `Student with roll number '${rollNo}' is not enrolled in this exam cohort` });
      return;
    }

    if (seenRollNumbers.has(rollNo)) {
      errors.push({ row: rowNum, rollNo, reason: `Duplicate entry for roll number '${rollNo}' in import file` });
      return;
    }
    seenRollNumbers.add(rollNo);

    const isAbsent = rawAbsent === "true" || rawAbsent === "yes" || rawAbsent === "1" || rawAbsent === "absent";

    if (isAbsent) {
      validRows.push({
        rollNo,
        marksObtained: null,
        isAbsent: true,
        remarks: remarks || "Absent",
      });
      return;
    }

    if (rawMarks === "" || rawMarks === null) {
      errors.push({ row: rowNum, rollNo, reason: "Marks value cannot be empty (mark as absent if student was absent)" });
      return;
    }

    const marksNum = Number(rawMarks);
    if (isNaN(marksNum)) {
      errors.push({ row: rowNum, rollNo, reason: `Invalid marks value '${rawMarks}'. Must be a valid numeric value` });
      return;
    }

    if (marksNum < 0) {
      errors.push({ row: rowNum, rollNo, reason: `Marks cannot be negative (provided: ${marksNum})` });
      return;
    }

    if (marksNum > maxMarks) {
      errors.push({ row: rowNum, rollNo, reason: `Marks (${marksNum}) exceed maximum permitted marks (${maxMarks})` });
      return;
    }

    validRows.push({
      rollNo,
      marksObtained: marksNum,
      isAbsent: false,
      remarks,
    });
  });

  return { validRows, errors };
}

