"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, Search, CheckCircle2, XCircle, Download, FileSpreadsheet } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SessionUser } from "@/lib/types";

export default function AdminStudentsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [students, setStudents] = React.useState<any[]>([]);
  const [academics, setAcademics] = React.useState<any>(null);

  // Search & Filter
  const [search, setSearch] = React.useState("");
  const [batchId, setBatchId] = React.useState("");
  const [semesterId, setSemesterId] = React.useState("");

  // Create Student Modal
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [rollNo, setRollNo] = React.useState("");
  const [enrollmentNo, setEnrollmentNo] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  const [selectedBatchId, setSelectedBatchId] = React.useState("");
  const [selectedSemesterId, setSelectedSemesterId] = React.useState("");
  const [selectedSectionId, setSelectedSectionId] = React.useState("");
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

      const [stuRes, acadRes] = await Promise.all([
        fetch("/api/admin/students"),
        fetch("/api/admin/academics"),
      ]);

      const stuData = await stuRes.json();
      const acadData = await acadRes.json();

      setStudents(stuData.students || []);
      setAcademics(acadData);

      if (acadData.branches?.length > 0) setSelectedBranchId(acadData.branches[0].id);
      if (acadData.batches?.length > 0) setSelectedBatchId(acadData.batches[0].id);
      if (acadData.semesters?.length > 0) setSelectedSemesterId(acadData.semesters[4]?.id || acadData.semesters[0].id);
      if (acadData.sections?.length > 0) setSelectedSectionId(acadData.sections[0].id);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      let url = `/api/admin/students?search=${encodeURIComponent(search)}`;
      if (batchId) url += `&batchId=${batchId}`;
      if (semesterId) url += `&semesterId=${semesterId}`;
      const res = await fetch(url);
      const data = await res.json();
      setStudents(data.students || []);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchStudents();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, batchId, semesterId]);

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreating(true);
      const branch = academics.branches.find((b: any) => b.id === selectedBranchId);
      const deptId = branch?.departmentId || academics.departments[0]?.id;

      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rollNo,
          enrollmentNo,
          firstName,
          lastName,
          email,
          phone,
          departmentId: deptId,
          branchId: selectedBranchId,
          batchId: selectedBatchId,
          currentSemesterId: selectedSemesterId,
          currentSectionId: selectedSectionId,
          password: "Student@12345",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create student.");
      } else {
        alert("Student registered successfully! Default login password: Student@12345");
        setCreateModalOpen(false);
        setRollNo("");
        setEnrollmentNo("");
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        fetchStudents();
      }
      setCreating(false);
    } catch (err) {
      console.error(err);
      alert("Error registering student.");
      setCreating(false);
    }
  };

  const handleToggleActive = async (student: any) => {
    const newStatus = !student.user.isActive;
    const confirmMsg = newStatus
      ? `Re-activate access for ${student.firstName} ${student.lastName}?`
      : `Deactivate account for ${student.firstName} ${student.lastName}? Student will be barred from login.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/students", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: student.id,
          isActive: newStatus,
        }),
      });

      if (res.ok) {
        fetchStudents();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-6 w-6 text-blue-600" />
              Student Profiles & Academic Directory
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Enrollments, batch cohort placements, and student identity administration.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a href="/api/export?format=csv&type=students" download>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </a>
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Add Student
            </Button>
          </div>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, roll, enrollment, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>

            <div>
              <select
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-900">All Batches</option>
                {academics?.batches?.map((b: any) => (
                  <option key={b.id} value={b.id} className="dark:bg-slate-900">
                    {b.name} ({b.branch?.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-900">All Semesters</option>
                {academics?.semesters?.map((s: any) => (
                  <option key={s.id} value={s.id} className="dark:bg-slate-900">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Student Table */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Enrolled Student Roster</CardTitle>
                <CardDescription>Active and inactive student records in the portal</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">{students.length} students</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 font-semibold">Roll No</th>
                  <th className="py-3 px-4 font-semibold">Student Name</th>
                  <th className="py-3 px-3 font-semibold">Enrollment No</th>
                  <th className="py-3 px-3 font-semibold">Branch & Batch</th>
                  <th className="py-3 px-3 font-semibold text-center">Semester / Sec</th>
                  <th className="py-3 px-3 font-semibold text-center">Account Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {student.rollNo}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-white">
                      <div>{student.firstName} {student.lastName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{student.email}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                      {student.enrollmentNo}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      <div>{student.branch?.code}</div>
                      <div className="text-slate-500 text-[11px]">{student.batch?.name}</div>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs">
                      {student.currentSemester?.name} (Sec {student.currentSection?.name || "A"})
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant={student.user?.isActive ? "success" : "destructive"}
                        className="text-[10px]"
                      >
                        {student.user?.isActive ? "Active" : "Deactivated"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(student)}
                        className={`h-7 text-xs ${
                          student.user?.isActive
                            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                            : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {student.user?.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Modal: Add Student */}
        <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen} title="Add New Student Profile">
          <form onSubmit={handleCreateStudent} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Roll Number</label>
                <Input
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value.toUpperCase())}
                  placeholder="e.g. 23CS050"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Enrollment Number</label>
                <Input
                  value={enrollmentNo}
                  onChange={(e) => setEnrollmentNo(e.target.value.toUpperCase())}
                  placeholder="e.g. ENR2023050"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">First Name</label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Rahul"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Last Name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Kumar"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">College Email Address</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  placeholder="e.g. rahul.k@student.college.edu"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Phone Number (Optional)</label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 00000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Branch</label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.branches?.map((b: any) => (
                    <option key={b.id} value={b.id} className="dark:bg-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Batch</label>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.batches?.map((b: any) => (
                    <option key={b.id} value={b.id} className="dark:bg-slate-900">{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Current Semester</label>
                <select
                  value={selectedSemesterId}
                  onChange={(e) => setSelectedSemesterId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.semesters?.map((s: any) => (
                    <option key={s.id} value={s.id} className="dark:bg-slate-900">{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Section</label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.sections?.map((sec: any) => (
                    <option key={sec.id} value={sec.id} className="dark:bg-slate-900">Section {sec.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating..." : "Save Student Profile"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

