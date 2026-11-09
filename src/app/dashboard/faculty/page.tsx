"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  Users,
  PenSquare,
  FileSpreadsheet,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionUser } from "@/lib/types";

export default function FacultyDashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchFacultyData();
  }, []);

  const fetchFacultyData = async () => {
    try {
      setLoading(true);
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "FACULTY") {
        if (meData.user.role === "ADMIN") router.push("/dashboard/admin");
        else router.push("/dashboard/student");
        return;
      }
      setUser(meData.user);

      const analyticsRes = await fetch("/api/analytics");
      const analyticsData = await analyticsRes.json();
      setData(analyticsData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell user={user}>
        <div className="space-y-6 animate-pulse">
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-64 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </AppShell>
    );
  }

  const assignments = data?.assignments || [];
  const activeExams = data?.activeExams || [];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="rounded-xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50/40 p-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Welcome, {user?.firstName} {user?.lastName}
                </h1>
                <Badge variant="warning">Faculty Member</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Department of {user?.departmentCode || "CSE"} • Access restricted to assigned courses and classes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/dashboard/faculty/marks">
                <Button className="gap-2">
                  <PenSquare className="h-4 w-4" />
                  Enter / Import Marks
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Assigned Subjects & Classes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Your Assigned Teaching Scope
              </CardTitle>
              <CardDescription>
                Subjects and section classes you are authorized to manage and evaluate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No subject assignments currently linked. Contact administrator.
                </div>
              ) : (
                <div className="space-y-3">
                  {assignments.map((a: any) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">
                            {a.subject.code}
                          </span>
                          <span className="font-semibold text-sm text-slate-900 dark:text-white">
                            {a.subject.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                          <span>{a.semester.name}</span>
                          <span>•</span>
                          <span>Section {a.section?.name || "All Sections"}</span>
                          <span>•</span>
                          <span>Credits: {a.subject.credits}</span>
                        </div>
                      </div>

                      <Badge variant="outline" className="text-xs">
                        Authorized Evaluator
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Internal Examinations */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-amber-600" />
                Examinations in Progress
              </CardTitle>
              <CardDescription>
                Internal exams requiring marks entry, verification, or review
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activeExams.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No active examinations found for your assigned subjects.
                </div>
              ) : (
                <div className="space-y-3">
                  {activeExams.map((exam: any) => (
                    <div
                      key={exam.id}
                      className="p-3.5 rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-sm text-slate-900 dark:text-white">
                            {exam.name}
                          </h4>
                          <Badge
                            variant={
                              exam.status === "PUBLISHED"
                                ? "success"
                                : exam.status === "UNDER_REVIEW"
                                ? "warning"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {exam.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {exam.semester.name} • Batch {exam.batch.name} • Exam Date: {exam.examDate?.split("T")[0]}
                        </p>
                      </div>

                      <Link href={`/dashboard/faculty/marks?examId=${exam.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs whitespace-nowrap">
                          Manage Marks
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Links & Workflow Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50">
                <PenSquare className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Interactive Marks Grid</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Enter and update individual student marks directly with live boundary checks.
                </p>
                <Link href="/dashboard/faculty/marks" className="text-xs text-blue-600 font-semibold hover:underline inline-flex items-center gap-1 mt-2">
                  Open Grid <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Bulk CSV / Excel Import</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Upload spreadsheet rosters with automated pre-flight duplicate and limit validations.
                </p>
                <Link href="/dashboard/faculty/marks?tab=import" className="text-xs text-emerald-600 font-semibold hover:underline inline-flex items-center gap-1 mt-2">
                  Import File <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
            <CardContent className="p-5 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
                <Award className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-sm">Published Standings</h4>
                <p className="text-xs text-slate-500 mt-1">
                  View subject-wise competition rankings and cohort statistics once published.
                </p>
                <Link href="/dashboard/faculty/rankings" className="text-xs text-indigo-600 font-semibold hover:underline inline-flex items-center gap-1 mt-2">
                  View Standings <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

