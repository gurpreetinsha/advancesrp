"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Award, Download, FileSpreadsheet, Filter } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SessionUser } from "@/lib/types";

export default function FacultyRankingsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [examinations, setExaminations] = React.useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState<string>("");
  const [rankingType, setRankingType] = React.useState<"subject" | "class" | "batch">("subject");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("");
  const [rankingsData, setRankingsData] = React.useState<any>(null);

  React.useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      setUser(meData.user);

      const examsRes = await fetch("/api/examinations?status=PUBLISHED");
      const examsData = await examsRes.json();
      const list = examsData.examinations || [];
      setExaminations(list);
      if (list.length > 0) {
        setSelectedExamId(list[0].id);
        if (list[0].examSubjects?.length > 0) {
          setSelectedSubjectId(list[0].examSubjects[0].subject.id);
        }
      }
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (selectedExamId) {
      fetchRankings();
    }
  }, [selectedExamId, rankingType, selectedSubjectId]);

  const fetchRankings = async () => {
    try {
      let url = `/api/rankings?type=${rankingType}&examId=${selectedExamId}`;
      if (rankingType === "subject" && selectedSubjectId) {
        url += `&subjectId=${selectedSubjectId}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      setRankingsData(data);
    } catch (err) {
      console.error(err);
    }
  };

  const currentExam = examinations.find((e) => e.id === selectedExamId);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="h-6 w-6 text-amber-500" />
              Published Academic Standings & Rankings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Verified competition ranking (1, 2, 2, 4) computed across published cohorts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/export?format=csv&type=ranking&examId=${selectedExamId}&rankingType=${rankingType}&subjectId=${selectedSubjectId}`}
              download
            >
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </a>
            <a
              href={`/api/export?format=excel&type=ranking&examId=${selectedExamId}&rankingType=${rankingType}&subjectId=${selectedSubjectId}`}
              download
            >
              <Button size="sm" variant="outline" className="gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                Export Excel
              </Button>
            </a>
          </div>
        </div>

        {/* Toolbar */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Published Examination
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => {
                  setSelectedExamId(e.target.value);
                  const ex = examinations.find((x) => x.id === e.target.value);
                  if (ex?.examSubjects?.length > 0) {
                    setSelectedSubjectId(ex.examSubjects[0].subject.id);
                  }
                }}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                {examinations.map((e) => (
                  <option key={e.id} value={e.id} className="dark:bg-slate-900">
                    {e.name} ({e.semester.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Ranking Level
              </label>
              <select
                value={rankingType}
                onChange={(e) => setRankingType(e.target.value as any)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="subject" className="dark:bg-slate-900">Subject-wise Ranking</option>
                <option value="class" className="dark:bg-slate-900">Class-wise (Section) Ranking</option>
                <option value="batch" className="dark:bg-slate-900">Batch-wise (All Sections) Ranking</option>
              </select>
            </div>

            {rankingType === "subject" && (
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Subject Course
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {currentExam?.examSubjects?.map((es: any) => (
                    <option key={es.subject.id} value={es.subject.id} className="dark:bg-slate-900">
                      {es.subject.code} - {es.subject.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ranking Output Table */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {rankingType === "subject"
                    ? `Subject Standing: ${rankingsData?.subjectCode || ""} ${rankingsData?.subjectName || ""}`
                    : rankingType === "class"
                    ? "Class Aggregate Standings"
                    : "Batch-wide Academic Standings"}
                </CardTitle>
                <CardDescription>
                  Total evaluated students: {rankingsData?.rankings?.length || 0}
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">
                Competition 1, 2, 2, 4
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold text-center w-16">Rank</th>
                  <th className="py-3 px-4 font-semibold">Roll No</th>
                  <th className="py-3 px-4 font-semibold">Student Name</th>
                  {rankingType !== "subject" && (
                    <th className="py-3 px-3 font-semibold text-center">Section</th>
                  )}
                  <th className="py-3 px-4 font-semibold text-center">
                    {rankingType === "subject" ? "Marks Obtained" : "Total Marks"}
                  </th>
                  <th className="py-3 px-3 font-semibold text-center">Percentage</th>
                  {rankingType === "subject" ? (
                    <th className="py-3 px-3 font-semibold text-center">Diff From Highest</th>
                  ) : (
                    <>
                      <th className="py-3 px-3 font-semibold text-center">SGPA</th>
                      <th className="py-3 px-3 font-semibold text-center">Status</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(rankingsData?.rankings || []).map((row: any) => (
                  <tr key={row.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-center font-bold text-base">
                      {row.rank === 1 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 font-extrabold text-xs">
                          1
                        </span>
                      ) : row.rank === 2 ? (
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-200 text-slate-800 font-bold text-xs">
                          2
                        </span>
                      ) : (
                        `#${row.rank}`
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {row.rollNo}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      {row.studentName}
                    </td>
                    {rankingType !== "subject" && (
                      <td className="py-2.5 px-3 text-center font-mono">
                        {row.sectionName || "A"}
                      </td>
                    )}
                    <td className="py-2.5 px-4 text-center font-mono font-bold">
                      {rankingType === "subject"
                        ? row.isAbsent ? "ABSENT" : `${row.marksObtained} / ${row.maxMarks}`
                        : `${row.totalObtained} / ${row.totalMax}`}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-slate-800 dark:text-slate-200">
                      {rankingType === "subject" ? `${row.percentage}%` : `${row.aggregatePercentage ?? row.normalizedPercentage}%`}
                    </td>
                    {rankingType === "subject" ? (
                      <td className="py-2.5 px-3 text-center text-xs text-slate-500 font-mono">
                        {row.diffFromHighest === 0 ? (
                          <Badge variant="success" className="text-[10px]">Top Score</Badge>
                        ) : (
                          `-${row.diffFromHighest}`
                        )}
                      </td>
                    ) : (
                      <>
                        <td className="py-2.5 px-3 text-center font-mono text-xs">
                          {row.sgpa ?? "N/A"}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <Badge variant={row.hasPassedAll ? "success" : "destructive"} className="text-[10px]">
                            {row.hasPassedAll ? "PASS" : "FAIL"}
                          </Badge>
                        </td>
                      </>
                    )}
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

