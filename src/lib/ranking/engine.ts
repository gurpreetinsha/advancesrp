import {
  SubjectWiseRankItem,
  ClassWiseRankItem,
  BatchWiseRankItem,
  GradeResult,
} from "../types";

/**
 * Default standard grade scale lookup
 */
export function getGradeFromPercentage(percentage: number): GradeResult {
  if (percentage >= 90) return { grade: "O", gradePoint: 10, description: "Outstanding" };
  if (percentage >= 80) return { grade: "A+", gradePoint: 9, description: "Excellent" };
  if (percentage >= 70) return { grade: "A", gradePoint: 8, description: "Very Good" };
  if (percentage >= 60) return { grade: "B+", gradePoint: 7, description: "Good" };
  if (percentage >= 50) return { grade: "B", gradePoint: 6, description: "Above Average" };
  if (percentage >= 45) return { grade: "C", gradePoint: 5, description: "Average" };
  if (percentage >= 40) return { grade: "P", gradePoint: 4, description: "Pass" };
  return { grade: "F", gradePoint: 0, description: "Fail" };
}

/**
 * Assigns competition ranking (1, 2, 2, 4):
 * Items must be pre-sorted descending by score.
 * If two items have equal scores, they receive the same rank.
 * The next item receives rank equal to its 1-based index (e.g. index 3 gets rank 4).
 */
export function assignCompetitionRanks<T>(
  items: T[],
  getScore: (item: T) => number,
  tieBreaker: (a: T, b: T) => number
): Array<T & { rank: number }> {
  if (items.length === 0) return [];

  // Sort descending by score; on tie use deterministic tieBreaker
  const sorted = [...items].sort((a, b) => {
    const scoreDiff = Number(getScore(b).toFixed(4)) - Number(getScore(a).toFixed(4));
    if (scoreDiff !== 0) return scoreDiff;
    return tieBreaker(a, b);
  });

  const ranked: Array<T & { rank: number }> = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      ranked.push({ ...sorted[i], rank: 1 });
    } else {
      const prevScore = getScore(sorted[i - 1]);
      const currScore = getScore(sorted[i]);

      // If scores are equal within float tolerance, assign same rank as previous
      if (Number(prevScore.toFixed(4)) === Number(currScore.toFixed(4))) {
        ranked.push({ ...sorted[i], rank: currentRank });
      } else {
        currentRank = i + 1; // Competition rank skips ties!
        ranked.push({ ...sorted[i], rank: currentRank });
      }
    }
  }

  return ranked;
}

export interface RawSubjectMark {
  studentId: string;
  rollNo: string;
  studentName: string;
  marksObtained: number | null;
  maxMarks: number;
  passingMarks: number;
  isAbsent: boolean;
  isWithheld: boolean;
  isEligible: boolean;
}

/**
 * Calculate subject-wise rankings for a cohort
 */
export function calculateSubjectWiseRanking(
  marks: RawSubjectMark[]
): SubjectWiseRankItem[] {
  // Filter eligible and non-withheld students
  const totalEligible = marks.filter((m) => m.isEligible).length;
  const eligibleMarks = marks.filter((m) => m.isEligible && !m.isWithheld);

  if (totalEligible === 0) return [];

  // Find highest marks among eligible students who are present
  const presentMarks = eligibleMarks.filter((m) => !m.isAbsent && m.marksObtained !== null);
  const highestScore = presentMarks.length > 0
    ? Math.max(...presentMarks.map((m) => m.marksObtained!))
    : 0;

  // Prepare items with percentage
  const prepared = eligibleMarks.map((m) => {
    const actualObtained = m.isAbsent || m.marksObtained === null ? 0 : m.marksObtained;
    const percentage = m.maxMarks > 0 ? (actualObtained / m.maxMarks) * 100 : 0;
    return {
      studentId: m.studentId,
      rollNo: m.rollNo,
      studentName: m.studentName,
      marksObtained: m.isAbsent ? null : m.marksObtained,
      maxMarks: m.maxMarks,
      percentage: Number(percentage.toFixed(2)),
      isAbsent: m.isAbsent,
      isWithheld: m.isWithheld,
      totalEligible,
      diffFromHighest: Number(Math.max(0, highestScore - actualObtained).toFixed(2)),
      effectiveScore: m.isAbsent ? -1 : actualObtained, // Absent ranks lower
    };
  });

  const ranked = assignCompetitionRanks(
    prepared,
    (item) => item.effectiveScore,
    (a, b) => a.rollNo.localeCompare(b.rollNo)
  );

  return ranked.map(({ effectiveScore, ...rest }) => rest);
}

