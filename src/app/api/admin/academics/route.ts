import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [departments, branches, batches, semesters, sections, subjects, academicYears] = await Promise.all([
      prisma.department.findMany({ orderBy: { code: "asc" } }),
      prisma.branch.findMany({ include: { department: true }, orderBy: { code: "asc" } }),
      prisma.batch.findMany({ include: { branch: true }, orderBy: { startYear: "desc" } }),
      prisma.semester.findMany({ orderBy: { number: "asc" } }),
      prisma.section.findMany({ include: { branch: true }, orderBy: { name: "asc" } }),
      prisma.subject.findMany({ include: { branch: true, semester: true }, orderBy: { code: "asc" } }),
      prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    ]);

    return NextResponse.json({
      success: true,
      departments,
      branches,
      batches,
      semesters,
      sections,
      subjects,
      academicYears,
    });
  } catch (error) {
    console.error("Academics GET error:", error);
    return NextResponse.json({ error: "Failed to load academic data" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const { entity, data } = body;

    if (entity === "SUBJECT") {
      const subject = await prisma.subject.create({
        data: {
          code: data.code.toUpperCase(),
          name: data.name,
          credits: Number(data.credits) || 3.0,
          type: data.type || "THEORY",
          branchId: data.branchId,
          semesterId: data.semesterId,
        },
      });
      return NextResponse.json({ success: true, item: subject });
    }

    if (entity === "BATCH") {
      const batch = await prisma.batch.create({
        data: {
          name: data.name,
          startYear: Number(data.startYear),
          endYear: Number(data.endYear),
          branchId: data.branchId,
        },
      });
      return NextResponse.json({ success: true, item: batch });
    }

    if (entity === "SECTION") {
      const section = await prisma.section.create({
        data: {
          name: data.name.toUpperCase(),
          branchId: data.branchId,
        },
      });
      return NextResponse.json({ success: true, item: section });
    }

    return NextResponse.json({ error: "Unsupported entity" }, { status: 400 });
  } catch (error) {
    console.error("Academics POST error:", error);
    return NextResponse.json({ error: "Failed to create academic entity" }, { status: 500 });
  }
}
