import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createStudentSchema = z.object({
  rollNo: z.string().min(2),
  enrollmentNo: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  departmentId: z.string(),
  branchId: z.string(),
  batchId: z.string(),
  currentSemesterId: z.string(),
  currentSectionId: z.string().optional(),
  password: z.string().min(12, "Use a password of at least 12 characters"),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase();
    const batchId = searchParams.get("batchId");
    const semesterId = searchParams.get("semesterId");
    const sectionId = searchParams.get("sectionId");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);

    const where: Record<string, unknown> = {};
    if (batchId) where.batchId = batchId;
    if (semesterId) where.currentSemesterId = semesterId;
    if (sectionId) where.currentSectionId = sectionId;

    if (search) {
      where.OR = [
        { rollNo: { contains: search } },
        { enrollmentNo: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [total, students] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        include: {
          department: true,
          branch: true,
          batch: true,
          currentSemester: true,
          currentSection: true,
          user: {
            select: { isActive: true },
          },
        },
        orderBy: { rollNo: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      students,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin students GET error:", error);
    return NextResponse.json({ error: "Failed to fetch students" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createStudentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const [branch, batch, semester, section] = await Promise.all([
      prisma.branch.findUnique({ where: { id: data.branchId }, select: { id: true, departmentId: true } }),
      prisma.batch.findUnique({ where: { id: data.batchId }, select: { id: true, branchId: true } }),
      prisma.semester.findUnique({ where: { id: data.currentSemesterId }, select: { id: true } }),
      data.currentSectionId
        ? prisma.section.findUnique({ where: { id: data.currentSectionId }, select: { id: true, branchId: true } })
        : Promise.resolve(null),
    ]);
    if (!branch || !batch || !semester || branch.departmentId !== data.departmentId ||
        batch.branchId !== data.branchId || (data.currentSectionId && (!section || section.branchId !== data.branchId))) {
      return NextResponse.json({ error: "Department, branch, batch, semester, and section selections are inconsistent." }, { status: 400 });
    }

    // Check duplicate email, roll, enrollment
    const existing = await prisma.student.findFirst({
      where: {
        OR: [
          { email: data.email },
          { rollNo: data.rollNo },
          { enrollmentNo: data.enrollmentNo },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A student with this Roll No, Enrollment No, or Email already exists." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          role: "STUDENT",
          isActive: true,
        },
      });

      const newStudent = await tx.student.create({
        data: {
          userId: user.id,
          rollNo: data.rollNo.toUpperCase(),
          enrollmentNo: data.enrollmentNo.toUpperCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          departmentId: data.departmentId,
          branchId: data.branchId,
          batchId: data.batchId,
          currentSemesterId: data.currentSemesterId,
          currentSectionId: data.currentSectionId || null,
        },
      });

      // Find current academic year
      const currentYear = await tx.academicYear.findFirst({
        where: { isCurrent: true },
      });

      if (currentYear) {
        await tx.studentEnrollment.create({
          data: {
            studentId: newStudent.id,
            academicYearId: currentYear.id,
            batchId: data.batchId,
            semesterId: data.currentSemesterId,
            sectionId: data.currentSectionId || null,
            status: "ACTIVE",
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id, action: "STUDENT_CREATED", entityType: "Student", entityId: newStudent.id,
          details: JSON.stringify({ rollNo: newStudent.rollNo, name: `${newStudent.firstName} ${newStudent.lastName}` }),
        },
      });
      return newStudent;
    });

    return NextResponse.json({ success: true, student }, { status: 201 });
  } catch (error) {
    console.error("Create student error:", error);
    return NextResponse.json({ error: "Failed to create student" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { id, firstName, lastName, phone, currentSemesterId, currentSectionId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 });
    }

    const student = await prisma.student.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: {
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
          ...(phone !== undefined && { phone }),
          ...(currentSemesterId && { currentSemesterId }),
          ...(currentSectionId !== undefined && { currentSectionId }),
          ...(isActive !== undefined && { isActive }),
        },
      });

      if (isActive !== undefined) {
        await tx.user.update({
          where: { id: student.userId },
          data: { isActive },
        });
      }
    });

    await logAudit({
      userId: session.id,
      action: "STUDENT_UPDATED",
      entityType: "Student",
      entityId: id,
      details: { rollNo: student.rollNo, changes: body },
    });

    return NextResponse.json({ success: true, message: "Student record updated successfully" });
  } catch (error) {
    console.error("Update student error:", error);
    return NextResponse.json({ error: "Failed to update student" }, { status: 500 });
  }
}
