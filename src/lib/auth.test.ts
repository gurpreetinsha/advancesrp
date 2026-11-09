import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, signToken, verifyToken } from "./auth";
import { SessionUser } from "./types";

describe("Authentication & Session Security", () => {
  it("should securely hash and verify passwords", async () => {
    const rawPassword = "SecurePassword@2026!";
    const hash = await hashPassword(rawPassword);

    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);

    const isMatch = await verifyPassword(rawPassword, hash);
    expect(isMatch).toBe(true);

    const wrongMatch = await verifyPassword("WrongPassword", hash);
    expect(wrongMatch).toBe(false);
  });

  it("should sign and verify tamper-proof session JWT tokens", async () => {
    const userPayload: SessionUser = {
      id: "user-123",
      email: "student@college.edu",
      role: "STUDENT",
      firstName: "Aarav",
      lastName: "Patel",
      studentId: "stu-123",
      rollNo: "23CS001",
    };

    const token = await signToken(userPayload);
    expect(typeof token).toBe("string");
    expect(token.split(".").length).toBe(3);

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.email).toBe("student@college.edu");
    expect(decoded?.role).toBe("STUDENT");
    expect(decoded?.rollNo).toBe("23CS001");
  });

  it("should reject corrupted or forged tokens", async () => {
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted.signature";
    const decoded = await verifyToken(invalidToken);
    expect(decoded).toBeNull();
  });
});

