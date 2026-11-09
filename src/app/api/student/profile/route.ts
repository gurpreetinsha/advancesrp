import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "STUDENT") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const student = await prisma.student.findUnique({
      where: { userId: session.id },
      include: {
        department: true,
        branch: true,
        batch: true,
        currentSemester: true,
        currentSection: true,
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, student });
  } catch (error) {
    console.error("Student profile error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
