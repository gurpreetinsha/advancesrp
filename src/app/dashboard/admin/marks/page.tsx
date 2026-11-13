"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PenSquare,
  ShieldAlert,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  History,
  FileSpreadsheet,
  Download,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SessionUser } from "@/lib/types";

function AdminMarksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  // Filters
  const [examinations, setExaminations] = React.useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = React.useState<string>("");

  // Grid data
  const [examSubjectData, setExamSubjectData] = React.useState<any>(null);
  const [students, setStudents] = React.useState<any[]>([]);

  // Correction Modal
  const [correctionModalOpen, setCorrectionModalOpen] = React.useState(false);
  const [targetStudent, setTargetStudent] = React.useState<any>(null);
  const [newMarkValue, setNewMarkValue] = React.useState<string>("");
  const [isAbsentCorrection, setIsAbsentCorrection] = React.useState<boolean>(false);
  const [correctionReason, setCorrectionReason] = React.useState<string>("");
  const [submittingCorrection, setSubmittingCorrection] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  React.useEffect(() => {
    init();
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "ADMIN") {
        router.push("/dashboard/student");
        return;
      }
      setUser(meData.user);

      const examsRes = await fetch("/api/examinations");
      const examsData = await examsRes.json();
      const list = examsData.examinations || [];
      setExaminations(list);

      const queryExamId = searchParams.get("examId");
      if (queryExamId && list.some((e: any) => e.id === queryExamId)) {
        setSelectedExamId(queryExamId);
      } else if (list.length > 0) {
        setSelectedExamId(list[0].id);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!selectedExamId) return;
    const currentExam = examinations.find((e) => e.id === selectedExamId);
    if (currentExam && currentExam.examSubjects?.length > 0) {
      setSelectedSubjectId(currentExam.examSubjects[0].subject.id);
    }
  }, [selectedExamId, examinations]);

  React.useEffect(() => {
    if (selectedExamId && selectedSubjectId) {
      fetchMarks();
    }
  }, [selectedExamId, selectedSubjectId, selectedSectionId]);

  const fetchMarks = async () => {
    try {
      setStatusMessage(null);
      let url = `/api/marks?examId=${selectedExamId}&subjectId=${selectedSubjectId}`;
      if (selectedSectionId) url += `&sectionId=${selectedSectionId}`;

      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setExamSubjectData(data.examSubject);
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenCorrection = (student: any) => {
    setTargetStudent(student);
    setNewMarkValue(student.marksObtained !== null ? student.marksObtained.toString() : "");
    setIsAbsentCorrection(student.isAbsent || false);
    setCorrectionReason("");
    setCorrectionModalOpen(true);
  };

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetStudent?.markId) {
      alert("No existing mark record found to correct. Please enter a mark first.");
      return;
    }
    if (!correctionReason.trim()) {
      alert("Please provide an official justification reason for this mark correction.");
      return;
    }

    try {
      setSubmittingCorrection(true);
      const res = await fetch("/api/marks/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          markId: targetStudent.markId,
          marksObtained: isAbsentCorrection ? null : Number(newMarkValue),
          isAbsent: isAbsentCorrection,
          reason: correctionReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to apply correction.");
      } else {
        setStatusMessage({ type: "success", text: data.message });
        setCorrectionModalOpen(false);
        fetchMarks();
      }
      setSubmittingCorrection(false);
    } catch (err) {
      console.error(err);
      alert("Error occurred while applying correction.");
      setSubmittingCorrection(false);
    }
  };

  const currentExam = examinations.find((e) => e.id === selectedExamId);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <PenSquare className="h-6 w-6 text-blue-600" />
              Administrative Marks & Controlled Corrections
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Audit-compliant marks oversight with immutable revision history.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={`/api/export?format=csv&type=ranking&examId=${selectedExamId}&rankingType=subject&subjectId=${selectedSubjectId}`}
              download
            >
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" />
                Export Marks CSV
              </Button>
            </a>
          </div>
        </div>

        {/* Filter Toolbar */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Examination
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                {examinations.map((e) => (
                  <option key={e.id} value={e.id} className="dark:bg-slate-900">
                    {e.name} ({e.status})
                  </option>
                ))}
              </select>
            </div>

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
                    {es.subject.code} - {es.subject.name} (Max: {es.maxMarks})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Section Filter
              </label>
              <select
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-900">All Sections</option>
                <option value="A" className="dark:bg-slate-900">Section A</option>
                <option value="B" className="dark:bg-slate-900">Section B</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {statusMessage && (
          <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Marks Table with Correct Action */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">
                  {examSubjectData?.subjectCode}: {examSubjectData?.subjectName}
                </CardTitle>
                <CardDescription>
                  Maximum Marks: {examSubjectData?.maxMarks} • Passing Marks: {examSubjectData?.passingMarks} • Exam Status: <strong className="uppercase">{examSubjectData?.examStatus}</strong>
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">
                {students.length} Evaluated Students
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Roll No</th>
                  <th className="py-3 px-4 font-semibold">Student Name</th>
                  <th className="py-3 px-3 font-semibold text-center">Section</th>
                  <th className="py-3 px-4 font-semibold text-center">Marks Obtained</th>
                  <th className="py-3 px-3 font-semibold text-center">Percentage</th>
                  <th className="py-3 px-4 font-semibold">Audit Remarks</th>
                  <th className="py-3 px-3 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => {
                  const pct = student.marksObtained !== null && examSubjectData?.maxMarks > 0
                    ? ((student.marksObtained / examSubjectData.maxMarks) * 100).toFixed(1)
                    : null;

                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {student.rollNo}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                        {student.studentName}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        {student.sectionName}
                      </td>
                      <td className="py-2.5 px-4 text-center font-mono font-bold text-base">
                        {student.isAbsent ? (
                          <span className="text-red-500 font-semibold text-xs">ABSENT</span>
                        ) : (
                          student.marksObtained ?? "-"
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-xs">
                        {pct ? `${pct}%` : "-"}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {student.remarks || "-"}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge
                          variant={
                            student.status === "PUBLISHED"
                              ? "success"
                              : student.status === "UNDER_REVIEW"
                              ? "warning"
                              : "secondary"
                          }
                          className="text-[10px]"
                        >
                          {student.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenCorrection(student)}
                          disabled={examSubjectData?.examStatus !== "PUBLISHED" || !student.markId}
                          title={examSubjectData?.examStatus !== "PUBLISHED" ? "Corrections are available only for published results" : !student.markId ? "Enter a mark before applying a correction" : "Correct published mark"}
                          className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:text-blue-300"
                        >
                          <History className="h-3 w-3" />
                          Correct Mark
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Modal: Official Mark Correction Workflow */}
        <Dialog open={correctionModalOpen} onOpenChange={setCorrectionModalOpen} title="Official Mark Correction">
          <form onSubmit={handleSubmitCorrection} className="space-y-4">
            <div className="p-3.5 rounded-lg bg-blue-50 text-blue-900 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900 text-xs flex items-start gap-2.5">
              <ShieldAlert className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Audited Result Modification</p>
                <p className="mt-1">
                  All adjustments record previous scores, new values, timestamp, administrator identity, and mandatory justification in the permanent audit ledger.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-slate-500 block">Student:</span>
                <strong>{targetStudent?.studentName}</strong> ({targetStudent?.rollNo})
              </div>
              <div>
                <span className="text-slate-500 block">Course:</span>
                <strong>{examSubjectData?.subjectCode}</strong> ({examSubjectData?.subjectName})
              </div>
              <div>
                <span className="text-slate-500 block">Current Recorded Score:</span>
                <strong className="text-amber-600 font-mono text-sm">
                  {targetStudent?.isAbsent ? "ABSENT" : targetStudent?.marksObtained ?? "Not Entered"}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Maximum Allowed:</span>
                <strong className="font-mono text-sm">{examSubjectData?.maxMarks}</strong>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold">Corrected Marks</label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={isAbsentCorrection}
                      onChange={(e) => setIsAbsentCorrection(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600"
                    />
                    Mark as Absent
                  </label>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={examSubjectData?.maxMarks}
                  step="0.5"
                  value={newMarkValue}
                  onChange={(e) => setNewMarkValue(e.target.value)}
                  disabled={isAbsentCorrection}
                  placeholder={`Enter value between 0 and ${examSubjectData?.maxMarks}`}
                  required={!isAbsentCorrection}
                  className="font-mono text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">
                  Reason for Correction (Required for Audit Compliance)
                </label>
                <textarea
                  rows={3}
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Scrutiny re-check of question 3 subpart B awarded 4 additional marks by HoD."
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCorrectionModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submittingCorrection}>
                {submittingCorrection ? "Recording..." : "Apply & Log Correction"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

export default function AdminMarksPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading marks module...</div>}>
      <AdminMarksContent />
    </React.Suspense>
  );
}
