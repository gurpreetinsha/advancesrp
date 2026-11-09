import { NextResponse } from "next/server";
import { clearSessionCookie, getSession, logAudit } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (session) {
    await logAudit({
      userId: session.id,
      action: "USER_LOGOUT",
      entityType: "User",
      entityId: session.id,
    });
  }

  clearSessionCookie();
  return NextResponse.json({ success: true, message: "Logged out successfully" });
}

