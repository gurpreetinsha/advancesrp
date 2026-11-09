"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Plus, BookOpen, Layers, Building2, Calendar } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SessionUser } from "@/lib/types";

export default function AdminAcademicsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  // New Subject Modal
  const [subjectModalOpen, setSubjectModalOpen] = React.useState(false);
  const [subCode, setSubCode] = React.useState("");
  const [subName, setSubName] = React.useState("");
  const [subCredits, setSubCredits] = React.useState("4.0");
  const [subType, setSubType] = React.useState("THEORY");
  const [subSemesterId, setSubSemesterId] = React.useState("");
  const [subBranchId, setSubBranchId] = React.useState("");
  const [creating, setCreating] = React.useState(false);

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

      await fetchAcademics();
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchAcademics = async () => {
    const res = await fetch("/api/admin/academics");
    const acadData = await res.json();
    setData(acadData);

    if (acadData.branches?.length > 0) setSubBranchId(acadData.branches[0].id);
    if (acadData.semesters?.length > 0) setSubSemesterId(acadData.semesters[4]?.id || acadData.semesters[0].id);
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const res = await fetch("/api/admin/academics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: "SUBJECT",
          data: {
            code: subCode,
            name: subName,
            credits: Number(subCredits),
            type: subType,
            branchId: subBranchId,
            semesterId: subSemesterId,
          },
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        alert(resData.error || "Failed to create course.");
      } else {
        setSubjectModalOpen(false);
        setSubCode("");
        setSubName("");
        fetchAcademics();
      }
      setCreating(false);
    } catch (err) {
      console.error(err);
      alert("Error creating subject.");
      setCreating(false);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-600" />
              Academic Structure & Courses Catalog
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Departments, academic years, branches, batches, semesters, and course curriculum.
            </p>
          </div>

          <Button onClick={() => setSubjectModalOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Add New Subject Course
          </Button>
        </div>

        {/* Structure Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs font-semibold uppercase">Departments</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-extrabold text-blue-600">{data?.departments?.length || 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {data?.departments?.map((d: any) => d.code).join(", ")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs font-semibold uppercase">Degree Branches</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-extrabold text-indigo-600">{data?.branches?.length || 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {data?.branches?.map((b: any) => b.code).join(", ")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs font-semibold uppercase">Batches & Cohorts</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-extrabold text-emerald-600">{data?.batches?.length || 0}</div>
              <div className="text-[11px] text-slate-500 mt-1">
                {data?.batches?.map((b: any) => b.name).join(", ")}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-1">
              <CardDescription className="text-xs font-semibold uppercase">Current Academic Year</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-xl font-extrabold text-slate-900 dark:text-white">
                {data?.academicYears?.find((y: any) => y.isCurrent)?.name || "2025-2026"}
              </div>
              <div className="text-[11px] text-emerald-600 font-medium mt-1">Active Session</div>
            </CardContent>
          </Card>
        </div>

        {/* Subjects Catalog */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  Curriculum Subjects & Course Codes
                </CardTitle>
                <CardDescription>Courses mapped to academic semesters and branches</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">{data?.subjects?.length || 0} courses</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Subject Code</th>
                  <th className="py-3 px-4 font-semibold">Subject Title</th>
                  <th className="py-3 px-3 font-semibold text-center">Credits</th>
                  <th className="py-3 px-3 font-semibold text-center">Course Type</th>
                  <th className="py-3 px-3 font-semibold text-center">Semester</th>
                  <th className="py-3 px-4 font-semibold">Degree Branch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {data?.subjects?.map((sub: any) => (
                  <tr key={sub.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {sub.code}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      {sub.name}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">{sub.credits}</td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {sub.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs font-semibold">
                      {sub.semester?.name}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-500">
                      {sub.branch?.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Modal: Add Subject */}
        <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen} title="Add Curriculum Course">
          <form onSubmit={handleCreateSubject} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Subject Code</label>
                <Input
                  value={subCode}
                  onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CS506"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Subject Title</label>
                <Input
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="e.g. Artificial Intelligence"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Credits</label>
                <Input
                  type="number"
                  step="0.5"
                  value={subCredits}
                  onChange={(e) => setSubCredits(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Type</label>
                <select
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="THEORY" className="dark:bg-slate-900">THEORY</option>
                  <option value="LAB" className="dark:bg-slate-900">LAB</option>
                  <option value="ELECTIVE" className="dark:bg-slate-900">ELECTIVE</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Semester</label>
                <select
                  value={subSemesterId}
                  onChange={(e) => setSubSemesterId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {data?.semesters?.map((s: any) => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-900">{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Degree Branch</label>
                <select
                  value={subBranchId}
                  onChange={(e) => setSubBranchId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {data?.branches?.map((b: any) => (
                    <option key={b.id} value={b.id} className="dark:bg-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setSubjectModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Adding..." : "Save Subject"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

