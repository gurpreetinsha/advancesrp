"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { History, ShieldCheck, Filter, Search, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { SessionUser } from "@/lib/types";

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<any[]>([]);
  const [actionFilter, setActionFilter] = React.useState("");
  const [entityFilter, setEntityFilter] = React.useState("");

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

      await fetchLogs();
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      let url = "/api/admin/audit-logs?limit=100";
      if (actionFilter) url += `&action=${actionFilter}`;
      if (entityFilter) url += `&entityType=${entityFilter}`;
      const res = await fetch(url);
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      console.error(err);
    }
  };

  React.useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("PUBLISH")) return "success";
    if (action.includes("CORRECT") || action.includes("UNPUBLISH")) return "warning";
    if (action.includes("DELETE") || action.includes("REMOVE")) return "destructive";
    return "secondary";
  };

  return (
    <AppShell user={user}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-6 w-6 text-slate-700 dark:text-slate-300" />
              Immutable System Audit Trail
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Complete tamper-evident log of authentication events, mark changes, approvals, and publication.
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => fetchLogs()} className="gap-1.5 self-start sm:self-center">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh Logs
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Filter by Action Type
              </label>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-900">All System Actions</option>
                <option value="USER_LOGIN" className="dark:bg-slate-900">USER_LOGIN</option>
                <option value="MARKS_SAVED_DRAFT" className="dark:bg-slate-900">MARKS_SAVED_DRAFT</option>
                <option value="MARKS_SUBMITTED_FOR_REVIEW" className="dark:bg-slate-900">MARKS_SUBMITTED_FOR_REVIEW</option>
                <option value="MARKS_CSV_IMPORTED" className="dark:bg-slate-900">MARKS_CSV_IMPORTED</option>
                <option value="RESULT_PUBLISHED" className="dark:bg-slate-900">RESULT_PUBLISHED</option>
                <option value="RESULT_UNPUBLISHED" className="dark:bg-slate-900">RESULT_UNPUBLISHED</option>
                <option value="RESULT_CORRECTED" className="dark:bg-slate-900">RESULT_CORRECTED</option>
                <option value="STUDENT_CREATED" className="dark:bg-slate-900">STUDENT_CREATED</option>
                <option value="FACULTY_CREATED" className="dark:bg-slate-900">FACULTY_CREATED</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Filter by Entity Type
              </label>
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="w-full text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value="" className="dark:bg-slate-900">All Entities</option>
                <option value="Examination" className="dark:bg-slate-900">Examination</option>
                <option value="ExamSubject" className="dark:bg-slate-900">ExamSubject</option>
                <option value="Mark" className="dark:bg-slate-900">Mark</option>
                <option value="Student" className="dark:bg-slate-900">Student</option>
                <option value="Faculty" className="dark:bg-slate-900">Faculty</option>
                <option value="User" className="dark:bg-slate-900">User</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Chronological Audit Events</CardTitle>
                <CardDescription>Records are permanently retained and cannot be deleted</CardDescription>
              </div>
              <Badge variant="outline" className="font-mono">{logs.length} logged events</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-sans">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">User</th>
                  <th className="py-2.5 px-3 font-semibold">Action</th>
                  <th className="py-2.5 px-3 font-semibold">Entity</th>
                  <th className="py-2.5 px-4 font-semibold font-sans">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900 dark:text-white font-medium">
                      {log.user ? (
                        <div>
                          <span>{log.user.email}</span>
                          <span className="text-[10px] text-slate-400 block font-sans">Role: {log.user.role}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">System</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={getActionBadgeVariant(log.action)} className="text-[10px] font-sans">
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                      {log.entityType}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300 font-sans text-[11px] max-w-md">
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

