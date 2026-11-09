export type UserRole = "ADMIN" | "FACULTY" | "STUDENT";

export type ExamStatus = "DRAFT" | "UNDER_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type MarkStatus = "DRAFT" | "UNDER_REVIEW" | "PUBLISHED";

export interface SessionUser {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  studentId?: string;
  facultyId?: string;
  rollNo?: string;
  enrollmentNo?: string;
  departmentCode?: string;
}

export interface SubjectWiseRankItem {
  studentId: string;
  rollNo: string;
  studentName: string;
  marksObtained: number | null;
  maxMarks: number;
  percentage: number;
  isAbsent: boolean;
  isWithheld: boolean;
  rank: number;
  totalEligible: number;
  diffFromHighest: number;
}

export interface ClassWiseRankItem {
  studentId: string;
  rollNo: string;
  studentName: string;
  sectionName?: string;
  totalObtained: number;
  totalMax: number;
  aggregatePercentage: number;
  sgpa?: number;
  rank: number;
  totalEligible: number;
  hasPassedAll: boolean;
  subjectCount: number;
}

export interface BatchWiseRankItem {
  studentId: string;
  rollNo: string;
  studentName: string;
  sectionName?: string;
  batchName?: string;
  totalObtained: number;
  totalMax: number;
  normalizedPercentage: number;
  sgpa?: number;
  rank: number;
  totalEligible: number;
  hasPassedAll: boolean;
}

export interface GradeResult {
  grade: string;
  gradePoint: number;
  description: string;
}

export interface ExaminationPerformanceSummary {
  examId: string;
  examName: string;
  examDate: string;
  semesterName: string;
  totalStudents: number;
  evaluatedStudents: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
  averagePercentage: number;
  highestPercentage: number;
  lowestPercentage: number;
}

