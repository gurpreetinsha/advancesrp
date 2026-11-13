"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Briefcase, Plus, BookOpen, UserCheck, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { SessionUser } from "@/lib/types";

export default function AdminFacultyPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [facultyList, setFacultyList] = React.useState<any[]>([]);
  const [academics, setAcademics] = React.useState<any>(null);

  // Modals
  const [createFacultyOpen, setCreateFacultyOpen] = React.useState(false);
  const [assignModalOpen, setAssignModalOpen] = React.useState(false);
  const [selectedFaculty, setSelectedFaculty] = React.useState<any>(null);

  // New Faculty Form
  const [empCode, setEmpCode] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [designation, setDesignation] = React.useState("Assistant Professor");
  const [departmentId, setDepartmentId] = React.useState("");

  // Assign Subject Form
  const [assignSubjectId, setAssignSubjectId] = React.useState("");
  const [assignSemesterId, setAssignSemesterId] = React.useState("");
  const [assignSectionId, setAssignSectionId] = React.useState("");
  const [assignAcademicYearId, setAssignAcademicYearId] = React.useState("");
  const [actionLoading, setActionLoading] = React.useState(false);

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

      await Promise.all([fetchFaculty(), fetchAcademics()]);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchFaculty = async () => {
    const res = await fetch("/api/admin/faculty");
    const data = await res.json();
    setFacultyList(data.faculty || []);
  };

  const fetchAcademics = async () => {
    const res = await fetch("/api/admin/academics");
    const data = await res.json();
    setAcademics(data);
    if (data.departments?.length > 0) setDepartmentId(data.departments[0].id);
    if (data.subjects?.length > 0) setAssignSubjectId(data.subjects[0].id);
    if (data.semesters?.length > 0) setAssignSemesterId(data.semesters[4]?.id || data.semesters[0].id);
    if (data.academicYears?.length > 0) {
      const curr = data.academicYears.find((y: any) => y.isCurrent) || data.academicYears[0];
      setAssignAcademicYearId(curr.id);
    }
  };

  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/faculty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeCode: empCode,
          firstName,
          lastName,
          email,
          phone,
          designation,
          departmentId,
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create faculty.");
      } else {
        alert("Faculty account created. Share the initial password securely with the faculty member.");
        setCreateFacultyOpen(false);
        setEmpCode("");
        setFirstName("");
        setLastName("");
        setEmail("");
        setPhone("");
        setPassword("");
        fetchFaculty();
      }
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      alert("Error creating faculty.");
      setActionLoading(false);
    }
  };

  const handleAssignSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFaculty) return;
    try {
      setActionLoading(true);
      const res = await fetch("/api/admin/faculty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ASSIGN",
          facultyId: selectedFaculty.id,
          subjectId: assignSubjectId,
          semesterId: assignSemesterId,
          sectionId: assignSectionId || null,
          academicYearId: assignAcademicYearId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to create assignment.");
      } else {
        setAssignModalOpen(false);
        fetchFaculty();
      }
      setActionLoading(false);
    } catch (err) {
      console.error(err);
      alert("Error assigning subject.");
      setActionLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!confirm("Remove this course assignment from the faculty member?")) return;
    try {
      const res = await fetch("/api/admin/faculty", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REMOVE",
          assignmentId,
        }),
      });
      if (res.ok) fetchFaculty();
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
              <Briefcase className="h-6 w-6 text-blue-600" />
              Faculty Roster & Course Assignments
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure teaching permissions, evaluators, and section assignments.
            </p>
          </div>

          <Button onClick={() => setCreateFacultyOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            Add Faculty Member
          </Button>
        </div>

        {/* Faculty Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {facultyList.map((f) => (
            <Card key={f.id} className="flex flex-col justify-between">
              <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base font-bold">
                      {f.firstName} {f.lastName}
                    </CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      {f.designation} • Dept of {f.department?.code}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    {f.employeeCode}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 flex-1">
                <div className="text-xs text-slate-500 mb-2">
                  Email: <span className="font-mono text-slate-800 dark:text-slate-200">{f.email}</span>
                  {f.phone && <span> • Phone: {f.phone}</span>}
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Assigned Subjects & Classes ({f.assignments?.length || 0})
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFaculty(f);
                        setAssignModalOpen(true);
                      }}
                      className="h-6 px-2 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      + Assign Course
                    </Button>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {f.assignments?.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic">No assigned subjects.</div>
                    ) : (
                      f.assignments?.map((a: any) => (
                        <div
                          key={a.id}
                          className="p-2 rounded border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-blue-600">{a.subject.code}</span>{" "}
                            <span className="font-medium">{a.subject.name}</span>
                            <div className="text-[10px] text-slate-500">
                              {a.semester.name} • Section {a.section?.name || "All"}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemoveAssignment(a.id)}
                            className="text-slate-400 hover:text-red-600 p-1"
                            title="Remove assignment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Modal: Create Faculty */}
        <Dialog open={createFacultyOpen} onOpenChange={setCreateFacultyOpen} title="Add Faculty Member">
          <form onSubmit={handleCreateFaculty} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Employee Code</label>
                <Input
                  value={empCode}
                  onChange={(e) => setEmpCode(e.target.value.toUpperCase())}
                  placeholder="e.g. EMP-CSE-005"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Designation</label>
                <Input
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="e.g. Assistant Professor, HoD"
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
                  placeholder="e.g. Vikram"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Last Name</label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Singhania"
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
                  placeholder="prof.singhania@college.edu"
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

            <div>
              <label className="text-xs font-semibold block mb-1">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                {academics?.departments?.map((d: any) => (
                  <option key={d.id} value={d.id} className="dark:bg-slate-900">{d.name} ({d.code})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1">Initial password (minimum 12 characters)</label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={12} autoComplete="new-password" required />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateFacultyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Saving..." : "Create Account"}
              </Button>
            </div>
          </form>
        </Dialog>

        {/* Modal: Assign Subject */}
        <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen} title={`Assign Subject to ${selectedFaculty?.firstName} ${selectedFaculty?.lastName}`}>
          <form onSubmit={handleAssignSubject} className="space-y-4">
            <div>
              <label className="text-xs font-semibold block mb-1">Subject Course</label>
              <select
                value={assignSubjectId}
                onChange={(e) => setAssignSubjectId(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                {academics?.subjects?.map((s: any) => (
                  <option key={s.id} value={s.id} className="dark:bg-slate-900">
                    {s.code} - {s.name} ({s.semester?.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Semester</label>
                <select
                  value={assignSemesterId}
                  onChange={(e) => setAssignSemesterId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  {academics?.semesters?.map((sem: any) => (
                    <option key={sem.id} value={sem.id} className="dark:bg-slate-900">
                      {sem.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Section (Optional)</label>
                <select
                  value={assignSectionId}
                  onChange={(e) => setAssignSectionId(e.target.value)}
                  className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
                >
                  <option value="" className="dark:bg-slate-900">All Sections</option>
                  {academics?.sections?.map((sec: any) => (
                    <option key={sec.id} value={sec.id} className="dark:bg-slate-900">Section {sec.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setAssignModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Assigning..." : "Confirm Assignment"}
              </Button>
            </div>
          </form>
        </Dialog>
      </div>
    </AppShell>
  );
}

