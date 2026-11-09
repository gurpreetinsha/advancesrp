"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileCheck2,
  PenSquare,
  Award,
  Users,
  Briefcase,
  GraduationCap,
  History,
  FileSpreadsheet,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { SessionUser } from "@/lib/types";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function Sidebar({ user }: { user: SessionUser | null }) {
  const pathname = usePathname();

  if (!user) return null;

  let navItems: NavItem[] = [];

  if (user.role === "ADMIN") {
    navItems = [
      { title: "Dashboard Overview", href: "/dashboard/admin", icon: LayoutDashboard },
      { title: "Examinations & Results", href: "/dashboard/admin/examinations", icon: FileCheck2 },
      { title: "Marks & Corrections", href: "/dashboard/admin/marks", icon: PenSquare },
      { title: "Academic Rankings", href: "/dashboard/admin/rankings", icon: Award },
      { title: "Students Management", href: "/dashboard/admin/students", icon: Users },
      { title: "Faculty Management", href: "/dashboard/admin/faculty", icon: Briefcase },
      { title: "Academic Structure", href: "/dashboard/admin/academics", icon: GraduationCap },
      { title: "Audit Trail", href: "/dashboard/admin/audit-logs", icon: History },
    ];
  } else if (user.role === "FACULTY") {
    navItems = [
      { title: "Faculty Dashboard", href: "/dashboard/faculty", icon: LayoutDashboard },
      { title: "Marks Entry & Import", href: "/dashboard/faculty/marks", icon: PenSquare },
      { title: "Class & Subject Rankings", href: "/dashboard/faculty/rankings", icon: Award },
    ];
  } else if (user.role === "STUDENT") {
    navItems = [
      { title: "My Examination Results", href: "/dashboard/student", icon: Award },
    ];
  }

  return (
    <aside className="hidden md:flex h-[calc(100vh-4rem)] w-64 flex-col border-r border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="mb-4 px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
        <span>Navigation</span>
        <span className="text-[10px] font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
          {user.role}
        </span>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm font-semibold"
                  : "text-slate-700 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-500 dark:text-slate-400"}`} />
                <span>{item.title}</span>
              </div>
              {isActive && <ChevronRight className="h-4 w-4 text-white/70" />}
            </Link>
          );
        })}
      </nav>

      {/* Security Banner at bottom of sidebar */}
      <div className="mt-auto rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Role Based Security</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          Every mutation is authenticated, authorized and logged to immutable audit history.
        </p>
      </div>
    </aside>
  );
}

