import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession, hashPassword } from "@/lib/auth";
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
  password: z.string().min(12, "Use a password of at least 12 characters"),
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
    const department = await prisma.department.findUnique({ where: { id: data.departmentId }, select: { id: true } });
    if (!department) return NextResponse.json({ error: "Selected department does not exist." }, { status: 400 });

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

      await tx.auditLog.create({
        data: {
          userId: session.id, action: "FACULTY_CREATED", entityType: "Faculty", entityId: newFaculty.id,
          details: JSON.stringify({ employeeCode: newFaculty.employeeCode, name: `${newFaculty.firstName} ${newFaculty.lastName}` }),
        },
      });
      return newFaculty;
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
      if (![facultyId, subjectId, academicYearId, semesterId].every((value) => typeof value === "string" && value.length > 0)) {
        return NextResponse.json({ error: "facultyId, subjectId, academicYearId, and semesterId are required." }, { status: 400 });
      }
      const [faculty, subject, academicYear, semester, section] = await Promise.all([
        prisma.faculty.findUnique({ where: { id: facultyId }, select: { id: true, isActive: true } }),
        prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, branchId: true, semesterId: true } }),
        prisma.academicYear.findUnique({ where: { id: academicYearId }, select: { id: true } }),
        prisma.semester.findUnique({ where: { id: semesterId }, select: { id: true } }),
        sectionId ? prisma.section.findUnique({ where: { id: sectionId }, select: { id: true, branchId: true } }) : Promise.resolve(null),
      ]);
      if (!faculty?.isActive || !subject || !academicYear || !semester ||
          subject.semesterId !== semesterId ||
          (sectionId && (!section || section.branchId !== subject.branchId))) {
        return NextResponse.json({ error: "Faculty, subject, academic year, semester, or section configuration is invalid." }, { status: 400 });
      }

      const assignment = await prisma.$transaction(async (tx) => {
        const existing = await tx.facultyAssignment.findFirst({
          where: { facultyId, subjectId, academicYearId, semesterId, sectionId: sectionId || null },
        });
        const saved = existing
          ? await tx.facultyAssignment.update({ where: { id: existing.id }, data: { canEnterMarks: true } })
          : await tx.facultyAssignment.create({
              data: { facultyId, subjectId, academicYearId, semesterId, sectionId: sectionId || null, canEnterMarks: true },
            });
        await tx.auditLog.create({
          data: {
            userId: session.id, action: "FACULTY_ASSIGNMENT_CREATED",
            entityType: "FacultyAssignment", entityId: saved.id,
            details: JSON.stringify({ facultyId, subjectId, academicYearId, semesterId, sectionId: sectionId || null }),
          },
        });
        return saved;
      });
      return NextResponse.json({ success: true, assignment });
    }

    if (action === "REMOVE") {
      if (typeof assignmentId !== "string" || !assignmentId) {
        return NextResponse.json({ error: "assignmentId is required." }, { status: 400 });
      }
      await prisma.$transaction(async (tx) => {
        await tx.facultyAssignment.delete({ where: { id: assignmentId } });
        await tx.auditLog.create({
          data: { userId: session.id, action: "FACULTY_ASSIGNMENT_REMOVED", entityType: "FacultyAssignment", entityId: assignmentId },
        });
      });
      return NextResponse.json({ success: true, message: "Assignment removed" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Faculty assignment error:", error);
    return NextResponse.json({ error: "Failed to update faculty assignment" }, { status: 500 });
  }
}
