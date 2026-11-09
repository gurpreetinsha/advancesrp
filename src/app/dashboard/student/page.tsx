"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  GraduationCap,
  Award,
  Download,
  Printer,
  TrendingUp,
  FileText,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart2,
  BookOpen,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionUser } from "@/lib/types";

export default function StudentDashboardPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = React.useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = React.useState(false);

  React.useEffect(() => {
    fetchSessionAndResults();
  }, [selectedExamId]);

  const fetchSessionAndResults = async () => {
    try {
      setLoading(true);
      // Fetch user session
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "STUDENT") {
        if (meData.user.role === "ADMIN") router.push("/dashboard/admin");
        else router.push("/dashboard/faculty");
        return;
      }
      setUser(meData.user);

      // Fetch results
      const url = selectedExamId
        ? `/api/student/results?examId=${selectedExamId}`
        : "/api/student/results";
      const res = await fetch(url);
      const resData = await res.json();

      if (!res.ok) {
        setError(resData.error || "Failed to load examination results");
        setLoading(false);
        return;
      }

      setData(resData);
      if (!selectedExamId && resData.selectedResult) {
        setSelectedExamId(resData.selectedResult.examId);
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Network error while connecting to student portal.");
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!data?.selectedResult) return;
    try {
      setDownloadingPdf(true);
      const res = await fetch(`/api/student/results/${data.selectedResult.examId}/pdf`);
      if (!res.ok) {
        alert("Failed to generate PDF result sheet.");
        setDownloadingPdf(false);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.student.rollNo}_${data.selectedResult.examName.replace(/\s+/g, "_")}_Result.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert("Error occurred while downloading PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <AppShell user={user}>
        <div className="space-y-6 animate-pulse">
          <div className="h-28 rounded-xl bg-slate-200 dark:bg-slate-800" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
            <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
          </div>
          <div className="h-80 rounded-xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </AppShell>
    );
  }

  if (error || !data) {
    return (
      <AppShell user={user}>
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/40">
          <AlertCircle className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" />
          <h2 className="mt-4 text-lg font-bold text-red-900 dark:text-red-200">Unable to load results</h2>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
          <Button onClick={() => fetchSessionAndResults()} className="mt-4">
            Retry Loading
          </Button>
        </div>
      </AppShell>
    );
  }

  const student = data.student;
  const currentResult = data.selectedResult;
  const allResults = data.results || [];
  const performanceTrends = data.performanceTrends || [];

  // Chart data for subject-wise comparison
  const comparisonData = currentResult?.subjects.map((sub: any) => ({
    name: sub.subjectCode,
    fullName: sub.subjectName,
    "My Marks": sub.marksObtained || 0,
    "Class Average": sub.classAverage || 0,
    "Max Marks": sub.maxMarks,
  })) || [];

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Student Profile & Welcome Banner */}
        <div className="rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50/40 p-6 dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/40">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <GraduationCap className="h-8 w-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    {student.firstName} {student.lastName}
                  </h1>
                  <Badge variant="success">Active Student</Badge>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Roll No: <span className="font-mono font-bold text-slate-900 dark:text-white">{student.rollNo}</span> • Enrollment: <span className="font-mono font-bold text-slate-900 dark:text-white">{student.enrollmentNo}</span>
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-slate-600 dark:text-slate-400">
                  <span>Branch: <strong className="text-slate-900 dark:text-white">{student.branch?.name}</strong></span>
                  <span>Batch: <strong className="text-slate-900 dark:text-white">{student.batch?.name}</strong></span>
                  <span>Semester: <strong className="text-slate-900 dark:text-white">{student.currentSemester?.name}</strong></span>
                  <span>Section: <strong className="text-slate-900 dark:text-white">{student.currentSection?.name || "A"}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {currentResult && (
              <div className="flex items-center gap-2 self-start md:self-center no-print">
                <Button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="gap-1.5 shadow-sm"
                >
                  <Download className="h-4 w-4" />
                  {downloadingPdf ? "Generating..." : "Download PDF"}
                </Button>
                <Button onClick={handlePrint} variant="outline" className="gap-1.5">
                  <Printer className="h-4 w-4" />
                  Print
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Examination Selector Tabs if multiple published exams */}
        {allResults.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar no-print">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap mr-1">
              Published Exams:
            </span>
            {allResults.map((r: any) => (
              <button
                key={r.examId}
                onClick={() => setSelectedExamId(r.examId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap border ${
                  selectedExamId === r.examId
                    ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                    : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                }`}
              >
                {r.examName} ({r.academicYear})
              </button>
            ))}
          </div>
        )}

        {!currentResult ? (
          <Card className="text-center p-12">
            <AlertCircle className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <CardTitle>No Published Results Available</CardTitle>
            <CardDescription className="max-w-md mx-auto mt-2">
              There are currently no officially published internal examination results for your cohort.
              Internal assessment marks will be visible here once verified and published by the administration.
            </CardDescription>
          </Card>
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Total Marks
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {currentResult.totalObtained} <span className="text-sm font-normal text-slate-500">/ {currentResult.totalMax}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <span>Percentage:</span>
                    <strong className="text-blue-600 font-bold">{currentResult.percentage}%</strong>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Grade & Status
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono">
                      {currentResult.overallGrade}
                    </span>
                    <Badge variant={currentResult.overallStatus === "PASS" ? "success" : "destructive"}>
                      {currentResult.overallStatus === "PASS" ? "PASSED" : "FAILED"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    SGPA: <strong className="text-slate-900 dark:text-white font-mono">{currentResult.sgpa ?? "N/A"}</strong>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Class Rank
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-5 w-5 text-amber-500" />
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {currentResult.classRank ? `Rank ${currentResult.classRank.rank}` : "N/A"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    out of <strong>{currentResult.classRank?.totalEligible ?? 0}</strong> students in Sec {currentResult.sectionName}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="p-4 pb-2">
                  <CardDescription className="text-xs font-semibold uppercase tracking-wider">
                    Batch Rank
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center gap-1.5">
                    <Award className="h-5 w-5 text-indigo-500" />
                    <div className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {currentResult.batchRank ? `Rank ${currentResult.batchRank.rank}` : "N/A"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    out of <strong>{currentResult.batchRank?.totalEligible ?? 0}</strong> students across all sections
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Subject-wise Marks Table */}
            <Card>
              <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-blue-600" />
                      Subject-wise Marks Statement
                    </CardTitle>
                    <CardDescription>
                      {currentResult.examName} • Academic Year {currentResult.academicYear} • Exam Date: {currentResult.examDate}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono self-start sm:self-center">
                    Official Published Record
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Course Code</th>
                      <th className="py-3 px-4 font-semibold">Course Title</th>
                      <th className="py-3 px-3 font-semibold text-center">Credits</th>
                      <th className="py-3 px-3 font-semibold text-center">Max</th>
                      <th className="py-3 px-3 font-semibold text-center">Min Pass</th>
                      <th className="py-3 px-4 font-semibold text-center">Marks Obtained</th>
                      <th className="py-3 px-3 font-semibold text-center">Grade</th>
                      <th className="py-3 px-3 font-semibold text-center">Subject Rank</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {currentResult.subjects.map((sub: any) => (
                      <tr key={sub.subjectId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {sub.subjectCode}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900 dark:text-white block">{sub.subjectName}</span>
                          <span className="text-[11px] text-slate-500 uppercase">{sub.type}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{sub.credits}</td>
                        <td className="py-3 px-3 text-center font-mono">{sub.maxMarks}</td>
                        <td className="py-3 px-3 text-center font-mono text-slate-500">{sub.passingMarks}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-base">
                          {sub.isAbsent ? (
                            <span className="text-red-500 font-semibold text-xs">ABSENT</span>
                          ) : (
                            sub.marksObtained ?? "-"
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                            {sub.grade}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {sub.subjectRank ? (
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              #{sub.subjectRank} <span className="text-[10px] text-slate-400">({sub.diffFromHighest === 0 ? "Highest" : `-${sub.diffFromHighest}`})</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          {sub.status === "PASS" ? (
                            <Badge variant="success" className="text-[10px]">PASS</Badge>
                          ) : sub.isAbsent ? (
                            <Badge variant="destructive" className="text-[10px]">ABSENT</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">FAIL</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/40 font-bold border-t border-slate-200 dark:border-slate-800">
                    <tr>
                      <td colSpan={3} className="py-3 px-4 text-slate-900 dark:text-white">
                        Grand Aggregate
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{currentResult.totalMax}</td>
                      <td className="py-3 px-3 text-center">-</td>
                      <td className="py-3 px-4 text-center font-mono text-base text-blue-600 dark:text-blue-400">
                        {currentResult.totalObtained}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">{currentResult.overallGrade}</td>
                      <td className="py-3 px-3 text-center">
                        {currentResult.classRank ? `Rank ${currentResult.classRank.rank}` : "-"}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge variant={currentResult.overallStatus === "PASS" ? "success" : "destructive"}>
                          {currentResult.overallStatus}
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>

            {/* Performance Analytics Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 no-print" id="analytics">
              {/* Subject Comparison Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <BarChart2 className="h-4 w-4 text-blue-600" />
                    Subject-wise Marks vs Class Average
                  </CardTitle>
                  <CardDescription>
                    Compare your performance against the section average for each subject
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" stroke="#888888" fontSize={12} />
                      <YAxis stroke="#888888" fontSize={12} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: 8 }}
                      />
                      <Legend />
                      <Bar dataKey="My Marks" fill="#2563eb" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Class Average" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Progress Trend Chart across Examinations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Performance Trend Across Examinations
                  </CardTitle>
                  <CardDescription>
                    Tracking your aggregate percentage progression across all internal assessments
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  {performanceTrends.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-xs text-slate-400">
                      Trend data requires at least one published examination.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={performanceTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="examName" stroke="#888888" fontSize={12} />
                        <YAxis stroke="#888888" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#fff", borderRadius: 8 }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="percentage"
                          name="Percentage (%)"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          dot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

