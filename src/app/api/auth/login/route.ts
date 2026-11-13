import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signToken, setSessionCookie } from "@/lib/auth";
import { SessionUser, UserRole } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        student: {
          include: {
            department: true,
            branch: true,
            batch: true,
            currentSemester: true,
            currentSection: true,
          },
        },
        faculty: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Account has been deactivated. Please contact administrator." },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    const sessionPayload: SessionUser = {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      firstName: user.student?.firstName || user.faculty?.firstName || "Admin",
      lastName: user.student?.lastName || user.faculty?.lastName || "User",
      studentId: user.student?.id,
      facultyId: user.faculty?.id,
      rollNo: user.student?.rollNo,
      enrollmentNo: user.student?.enrollmentNo,
      departmentCode: user.student?.department.code || user.faculty?.department.code,
    };

    // Persist the login audit event before issuing a session cookie.
    await prisma.auditLog.create({
      data: {
        userId: user.id, action: "USER_LOGIN", entityType: "User", entityId: user.id,
        details: JSON.stringify({ role: user.role }),
      },
    });

    const token = await signToken(sessionPayload);
    setSessionCookie(token);

    return NextResponse.json({
      success: true,
      user: sessionPayload,
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during login" },
      { status: 500 }
    );
  }
}

