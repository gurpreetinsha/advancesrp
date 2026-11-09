"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileCheck2,
  Plus,
  Send,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  BookOpen,
  ArrowRight,
  Eye,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SessionUser } from "@/lib/types";

export default function AdminExaminationsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [examinations, setExaminations] = React.useState<any[]>([]);
  const [academics, setAcademics] = React.useState<any>(null);

  // Modals state
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [publishModalOpen, setPublishModalOpen] = React.useState(false);
  const [unpublishModalOpen, setUnpublishModalOpen] = React.useState(false);
  const [selectedExam, setSelectedExam] = React.useState<any>(null);
  const [unpublishReason, setUnpublishReason] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

  // New Exam Form State
  const [examName, setExamName] = React.useState("");
  const [examDate, setExamDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [academicYearId, setAcademicYearId] = React.useState("");
  const [semesterId, setSemesterId] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [examDescription, setExamDescription] = React.useState("");
  const [subjectConfigs, setSubjectConfigs] = React.useState<Record<string, { selected: boolean; maxMarks: number; passingMarks: number }>>({});

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

      await Promise.all([fetchExaminations(), fetchAcademics()]);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchExaminations = async () => {
    const res = await fetch("/api/examinations");
    const data = await res.json();
    setExaminations(data.examinations || []);
  };

  const fetchAcademics = async () => {
    const res = await fetch("/api/admin/academics");
    const data = await res.json();
    setAcademics(data);

    if (data.academicYears?.length > 0) {
      const curr = data.academicYears.find((y: any) => y.isCurrent) || data.academicYears[0];
      setAcademicYearId(curr.id);
    }
    if (data.semesters?.length > 0) {
      setSemesterId(data.semesters[4]?.id || data.semesters[0].id); // default sem 5
    }
    if (data.batches?.length > 0) {
      setBatchId(data.batches[0].id);
    }

    // Default subject configurations
    const configs: Record<string, { selected: boolean; maxMarks: number; passingMarks: number }> = {};
    (data.subjects || []).forEach((s: any) => {
      configs[s.id] = {
        selected: true,
        maxMarks: s.code.includes("LAB") || s.type === "LAB" ? 50 : 100,
        passingMarks: s.code.includes("LAB") || s.type === "LAB" ? 20 : 40,
      };
    });
    setSubjectConfigs(configs);
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const selectedSubs = Object.entries(subjectConfigs)
        .filter(([_, conf]) => conf.selected)
        .map(([id, conf]) => ({
          subjectId: id,
          maxMarks: Number(conf.maxMarks),
          passingMarks: Number(conf.passingMarks),
        }));

      if (selectedSubs.length === 0) {
        alert("Please select at least one subject for the examination.");
        setActionLoading(false);
        return;
      }

      const res = await fetch("/api/examinations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: examName,
          examDate,
          academicYearId,
          semesterId,
          batchId,
          description: examDescription,
          subjects: selectedSubs,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create examination.");
      } else {
        setCreateModalOpen(false);
        setExamName("");
        setExamDescription("");
        fetchExaminations();
      }
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      alert("Error occurred while creating examination.");
      setActionLoading(false);
    }
  };

  const handlePublishExam = async () => {
    if (!selectedExam) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/examinations/${selectedExam.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to publish examination results.");
      } else {
        alert(data.message);
        setPublishModalOpen(false);
        fetchExaminations();
      }
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      alert("Failed to publish results.");
      setActionLoading(false);
    }
  };

  const handleUnpublishExam = async () => {
    if (!selectedExam || !unpublishReason.trim()) {
      alert("Please specify a reason for unpublishing.");
      return;
    }
    try {
      setActionLoading(true);
      const res = await fetch(`/api/examinations/${selectedExam.id}/unpublish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unpublishReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to unpublish examination results.");
      } else {
        alert(data.message);
        setUnpublishModalOpen(false);
        setUnpublishReason("");
        fetchExaminations();
      }
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      alert("Failed to unpublish results.");
      setActionLoading(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="h-6 w-6 text-blue-600" />
              Examinations & Results Publication
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure internal examinations, manage approval workflows, and publish official results.
            </p>
          </div>

          <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Create Examination
          </Button>
        </div>

        {/* Examination List */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Academic Examinations Catalog</CardTitle>
                <CardDescription>All created internal assessments across batches</CardDescription>
              </div>
              <Badge variant="outline">{examinations.length} total examinations</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Examination Name</th>
                  <th className="py-3 px-3 font-semibold text-center">Date</th>
                  <th className="py-3 px-3 font-semibold text-center">Academic Year</th>
                  <th className="py-3 px-3 font-semibold text-center">Cohort</th>
                  <th className="py-3 px-3 font-semibold text-center">Subjects</th>
                  <th className="py-3 px-3 font-semibold text-center">Enrolled</th>
                  <th className="py-3 px-3 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {examinations.map((exam) => (
                  <tr key={exam.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {exam.name}
                      </span>
                      <span className="text-[11px] text-slate-500 line-clamp-1">
                        {exam.description || "Internal Assessment"}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-xs text-slate-600 dark:text-slate-400 font-mono">
                      {exam.examDate?.split("T")[0]}
                    </td>
                    <td className="py-3 px-3 text-center text-xs font-medium">
                      {exam.academicYear?.name}
                    </td>
                    <td className="py-3 px-3 text-center text-xs">
                      {exam.semester?.name} • {exam.batch?.name}
                    </td>
                    <td className="py-3 px-3 text-center font-mono font-bold">
                      {exam.examSubjects?.length || 0}
                    </td>
                    <td className="py-3 px-3 text-center font-mono">
                      {exam._count?.studentExamEnrollments || 0}
                    </td>
                    <td className="py-3 px-3 text-center">
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
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/dashboard/admin/marks?examId=${exam.id}`}>
                          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1">
                            <Eye className="h-3.5 w-3.5" />
                            Marks
                          </Button>
                        </Link>

                        {exam.status !== "PUBLISHED" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedExam(exam);
                              setPublishModalOpen(true);
                            }}
                            className="h-8 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Publish
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedExam(exam);
                              setUnpublishModalOpen(true);
                            }}
                            className="h-8 px-2 text-xs text-amber-600 border-amber-300 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-950/40 gap-1"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Unpublish
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Modal: Create Examination */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen} title="Create New Examination">
          <form onSubmit={handleCreateExam} className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Examination Name</label>
              <Input
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. Internal Assessment 2, Mid-Semester Examination"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Examination Date</label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Academic Year</label>
                <select
                  value={academicYearId}
                  onChange={(e) => setAcademicYearId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.academicYears?.map((y: any) => (
                    <option key={y.id} value={y.id} className="dark:bg-slate-900">
                      {y.name} {y.isCurrent ? "(Current)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Semester</label>
                <select
                  value={semesterId}
                  onChange={(e) => setSemesterId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.semesters?.map((s: any) => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Batch</label>
                <select
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.batches?.map((b: any) => (
                    <option key={b.id} value={b.id} className="dark:bg-slate-900">
                      {b.name} ({b.branch?.name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Subject Configuration Table */}
            <div>
              <label className="text-xs font-semibold block mb-1.5">
                Configure Subjects & Maximum Marks Thresholds
              </label>
              <div className="border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                {academics?.subjects
                  ?.filter((sub: any) => sub.semesterId === semesterId)
                  .map((sub: any) => {
                    const conf = subjectConfigs[sub.id] || { selected: true, maxMarks: 100, passingMarks: 40 };
                    return (
                      <div key={sub.id} className="p-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={conf.selected}
                            onChange={(e) =>
                              setSubjectConfigs((prev) => ({
                                ...prev,
                                [sub.id]: { ...conf, selected: e.target.checked },
                              }))
                            }
                            className="rounded border-slate-300 text-blue-600"
                          />
                          <span className="font-mono font-bold text-blue-600">{sub.code}</span>
                          <span className="font-medium truncate max-w-[140px]">{sub.name}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Max:</span>
                            <Input
                              type="number"
                              value={conf.maxMarks}
                              onChange={(e) =>
                                setSubjectConfigs((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...conf, maxMarks: Number(e.target.value) },
                                }))
                              }
                              className="h-7 w-16 text-center font-mono text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">Pass:</span>
                            <Input
                              type="number"
                              value={conf.passingMarks}
                              onChange={(e) =>
                                setSubjectConfigs((prev) => ({
                                  ...prev,
                                  [sub.id]: { ...conf, passingMarks: Number(e.target.value) },
                                }))
                              }
                              className="h-7 w-16 text-center font-mono text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Initializing..." : "Create Examination"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Modal: Publish Examination Confirmation */}
        <Dialog open={publishModalOpen} onOpenChange={setPublishModalOpen} title="Publish Examination Results">
          <div className="space-y-4">
            <div className="p-3.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Publication Notice</p>
                <p className="mt-1">
                  Publishing will immediately calculate final competition rankings and make official result reports and downloadable PDFs visible to all enrolled students.
                </p>
              </div>
            </div>

            <div className="text-xs space-y-1">
              <div><strong>Examination:</strong> {selectedExam?.name}</div>
              <div><strong>Academic Cohort:</strong> {selectedExam?.semester?.name} ({selectedExam?.batch?.name})</div>
              <div><strong>Enrolled Students:</strong> {selectedExam?._count?.studentExamEnrollments || 0}</div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPublishModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePublishExam}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {actionLoading ? "Publishing..." : "Confirm & Publish Results"}
              </Button>
            </div>
          </div>
        </Dialog>

        {/* Modal: Unpublish Examination with Mandatory Reason */}
        <Dialog open={unpublishModalOpen} onOpenChange={setUnpublishModalOpen} title="Unpublish Examination Results">
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-red-50 text-red-900 border border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900 text-xs">
              <strong>Audit Requirement:</strong> Unpublishing will withdraw published results from student view and return marks to review status. An immutable audit record will log this action.
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">
                Reason for Unpublishing (Required for Audit Trail)
              </label>
              <textarea
                rows={3}
                value={unpublishReason}
                onChange={(e) => setUnpublishReason(e.target.value)}
                placeholder="e.g. Discrepancy discovered in DBMS theory question marks; recalculating evaluation."
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent p-2 text-xs focus:ring-2 focus:ring-blue-600 focus:outline-none"
                required
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnpublishModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleUnpublishExam}
                disabled={actionLoading || !unpublishReason.trim()}
              >
                {actionLoading ? "Unpublishing..." : "Unpublish Examination"}
              </Button>
            </div>
          </div>
        </Dialog>
      </div>
    </AppShell>
  );
}

