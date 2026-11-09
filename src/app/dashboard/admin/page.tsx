"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  GraduationCap,
  FileCheck2,
  TrendingUp,
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  History,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Building2,
  Plus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionUser } from "@/lib/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "ADMIN") {
        if (meData.user.role === "FACULTY") router.push("/dashboard/faculty");
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
        </div>
      </AppShell>
    );
  }

  const metrics = data?.metrics || {};
  const recentLogs = data?.recentAuditLogs || [];
  const subjectAnalytics = data?.subjectAnalytics || [];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Welcome Banner */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 p-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Academic Administrative Command Center
                </h1>
                <Badge variant="default">Admin</Badge>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Apex Institute of Technology & Engineering • Real-time database metrics & audit surveillance.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <Link href="/dashboard/admin/examinations">
                <Button className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  New Examination
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Primary Metric KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                Total Students
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {metrics.totalStudents ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Active enrollments</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                Active Faculty
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {metrics.totalFaculty ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Authorized evaluators</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                Examinations
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-blue-600">
                {metrics.totalExams ?? 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {metrics.publishedExams ?? 0} published • {metrics.underReviewExams ?? 0} in review
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                Pass Rate
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-emerald-600">
                {metrics.overallPassPercentage ?? 0}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {metrics.passCount ?? 0} passed / {metrics.failCount ?? 0} failed
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                Average Score
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-indigo-600">
                {metrics.averagePercentage ?? 0}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Cohort overall mean</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-3.5 pb-1">
              <CardDescription className="text-[11px] font-semibold uppercase tracking-wider">
                High / Low Score
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3.5 pt-0">
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {metrics.highestPercentage ?? 0}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Lowest: {metrics.lowestPercentage ?? 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Analytics & Quick Shortcuts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subject Performance Analytics Chart */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    Subject-wise Average Evaluation Score
                  </CardTitle>
                  <CardDescription>
                    Aggregated mean percentages across all published internal assessments
                  </CardDescription>
                </div>
                <Link href="/dashboard/admin/rankings">
                  <Button variant="ghost" size="sm" className="text-xs gap-1">
                    Full Rankings <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="subjectCode" stroke="#888888" fontSize={12} />
                  <YAxis stroke="#888888" fontSize={12} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: 8 }}
                  />
                  <Legend />
                  <Bar
                    dataKey="averageScore"
                    name="Average Score (%)"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Management Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Administrative Shortcuts
              </CardTitle>
              <CardDescription>Direct access to core modules</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <Link
                href="/dashboard/admin/examinations"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <FileCheck2 className="h-4 w-4 text-blue-600" />
                  <span>Review & Publish Results</span>
                </div>
                <Badge variant="outline">{metrics.underReviewExams ?? 0} in review</Badge>
              </Link>

              <Link
                href="/dashboard/admin/marks"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <Award className="h-4 w-4 text-amber-600" />
                  <span>Marks Correction Workflow</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>

              <Link
                href="/dashboard/admin/students"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <span>Student Directory & Enrollments</span>
                </div>
                <Badge variant="outline">{metrics.totalStudents ?? 0} total</Badge>
              </Link>

              <Link
                href="/dashboard/admin/faculty"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <GraduationCap className="h-4 w-4 text-indigo-600" />
                  <span>Faculty & Subject Assignments</span>
                </div>
                <Badge variant="outline">{metrics.totalFaculty ?? 0} active</Badge>
              </Link>

              <Link
                href="/dashboard/admin/audit-logs"
                className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-center gap-2.5 text-xs font-semibold">
                  <History className="h-4 w-4 text-slate-600" />
                  <span>Immutable Audit Trail</span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity Log */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-600" />
                  Recent System Audit Trail
                </CardTitle>
                <CardDescription>Real-time audit log of security events, marks modifications, and publication</CardDescription>
              </div>
              <Link href="/dashboard/admin/audit-logs">
                <Button variant="outline" size="sm" className="text-xs">
                  View Full Audit Log
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">User</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Entity Type</th>
                  <th className="py-2.5 px-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {recentLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-4 text-slate-900 dark:text-white font-medium">
                      {log.user?.email || "System"}
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant="outline" className="text-[10px] font-sans">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-slate-500">{log.entityType}</td>
                    <td className="py-2 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate font-sans text-[11px]">
                      {log.details || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

