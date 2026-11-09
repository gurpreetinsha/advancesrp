import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword, logAudit } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createFacultySchema = z.object({
  employeeCode: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  designation: z.string().min(2),
  departmentId: z.string(),
  password: z.string().min(6).default("Faculty@12345"),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const faculty = await prisma.faculty.findMany({
      include: {
        department: true,
        user: { select: { isActive: true } },
        assignments: {
          include: {
            subject: true,
            semester: true,
            section: true,
            academicYear: true,
          },
        },
      },
      orderBy: { firstName: "asc" },
    });

    return NextResponse.json({ success: true, faculty });
  } catch (error) {
    console.error("Faculty GET error:", error);
    return NextResponse.json({ error: "Failed to fetch faculty" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createFacultySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check duplicate
    const existing = await prisma.faculty.findFirst({
      where: {
        OR: [
          { email: data.email },
          { employeeCode: data.employeeCode },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A faculty member with this email or employee code already exists." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const faculty = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          role: "FACULTY",
          isActive: true,
        },
      });

      const newFaculty = await tx.faculty.create({
        data: {
          userId: user.id,
          employeeCode: data.employeeCode.toUpperCase(),
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email.toLowerCase(),
          phone: data.phone || null,
          designation: data.designation,
          departmentId: data.departmentId,
        },
      });

      return newFaculty;
    });

    await logAudit({
      userId: session.id,
      action: "FACULTY_CREATED",
      entityType: "Faculty",
      entityId: faculty.id,
      details: { employeeCode: faculty.employeeCode, name: `${faculty.firstName} ${faculty.lastName}` },
    });

    return NextResponse.json({ success: true, faculty }, { status: 201 });
  } catch (error) {
    console.error("Create faculty error:", error);
    return NextResponse.json({ error: "Failed to create faculty account" }, { status: 500 });
  }
}

// Assign subject to faculty
export async function PUT(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { action, facultyId, assignmentId, subjectId, semesterId, sectionId, academicYearId } = body;

    if (action === "ASSIGN") {
      const assignment = await prisma.facultyAssignment.upsert({
        where: {
          facultyId_subjectId_academicYearId_semesterId_sectionId: {
            facultyId,
            subjectId,
            academicYearId,
            semesterId,
            sectionId: sectionId || null,
          },
        },
        update: { canEnterMarks: true },
        create: {
          facultyId,
          subjectId,
          academicYearId,
          semesterId,
          sectionId: sectionId || null,
          canEnterMarks: true,
        },
      });

      await logAudit({
        userId: session.id,
        action: "FACULTY_ASSIGNMENT_CREATED",
        entityType: "FacultyAssignment",
        entityId: assignment.id,
        details: { facultyId, subjectId, semesterId, sectionId },
      });

      return NextResponse.json({ success: true, assignment });
    }

    if (action === "REMOVE") {
      await prisma.facultyAssignment.delete({
        where: { id: assignmentId },
      });

      await logAudit({
        userId: session.id,
        action: "FACULTY_ASSIGNMENT_REMOVED",
        entityType: "FacultyAssignment",
        entityId: assignmentId,
      });

      return NextResponse.json({ success: true, message: "Assignment removed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Faculty assignment error:", error);
    return NextResponse.json({ error: "Failed to update faculty assignment" }, { status: 500 });
  }
}
