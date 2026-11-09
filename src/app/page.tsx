import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  GraduationCap,
  ShieldCheck,
  Award,
  BarChart3,
  FileCheck2,
  Lock,
  ArrowRight,
  CheckCircle2,
  BookOpen,
  School,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export default async function HomePage() {
  const session = await getSession();

  // If already authenticated, redirect to appropriate dashboard
  if (session) {
    if (session.role === "ADMIN") redirect("/dashboard/admin");
    if (session.role === "FACULTY") redirect("/dashboard/faculty");
    if (session.role === "STUDENT") redirect("/dashboard/student");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight block">
                Apex Institute of Technology
              </span>
              <span className="text-[11px] text-slate-500 uppercase tracking-wider block">
                Student Result Portal (SRP)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/login">
              <Button size="sm" className="gap-2">
                Sign In to Portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="px-6 py-16 sm:py-24 max-w-7xl mx-auto text-center">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs border-blue-200 text-blue-700 dark:border-blue-800 dark:text-blue-300">
            Autonomous College Examination System • Version 2.4.0
          </Badge>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto text-balance">
            Centralized Academic Examination Results & Ranking Engine
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-pretty">
            Secure, verifiable internal examination results, competition ranking calculations, and instant printable PDF transcripts for students, faculty, and administration.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="w-full sm:w-auto gap-2 px-8 shadow-md">
                Access Student Portal
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Faculty & Administration Login
              </Button>
            </Link>
          </div>

          {/* Quick Metrics Bar */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-3xl font-extrabold text-blue-600">100%</div>
              <div className="mt-1 text-xs text-slate-500 font-medium">Server Validated Ranks</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-3xl font-extrabold text-emerald-600">1, 2, 2, 4</div>
              <div className="mt-1 text-xs text-slate-500 font-medium">Competition Ranking Ties</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-3xl font-extrabold text-indigo-600">PDF</div>
              <div className="mt-1 text-xs text-slate-500 font-medium">Instant Official Transcripts</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="text-3xl font-extrabold text-amber-600">RBAC</div>
              <div className="mt-1 text-xs text-slate-500 font-medium">Immutable Audit Trail</div>
            </div>
          </div>
        </section>

        {/* Mandatory Tagline Reveal Section */}
        <section className="border-y border-slate-200 bg-white py-16 px-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Every mark counted. Every rank calculated with precision.
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Engineered specifically for engineering and professional colleges to eliminate grading disputes, automate batch standings, and provide instant transparent feedback.
            </p>
          </div>
        </section>

        {/* Role Pillars Section */}
        <section className="px-6 py-16 sm:py-24 max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Built for the Complete Academic Lifecycle</h2>
            <p className="mt-2 text-sm text-slate-500">Separation of concerns enforced on the database and API layer.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 mb-4">
                <GraduationCap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Students</h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Access private published results with grades and SGPA</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>View subject-wise, class-wise, and batch-wise ranks</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Generate official print-ready PDF result statements</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 mb-4">
                <FileCheck2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Faculty Members</h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Enter marks manually or upload CSV templates in bulk</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Instant validation of student IDs, bounds, and duplicates</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Save drafts and submit marks for administrative review</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 mb-4">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold">Administrators</h3>
              <ul className="mt-4 space-y-2.5 text-xs text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Review and publish results with one-click verification</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Authorized mark correction workflow with reason tracking</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Export rankings to CSV and Excel with full audit logs</span>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>Apex Institute of Technology & Engineering — Student Result Portal (SRP)</div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:underline">Portal Sign In</Link>
            <span>•</span>
            <span>Security & Compliance</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

