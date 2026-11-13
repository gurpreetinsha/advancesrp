import { describe, it, expect } from "vitest";
import {
  assignCompetitionRanks,
  calculateSubjectWiseRanking,
  calculateClassWiseRanking,
  calculateBatchWiseRanking,
  getGradeFromPercentage,
  RawSubjectMark,
  RawStudentAggregate,
} from "./engine";

describe("Ranking Engine", () => {
  describe("Competition Ranking (1, 2, 2, 4)", () => {
    it("should correctly assign standard competition ranks with ties", () => {
      const items = [
        { id: "A", score: 95 },
        { id: "B", score: 90 },
        { id: "C", score: 90 },
        { id: "D", score: 85 },
        { id: "E", score: 80 },
        { id: "F", score: 80 },
        { id: "G", score: 80 },
        { id: "H", score: 70 },
      ];

      const ranked = assignCompetitionRanks(
        items,
        (item) => item.score,
        (a, b) => a.id.localeCompare(b.id)
      );

      expect(ranked.find((r) => r.id === "A")?.rank).toBe(1);
      expect(ranked.find((r) => r.id === "B")?.rank).toBe(2);
      expect(ranked.find((r) => r.id === "C")?.rank).toBe(2);
      // After two ties at rank 2, the next rank MUST be 4
      expect(ranked.find((r) => r.id === "D")?.rank).toBe(4);
      // Three ties at rank 5
      expect(ranked.find((r) => r.id === "E")?.rank).toBe(5);
      expect(ranked.find((r) => r.id === "F")?.rank).toBe(5);
      expect(ranked.find((r) => r.id === "G")?.rank).toBe(5);
      // After three ties at 5, next must be 8
      expect(ranked.find((r) => r.id === "H")?.rank).toBe(8);
    });

    it("should deterministically break ties for display without changing rank", () => {
      const items = [
        { id: "STU-02", score: 88 },
        { id: "STU-01", score: 88 },
      ];

      const ranked = assignCompetitionRanks(
        items,
        (item) => item.score,
        (a, b) => a.id.localeCompare(b.id)
      );

      expect(ranked[0].id).toBe("STU-01");
      expect(ranked[0].rank).toBe(1);
      expect(ranked[1].id).toBe("STU-02");
      expect(ranked[1].rank).toBe(1);
    });
  });

  describe("Subject-wise Ranking", () => {
    it("should compute subject rankings, percentage, and difference from highest", () => {
      const marks: RawSubjectMark[] = [
        {
          studentId: "s1",
          rollNo: "CS101",
          studentName: "Alice",
          marksObtained: 95,
          maxMarks: 100,
          passingMarks: 40,
          isAbsent: false,
          isWithheld: false,
          isEligible: true,
        },
        {
          studentId: "s2",
          rollNo: "CS102",
          studentName: "Bob",
          marksObtained: 85,
          maxMarks: 100,
          passingMarks: 40,
          isAbsent: false,
          isWithheld: false,
          isEligible: true,
        },
        {
          studentId: "s3",
          rollNo: "CS103",
          studentName: "Charlie",
          marksObtained: null,
          maxMarks: 100,
          passingMarks: 40,
          isAbsent: true,
          isWithheld: false,
          isEligible: true,
        },
        {
          studentId: "s4",
          rollNo: "CS104",
          studentName: "David",
          marksObtained: 90,
          maxMarks: 100,
          passingMarks: 40,
          isAbsent: false,
          isWithheld: false,
          isEligible: false, // Ineligible should be excluded
        },
      ];

      const results = calculateSubjectWiseRanking(marks);

      expect(results.length).toBe(3); // Ineligible excluded
      expect(results[0].rollNo).toBe("CS101");
      expect(results[0].rank).toBe(1);
      expect(results[0].diffFromHighest).toBe(0);

      expect(results[1].rollNo).toBe("CS102");
      expect(results[1].rank).toBe(2);
      expect(results[1].diffFromHighest).toBe(10);

      // Absent student Charlie should rank last among eligible
      const charlie = results.find((r) => r.rollNo === "CS103");
      expect(charlie?.isAbsent).toBe(true);
      expect(charlie?.rank).toBe(3);
    });
  });

  describe("Class-wise & Batch-wise Ranking with Unequal Max Marks", () => {
    it("should correctly normalize aggregate scores across subjects and sections", () => {
      const students: RawStudentAggregate[] = [
        {
          studentId: "s1",
          rollNo: "CS01",
          studentName: "Alice",
          sectionName: "A",
          batchName: "2023-2027",
          isEligible: true,
          subjectResults: [
            {
              subjectId: "sub1",
              subjectCode: "CS501",
              subjectName: "DBMS",
              credits: 4,
              maxMarks: 100,
              passingMarks: 40,
              marksObtained: 90,
              isAbsent: false,
              isWithheld: false,
            },
            {
              subjectId: "sub2",
              subjectCode: "CS502",
              subjectName: "OS",
              credits: 4,
              maxMarks: 50,
              passingMarks: 20,
              marksObtained: 45,
              isAbsent: false,
              isWithheld: false,
            },
          ],
        },
        {
          studentId: "s2",
          rollNo: "CS02",
          studentName: "Bob",
          sectionName: "B",
          batchName: "2023-2027",
          isEligible: true,
          subjectResults: [
            {
              subjectId: "sub1",
              subjectCode: "CS501",
              subjectName: "DBMS",
              credits: 4,
              maxMarks: 100,
              passingMarks: 40,
              marksObtained: 70,
              isAbsent: false,
              isWithheld: false,
            },
            {
              subjectId: "sub2",
              subjectCode: "CS502",
              subjectName: "OS",
              credits: 4,
              maxMarks: 50,
              passingMarks: 20,
              marksObtained: 35,
              isAbsent: false,
              isWithheld: false,
            },
          ],
        },
      ];

      // Alice total: 90 + 45 = 135 / 150 = 90.0%
      // Bob total: 70 + 35 = 105 / 150 = 70.0%
      const batchRanks = calculateBatchWiseRanking(students);
      expect(batchRanks.length).toBe(2);
      expect(batchRanks[0].studentName).toBe("Alice");
      expect(batchRanks[0].normalizedPercentage).toBe(90);
      expect(batchRanks[0].rank).toBe(1);
      expect(batchRanks[1].studentName).toBe("Bob");
      expect(batchRanks[1].normalizedPercentage).toBe(70);
      expect(batchRanks[1].rank).toBe(2);
    });
  });

  describe("Grade Scale calculation", () => {
    it("should return correct grades and grade points according to standard 10-point scale", () => {
      expect(getGradeFromPercentage(95)).toEqual({ grade: "O", gradePoint: 10, description: "Outstanding" });
      expect(getGradeFromPercentage(85)).toEqual({ grade: "A+", gradePoint: 9, description: "Excellent" });
      expect(getGradeFromPercentage(75)).toEqual({ grade: "A", gradePoint: 8, description: "Very Good" });
      expect(getGradeFromPercentage(65)).toEqual({ grade: "B+", gradePoint: 7, description: "Good" });
      expect(getGradeFromPercentage(55)).toEqual({ grade: "B", gradePoint: 6, description: "Above Average" });
      expect(getGradeFromPercentage(47)).toEqual({ grade: "C", gradePoint: 5, description: "Average" });
      expect(getGradeFromPercentage(41)).toEqual({ grade: "P", gradePoint: 4, description: "Pass" });
      expect(getGradeFromPercentage(35)).toEqual({ grade: "F", gradePoint: 0, description: "Fail" });
    });
  });

  describe("Incomplete and withheld records", () => {
    it("must not mark an all-withheld student as passed", () => {
      const ranks = calculateClassWiseRanking([{
        studentId: "s1", rollNo: "CS01", studentName: "Student", isEligible: true,
        subjectResults: [{
          subjectId: "sub1", subjectCode: "CS501", subjectName: "DBMS",
          credits: 3, maxMarks: 100, passingMarks: 40,
          marksObtained: null, isAbsent: false, isWithheld: true,
        }],
      }]);
      expect(ranks).toHaveLength(0);
    });

    it("must preserve a legitimate zero SGPA", () => {
      const ranks = calculateBatchWiseRanking([{
        studentId: "s1", rollNo: "CS01", studentName: "Student", isEligible: true,
        subjectResults: [{
          subjectId: "sub1", subjectCode: "CS501", subjectName: "DBMS",
          credits: 3, maxMarks: 100, passingMarks: 40,
          marksObtained: 0, isAbsent: false, isWithheld: false,
        }],
      }]);
      expect(ranks[0].hasPassedAll).toBe(false);
      expect(ranks[0].sgpa).toBe(0);
    });
  });

});