export interface RawStudentSubjectResult {
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  credits: number;
  maxMarks: number;
  passingMarks: number;
  marksObtained: number | null;
  isAbsent: boolean;
  isWithheld: boolean;
}

export interface RawStudentAggregate {
  studentId: string;
  rollNo: string;
  studentName: string;
  sectionName?: string;
  batchName?: string;
  isEligible: boolean;
  subjectResults: RawStudentSubjectResult[];
}

/**
 * Calculate class-wise ranking (within a section / class)
 */
export function calculateClassWiseRanking(
  students: RawStudentAggregate[]
): ClassWiseRankItem[] {
  const eligibleStudents = students.filter((s) => s.isEligible);
  const totalEligible = eligibleStudents.length;

  if (totalEligible === 0) return [];

  const aggregates = eligibleStudents.map((student) => {
    let totalObtained = 0;
    let totalMax = 0;
    let hasPassedAll = student.subjectResults.some((sub) => !sub.isWithheld);
    let totalWeightedPoints = 0;
    let totalCredits = 0;

    for (const sub of student.subjectResults) {
      if (sub.isWithheld) continue;
      totalMax += sub.maxMarks;
      const obtained = sub.isAbsent || sub.marksObtained === null ? 0 : sub.marksObtained;
      totalObtained += obtained;

      if (obtained < sub.passingMarks || sub.isAbsent) {
        hasPassedAll = false;
      }

      const subPercentage = sub.maxMarks > 0 ? (obtained / sub.maxMarks) * 100 : 0;
      const gradeRes = getGradeFromPercentage(subPercentage);
      totalWeightedPoints += gradeRes.gradePoint * (sub.credits || 1);
      totalCredits += sub.credits || 1;
    }

    const aggregatePercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const sgpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : undefined;

    return {
      studentId: student.studentId,
      rollNo: student.rollNo,
      studentName: student.studentName,
      sectionName: student.sectionName,
      totalObtained: Number(totalObtained.toFixed(2)),
      totalMax: Number(totalMax.toFixed(2)),
      aggregatePercentage: Number(aggregatePercentage.toFixed(2)),
      sgpa: sgpa !== undefined ? Number(sgpa.toFixed(2)) : undefined,
      totalEligible,
      hasPassedAll,
      subjectCount: student.subjectResults.length,
    };
  });

  return assignCompetitionRanks(
    aggregates,
    (item) => item.aggregatePercentage,
    (a, b) => a.rollNo.localeCompare(b.rollNo)
  );
}

/**
 * Calculate batch-wise ranking (across all sections in a batch)
 */
export function calculateBatchWiseRanking(
  students: RawStudentAggregate[]
): BatchWiseRankItem[] {
  const eligibleStudents = students.filter((s) => s.isEligible);
  const totalEligible = eligibleStudents.length;

  if (totalEligible === 0) return [];

  const aggregates = eligibleStudents.map((student) => {
    let totalObtained = 0;
    let totalMax = 0;
    let hasPassedAll = student.subjectResults.some((sub) => !sub.isWithheld);
    let totalWeightedPoints = 0;
    let totalCredits = 0;

    for (const sub of student.subjectResults) {
      if (sub.isWithheld) continue;
      totalMax += sub.maxMarks;
      const obtained = sub.isAbsent || sub.marksObtained === null ? 0 : sub.marksObtained;
      totalObtained += obtained;

      if (obtained < sub.passingMarks || sub.isAbsent) {
        hasPassedAll = false;
      }

      const subPercentage = sub.maxMarks > 0 ? (obtained / sub.maxMarks) * 100 : 0;
      const gradeRes = getGradeFromPercentage(subPercentage);
      totalWeightedPoints += gradeRes.gradePoint * (sub.credits || 1);
      totalCredits += sub.credits || 1;
    }

    const normalizedPercentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    const sgpa = totalCredits > 0 ? totalWeightedPoints / totalCredits : undefined;

    return {
      studentId: student.studentId,
      rollNo: student.rollNo,
      studentName: student.studentName,
      sectionName: student.sectionName,
      batchName: student.batchName,
      totalObtained: Number(totalObtained.toFixed(2)),
      totalMax: Number(totalMax.toFixed(2)),
      normalizedPercentage: Number(normalizedPercentage.toFixed(2)),
      sgpa: sgpa ? Number(sgpa.toFixed(2)) : undefined,
      totalEligible,
      hasPassedAll,
    };
  });

  return assignCompetitionRanks(
    aggregates,
    (item) => item.normalizedPercentage,
    (a, b) => a.rollNo.localeCompare(b.rollNo)
  );
}

