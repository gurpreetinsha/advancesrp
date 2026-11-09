"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Lock, Mail, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);


    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Authentication failed. Please check your credentials.");
        setLoading(false);
        return;
      }

      // Route directly to role-specific dashboard
      const role = data.user.role;
      if (role === "ADMIN") {
        router.push("/dashboard/admin");
      } else if (role === "FACULTY") {
        router.push("/dashboard/faculty");
      } else {
        router.push("/dashboard/student");
      }
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Network or server error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-8">
      {/* Top Bar with Branding and Theme Toggle */}
      <div className="flex items-center justify-between max-w-6xl w-full mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              SRGC
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Student Result Portal (SRP)
            </p>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Login Area */}
      <div className="max-w-md w-full mx-auto my-auto pt-6 pb-12">
        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="space-y-1 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Sign In to SRP</CardTitle>

            </div>
            <CardDescription>
              Enter your college credentials to access examination results and performance reports.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900">
                {error}
              </div>
            )}

            <form onSubmit={(e) => handleSubmit(e)} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  College Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="email"
                    placeholder="Enter your registered college email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-9"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    type="password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-9"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading ? "Authenticating..." : "Sign In to Portal"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            {/* Quick Demo Login Shortcuts */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Instant Demo Access
                </span>
                <span className="text-[10px] text-slate-400">One-click sign-in</span>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleQuickLogin("admin@college.edu", "Admin@12345")}
                  className="flex items-center justify-between p-2 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue-600" />
                    <div>
                      <span className="font-semibold block">College Administrator</span>
                      <span className="text-[10px] text-slate-500">Full control & publication</span>
                    </div>
                  </div>
                  <Badge variant="default" className="text-[10px]">Admin</Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("prof.sharma@college.edu", "Faculty@12345")}
                  className="flex items-center justify-between p-2 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-amber-600" />
                    <div>
                      <span className="font-semibold block">Dr. Rajesh Sharma (Faculty)</span>
                      <span className="text-[10px] text-slate-500">Marks entry & CSV import</span>
                    </div>
                  </div>
                  <Badge variant="warning" className="text-[10px]">Faculty</Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("aarav.patel@student.college.edu", "Student@12345")}
                  className="flex items-center justify-between p-2 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    <div>
                      <span className="font-semibold block">Aarav Patel (Student)</span>
                      <span className="text-[10px] text-slate-500">Sec A Rank 1 | 91.56%</span>
                    </div>
                  </div>
                  <Badge variant="success" className="text-[10px]">Student</Badge>
                </button>

                <button
                  type="button"
                  onClick={() => handleQuickLogin("diya.reddy@student.college.edu", "Student@12345")}
                  className="flex items-center justify-between p-2 rounded-lg text-left text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800/60 dark:hover:bg-slate-800 dark:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    <div>
                      <span className="font-semibold block">Diya Reddy (Student)</span>
                      <span className="text-[10px] text-slate-500">Batch Rank 1 | 94.44%</span>
                    </div>
                  </div>
                  <Badge variant="success" className="text-[10px]">Student</Badge>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 max-w-6xl w-full mx-auto pt-6 border-t border-slate-200 dark:border-slate-800">
        © 2026 SRGC. All rights reserved.
      </footer>
    </div>
  );
}

