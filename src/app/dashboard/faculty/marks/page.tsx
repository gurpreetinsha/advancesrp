"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PenSquare,
  FileSpreadsheet,
  Download,
  Upload,
  Save,
  Send,
  AlertCircle,
  CheckCircle2,
  FileText,
  Filter,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SessionUser } from "@/lib/types";

function FacultyMarksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<"manual" | "import">("manual");

  // Filter selections
  const [examinations, setExaminations] = React.useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = React.useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = React.useState<string>("");
  const [selectedSectionId, setSelectedSectionId] = React.useState<string>("");

  // Data for selected exam & subject
  const [examSubjectData, setExamSubjectData] = React.useState<any>(null);
  const [students, setStudents] = React.useState<any[]>([]);
  const [editedMarks, setEditedMarks] = React.useState<Record<string, { marks: string; isAbsent: boolean; remarks: string }>>({});

  // Status & Feedback
  const [saving, setSaving] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Import State
  const [csvContent, setCsvContent] = React.useState("");
  const [importPreview, setImportPreview] = React.useState<any>(null);
  const [importing, setImporting] = React.useState(false);

  React.useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const meRes = await fetch("/api/auth/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      const meData = await meRes.json();
      if (meData.user.role !== "FACULTY" && meData.user.role !== "ADMIN") {
        router.push("/dashboard/student");
        return;
      }
      setUser(meData.user);

      // Fetch exams
      const examsRes = await fetch("/api/examinations");
      const examsData = await examsRes.json();
      const examList = examsData.examinations || [];
      setExaminations(examList);

      const queryExamId = searchParams.get("examId");
      if (queryExamId && examList.some((e: any) => e.id === queryExamId)) {
        setSelectedExamId(queryExamId);
      } else if (examList.length > 0) {
        setSelectedExamId(examList[0].id);
      }

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  // When selectedExamId changes, auto-select first subject
  React.useEffect(() => {
    if (!selectedExamId) return;
    const currentExam = examinations.find((e) => e.id === selectedExamId);
    if (currentExam && currentExam.examSubjects?.length > 0) {
      setSelectedSubjectId(currentExam.examSubjects[0].subject.id);
    }
  }, [selectedExamId, examinations]);

  // Load marks whenever examId, subjectId, or sectionId changes
  React.useEffect(() => {
    if (selectedExamId && selectedSubjectId) {
      fetchMarksGrid();
    }
  }, [selectedExamId, selectedSubjectId, selectedSectionId]);

  const fetchMarksGrid = async () => {
    try {
      setStatusMessage(null);
      let url = `/api/marks?examId=${selectedExamId}&subjectId=${selectedSubjectId}`;
      if (selectedSectionId) url += `&sectionId=${selectedSectionId}`;

      const res = await fetch(url);
      const resData = await res.json();

      if (!res.ok) {
        setStatusMessage({ type: "error", text: resData.error || "Failed to load marks" });
        return;
      }

      setExamSubjectData(resData.examSubject);
      setStudents(resData.students || []);

      // Initialize editedMarks map
      const initialMap: Record<string, { marks: string; isAbsent: boolean; remarks: string }> = {};
      (resData.students || []).forEach((s: any) => {
        initialMap[s.studentId] = {
          marks: s.marksObtained !== null && s.marksObtained !== undefined ? s.marksObtained.toString() : "",
          isAbsent: s.isAbsent || false,
          remarks: s.remarks || "",
        };
      });
      setEditedMarks(initialMap);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: "error", text: "Network error loading student marks grid" });
    }
  };

  const handleMarkChange = (studentId: string, value: string) => {
    setEditedMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        marks: value,
      },
    }));
  };

  const handleAbsentToggle = (studentId: string, checked: boolean) => {
    setEditedMarks((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        isAbsent: checked,
        marks: checked ? "" : prev[studentId]?.marks || "",
      },
    }));
  };

  const handleSaveMarks = async (submitForReview = false) => {
    if (!examSubjectData) return;
    try {
      setSaving(true);
      setStatusMessage(null);

      const maxMarks = examSubjectData.maxMarks;
      const marksPayload: any[] = [];

      // Validate on client before submitting
      for (const s of students) {
        const entry = editedMarks[s.studentId];
        if (!entry) continue;

        if (!entry.isAbsent && entry.marks.trim() !== "") {
          const num = Number(entry.marks);
          if (isNaN(num)) {
            setStatusMessage({ type: "error", text: `Invalid mark '${entry.marks}' for ${s.studentName}. Must be a valid number.` });
            setSaving(false);
            return;
          }
          if (num < 0 || num > maxMarks) {
            setStatusMessage({ type: "error", text: `Marks for ${s.studentName} (${num}) must be between 0 and maximum ${maxMarks}.` });
            setSaving(false);
            return;
          }
          marksPayload.push({
            studentId: s.studentId,
            marksObtained: num,
            isAbsent: false,
            remarks: entry.remarks,
          });
        } else if (entry.isAbsent) {
          marksPayload.push({
            studentId: s.studentId,
            marksObtained: null,
            isAbsent: true,
            remarks: entry.remarks || "Absent",
          });
        }
      }

      if (marksPayload.length === 0) {
        setStatusMessage({ type: "error", text: "No marks entries to save." });
        setSaving(false);
        return;
      }

      const res = await fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSubjectId: examSubjectData.id,
          marks: marksPayload,
          submitForReview,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: "error", text: resData.error || "Failed to save marks." });
      } else {
        setStatusMessage({ type: "success", text: resData.message });
        fetchMarksGrid();
      }
      setSaving(false);
    } catch (err) {
      console.error(err);
      setStatusMessage({ type: "error", text: "An error occurred while saving marks." });
      setSaving(false);
    }
  };

  const handlePreviewImport = async () => {
    if (!examSubjectData || !csvContent.trim()) {
      alert("Please select a subject and paste CSV content first.");
      return;
    }

    try {
      setImporting(true);
      const res = await fetch("/api/marks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSubjectId: examSubjectData.id,
          csvContent,
          commit: false,
        }),
      });

      const data = await res.json();
      setImportPreview(data);
      setImporting(false);
    } catch (err) {
      console.error(err);
      alert("Import preview failed.");
      setImporting(false);
    }
  };

  const handleCommitImport = async () => {
    if (!examSubjectData || !csvContent.trim()) return;

    try {
      setImporting(true);
      const res = await fetch("/api/marks/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          examSubjectId: examSubjectData.id,
          csvContent,
          commit: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Import commit failed.");
      } else {
        setStatusMessage({ type: "success", text: data.message });
        setCsvContent("");
        setImportPreview(null);
        setActiveTab("manual");
        fetchMarksGrid();
      }
      setImporting(false);
    } catch (err) {
      console.error(err);
      alert("Error committing import.");
      setImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    if (!students || students.length === 0) return;
    const header = "Roll No,Student Name,Marks Obtained,Is Absent (yes/no),Remarks\n";
    const rows = students.map((s) => `${s.rollNo},"${s.studentName}",,,`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${examSubjectData?.subjectCode || "Subject"}_Marks_Template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentExam = examinations.find((e) => e.id === selectedExamId);

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        {/* Header & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <PenSquare className="h-6 w-6 text-blue-600" />
              Marks Management & Evaluation
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enter internal examination scores manually or bulk upload via spreadsheet.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "manual" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("manual")}
              className="gap-1.5"
            >
              <PenSquare className="h-4 w-4" />
              Manual Table
            </Button>
            <Button
              variant={activeTab === "import" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("import")}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Bulk CSV Import
            </Button>
          </div>
        </div>

        {/* Filter Toolbar Card */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                  Examination
                </label>
                <select
                  value={selectedExamId}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  Assigned Subject
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
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
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="" className="dark:bg-slate-900">All Sections</option>
                  <option value="A" className="dark:bg-slate-900">Section A</option>
                  <option value="B" className="dark:bg-slate-900">Section B</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Feedback message banner */}
        {statusMessage && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-center gap-2 border ${
              statusMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* TAB 1: Manual Marks Grid */}
        {activeTab === "manual" && (
          <Card>
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold">
                      {examSubjectData?.subjectCode}: {examSubjectData?.subjectName}
                    </CardTitle>
                    <Badge variant="outline">
                      Max Marks: {examSubjectData?.maxMarks} • Passing: {examSubjectData?.passingMarks}
                    </Badge>
                  </div>
                  <CardDescription className="mt-1">
                    Exam Status: <strong className="uppercase">{examSubjectData?.examStatus}</strong> • Total Enrolled: {students.length} students
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSaveMarks(false)}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" />
                    Save Draft
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveMarks(true)}
                    disabled={saving}
                    className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Submit for Review
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Roll No</th>
                    <th className="py-3 px-4 font-semibold">Student Name</th>
                    <th className="py-3 px-3 font-semibold text-center">Section</th>
                    <th className="py-3 px-4 font-semibold text-center w-36">Marks (0 - {examSubjectData?.maxMarks})</th>
                    <th className="py-3 px-3 font-semibold text-center">Absent?</th>
                    <th className="py-3 px-4 font-semibold">Remarks / Notes</th>
                    <th className="py-3 px-3 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {students.map((student) => {
                    const markData = editedMarks[student.studentId] || { marks: "", isAbsent: false, remarks: "" };
                    return (
                      <tr key={student.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 font-mono font-bold text-slate-900 dark:text-white">
                          {student.rollNo}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {student.studentName}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {student.sectionName}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <Input
                            type="number"
                            min="0"
                            max={examSubjectData?.maxMarks}
                            step="0.5"
                            value={markData.marks}
                            onChange={(e) => handleMarkChange(student.studentId, e.target.value)}
                            disabled={markData.isAbsent}
                            placeholder={markData.isAbsent ? "ABSENT" : `Max ${examSubjectData?.maxMarks}`}
                            className={`h-8 text-center font-mono text-sm font-semibold ${
                              markData.isAbsent ? "bg-slate-100 dark:bg-slate-800 opacity-60" : ""
                            }`}
                          />
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={markData.isAbsent}
                            onChange={(e) => handleAbsentToggle(student.studentId, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="py-2.5 px-4">
                          <Input
                            type="text"
                            value={markData.remarks}
                            onChange={(e) =>
                              setEditedMarks((prev) => ({
                                ...prev,
                                [student.studentId]: {
                                  ...prev[student.studentId],
                                  remarks: e.target.value,
                                },
                              }))
                            }
                            placeholder="Optional note"
                            className="h-8 text-xs"
                          />
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* TAB 2: Bulk CSV Import */}
        {activeTab === "import" && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      Bulk Import Marks for {examSubjectData?.subjectCode}
                    </CardTitle>
                    <CardDescription>
                      Upload or paste CSV spreadsheet records. Pre-flight engine validates duplicates, bounds, and missing IDs.
                    </CardDescription>
                  </div>

                  <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5">
                    <Download className="h-4 w-4" />
                    Download CSV Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Paste CSV Data (or open template in Excel and paste contents here):
                  </label>
                  <textarea
                    rows={8}
                    value={csvContent}
                    onChange={(e) => setCsvContent(e.target.value)}
                    placeholder="Roll No,Student Name,Marks Obtained,Is Absent,Remarks&#10;23CS001,Aarav Patel,92,no,Mid-term top&#10;23CS002,Ananya Sharma,85,no,Great work"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-3 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <Button
                    onClick={handlePreviewImport}
                    disabled={importing || !csvContent.trim()}
                    className="gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {importing ? "Validating..." : "Validate & Preview Records"}
                  </Button>
                </div>

                {/* Import Validation Results Preview */}
                {importPreview && (
                  <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={importPreview.errorCount === 0 ? "success" : "destructive"}>
                          {importPreview.errorCount === 0 ? "Ready to Import" : `${importPreview.errorCount} Validation Errors`}
                        </Badge>
                        <span className="text-xs text-slate-600 dark:text-slate-300">
                          {importPreview.validCount} valid records found out of {importPreview.totalRowsParsed} total rows.
                        </span>
                      </div>

                      {importPreview.validCount > 0 && (
                        <Button
                          size="sm"
                          onClick={handleCommitImport}
                          disabled={importing}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Commit {importPreview.validCount} Valid Records
                        </Button>
                      )}
                    </div>

                    {/* Error breakdown table if any errors found */}
                    {importPreview.errors?.length > 0 && (
                      <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/40">
                        <div className="font-semibold text-red-800 dark:text-red-300 mb-1">
                          Validation Error Log (These rows will be rejected):
                        </div>
                        <ul className="list-disc pl-5 space-y-1 text-red-700 dark:text-red-300 max-h-40 overflow-y-auto">
                          {importPreview.errors.map((err: any, idx: number) => (
                            <li key={idx}>
                              Line {err.row}: {err.rollNo ? `[${err.rollNo}] ` : ""}{err.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function FacultyMarksPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-center text-xs text-slate-500">Loading marks module...</div>}>
      <FacultyMarksContent />
    </React.Suspense>
  );
}
