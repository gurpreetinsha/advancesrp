import { describe, it, expect } from "vitest";
import { parseAndValidateMarksCSV, generateCSV } from "./helpers";

describe("CSV Import and Export Engine", () => {
  it("should validate CSV marks and flag out-of-bound marks, invalid numbers, and duplicates", () => {
    const csvContent = `Roll No,Marks Obtained,Is Absent
23CS001,85,no
23CS002,105,no
23CS003,-5,no
23CS001,70,no
23CS999,60,no
23CS004,,yes
23CS005,abc,no
`;

    const validRolls = new Set(["23CS001", "23CS002", "23CS003", "23CS004", "23CS005"]);
    const result = parseAndValidateMarksCSV(csvContent, 100, validRolls);

    // 23CS001 line 1 is valid (85)
    // 23CS004 is valid (absent)
    expect(result.validRows.length).toBe(2);
    expect(result.validRows[0].rollNo).toBe("23CS001");
    expect(result.validRows[0].marksObtained).toBe(85);

    expect(result.validRows[1].rollNo).toBe("23CS004");
    expect(result.validRows[1].isAbsent).toBe(true);

    // Errors:
    // 1. 23CS002: 105 > max 100
    // 2. 23CS003: -5 < 0
    // 3. 23CS001 duplicate
    // 4. 23CS999 not enrolled
    // 5. 23CS005 invalid numeric "abc"
    expect(result.errors.length).toBe(5);

    const errorReasons = result.errors.map((e) => e.reason);
    expect(errorReasons.some((r) => r.includes("exceed maximum"))).toBe(true);
    expect(errorReasons.some((r) => r.includes("cannot be negative"))).toBe(true);
    expect(errorReasons.some((r) => r.includes("Duplicate entry"))).toBe(true);
    expect(errorReasons.some((r) => r.includes("not enrolled"))).toBe(true);
    expect(errorReasons.some((r) => r.includes("numeric value"))).toBe(true);
  });

  it("should unparse records to standard CSV", () => {
    const rows = [
      { Roll: "23CS001", Name: "Aarav Patel", Marks: 90 },
      { Roll: "23CS002", Name: "Ananya Sharma", Marks: 85 },
    ];
    const csv = generateCSV(rows);
    expect(csv).toContain("23CS001");
    expect(csv).toContain("Aarav Patel");
    expect(csv).toContain("90");
  });
});

