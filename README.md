# Apex Institute Student Result Portal (SRP)

A production-quality, centralized academic examination results management, performance analytics, and ranking portal built for engineering and professional colleges.

---

## 1. Project Overview

The **Student Result Portal (SRP)** enables colleges to securely manage internal assessments, mid-term examinations, and semester evaluations. It features a centralized server-side **Competition Ranking Engine (1, 2, 2, 4)**, verifiable printable **PDF Result Statements**, Excel/CSV bulk marks import with pre-flight error rejection, role-based access control (RBAC), and an immutable administrative audit ledger.

### Key Capabilities
- **Three Tier RBAC**: Administrator, Faculty Evaluator, and Student.
- **Server-Side Ranking Engine**: Subject-wise, Class-wise (Section), and Batch-wise rankings with dense competition ties.
- **Controlled Publication & Correction Workflow**: Marks are saved as Drafts, reviewed, and published officially. Corrections record reasons and previous marks in an immutable audit ledger.
- **Interactive Performance Analytics**: Real-time Recharts dashboards comparing student performance with class averages and tracking multi-exam trends.
- **Print-Ready Official PDF Reports**: Instant client and server-side PDF generation with verification codes, grades, SGPA, and signature blocks.
- **Bulk Spreadsheet Operations**: Pre-flight validated CSV/Excel marks import and full dataset exports.

---

## 2. Technology Stack

- **Framework**: Next.js 14 (App Router, Server Actions, Dynamic API Endpoints)
- **Language**: TypeScript (Strict typing enabled with 0 type errors)
- **Styling**: Tailwind CSS with custom academic tokens & Dark/Light mode support
- **ORM & Database**: Prisma ORM with SQLite (local development zero-config) & PostgreSQL (production-ready)
- **Authentication**: Stateless, tamper-proof session JWTs signed via `jose` with `bcryptjs` password hashing and HTTP-only cookies
- **Data Visualization**: Recharts (Responsive bar charts & trend lines)
- **PDF Generation**: `jspdf` & `jspdf-autotable`
- **Spreadsheets & CSV**: `xlsx` & `papaparse`
- **Validation**: Zod schema validation on all mutations
- **Testing**: Vitest with unit & integration tests

---

## 3. User Roles & Permission Matrix

| Feature / Action | Student | Faculty | Administrator |
|---|:---:|:---:|:---:|
| View Personal Profile & Results | Yes | — | — |
| Download & Print Official PDF Result Sheet | Yes | — | Yes |
| View Performance Trends & Comparisons | Yes | — | Yes |
| View Class & Batch Rankings (Published only) | Yes | Yes | Yes |
| View Unassigned Classes or Draft Marks | **No** | **No** | Yes |
| Enter & Save Marks as Draft | **No** | Assigned courses only | Yes |
| Bulk CSV Import of Marks | **No** | Assigned courses only | Yes |
| Submit Marks for Review | **No** | Yes | Yes |
| Officially Publish / Unpublish Examination Results | **No** | **No** | **Yes** |
| Perform Audited Result Correction (with reason) | **No** | **No** | **Yes** |
| Student & Faculty Account Management (CRUD) | **No** | **No** | **Yes** |
| Academic Curriculum & Subject Configuration | **No** | **No** | **Yes** |
| View System Audit Trail | **No** | **No** | **Yes** |

---

## 4. The Centralized Ranking Engine

The ranking engine runs exclusively on the server to prevent client-side manipulation. It calculates rankings using the **Standard Competition Ranking Formula (1, 2, 2, 4)**:

1. **Competition Ranking Ties**: Students with equal scores receive identical ranks. Subsequent ranks skip by the number of ties (e.g., if two students share Rank 2, the next student is assigned Rank 4).
2. **Deterministic Tie-Breaking**: For screen display and print order, tied students are sorted secondarily by roll number ascending without altering their computed rank.
3. **Cohort Scopes**:
   - **Subject-wise Ranking**: Evaluated within the same subject, examination, and batch. Shows rank, score, percentage, cohort size, and difference from the highest score.
   - **Class-wise Ranking**: Evaluated within a defined class (Branch + Semester + Section + Batch). Calculates aggregate percentage across all subjects and SGPA.
   - **Batch-wise Ranking**: Evaluated across all sections of a batch using normalized percentage scores.
4. **Eligibility & Historical Context**: Ineligible students are excluded. Withheld or absent marks are handled according to configured policies without corrupting historical snapshots.

---

## 5. Quick Start & Local Setup

### Prerequisites
- Node.js `v18.17.0+` (tested on Node v20 and v24)
- npm or pnpm

### Installation
```bash
# 1. Clone repository & install dependencies
git clone <repo-url>
cd advancesrp
npm install

# 2. Configure environment variables
# Copy .env.example to .env (defaults to local SQLite database)
cp .env.example .env

# 3. Initialize database schema
npm run db:push

# 4. Seed demo accounts, courses, exams, and marks
npm run db:seed

# 5. Run automated test suite
npm test

# 6. Start development server
npm run dev
```

The portal will be accessible at: `http://localhost:3000`

---

## 6. Seeded Demo Accounts

The database comes pre-seeded with realistic academic data:

| Role | Email | Password | Details |
|---|---|---|---|
| **Administrator** | `admin@college.edu` | `Admin@12345` | Complete administrative access & audit surveillance |
| **Faculty (HOD)** | `prof.sharma@college.edu` | `Faculty@12345` | Dr. Rajesh Sharma (DBMS & OS Evaluator) |
| **Faculty (Assoc.)** | `prof.verma@college.edu` | `Faculty@12345` | Dr. Anita Verma (Networks, TOC & Web Tech) |
| **Student** | `aarav.patel@student.college.edu` | `Student@12345` | Section A, Rank 1 (91.56%) |
| **Student** | `ananya.sharma@student.college.edu` | `Student@12345` | Section A, Tied Rank 2 (87.56%) |
| **Student** | `rohan.gupta@student.college.edu` | `Student@12345` | Section A, Tied Rank 2 (87.56%) |
| **Student** | `diya.reddy@student.college.edu` | `Student@12345` | Section B, Batch Rank 1 (94.44%) |
| **Student** | `tanvi.joshi@student.college.edu` | `Student@12345` | Demonstrates failed course status |

*Tip: The `/login` page features instant One-Click Demo Access buttons to switch between any role without manual typing.*

---

## 7. Provisioning New Administrators

To create an administrator account securely from the command line:

```bash
node scripts/create-admin.js <email> <password>

# Example:
node scripts/create-admin.js registrar@college.edu ComplexPassword2026!
```

---

## 8. Bulk Marks Import Format

Faculty and administrators can import marks using CSV files. A sample import template is provided in `sample-data/sample-marks-import.csv`.

### CSV Columns:
```csv
Roll No,Student Name,Marks Obtained,Is Absent,Remarks
23CS001,Aarav Patel,95,no,Top laboratory score
23CS002,Ananya Sharma,88,no,Consistent work
23CS003,Rohan Gupta,88,no,Tied score
23CS004,Priya Nair,76,no,Satisfactory
23CS005,Kabir Singh,64,no,Pass
23CS025,Tanvi Joshi,,yes,Medical leave approved
```

The import engine performs pre-flight verification:
- Checks if student roll numbers belong to the enrolled cohort.
- Validates that marks do not exceed the course maximum threshold.
- Detects duplicate records within the file.
- Rejects negative or non-numeric entries with detailed line numbers.

---

## 9. Automated Testing

Run the full automated test suite using:

```bash
npm test
```

### Covered Test Suites:
- `src/lib/ranking/engine.test.ts`: Competition ranking (1, 2, 2, 4), tie handling, normalized percentages, absent student handling, and SGPA calculations.
- `src/lib/export/helpers.test.ts`: Pre-flight CSV parsing, limit violations, duplicate detection, and standard CSV serialization.
- `src/lib/auth.test.ts`: Bcrypt password hashing, session JWT signing, tamper detection, and claim verification.
- `src/lib/pdf/generator.test.ts`: Binary PDF output generation and table rendering.

---

## 10. Database Backup & Restore

### Create a Snapshot Backup:
```bash
node scripts/db-backup.js
```
Backups are saved to the `/backups` directory with an ISO timestamp.

### Restore a Backup:
```bash
# To restore from a backup:
copy backups/backup-srp-YYYY-MM-DD.db prisma/dev.db
```

---

## 11. Production Deployment (PostgreSQL)

For production deployment with PostgreSQL:

1. Update `.env`:
```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@your-db-host:5432/collegesrp?schema=public"
JWT_SECRET="YOUR_SECURE_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
```

2. Switch the Prisma provider in `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

3. Run migrations and build:
```bash
npx prisma db push
npm run build
npm start
```

---

## 12. Verification Checklist

- [x] Three RBAC user roles (Admin, Faculty, Student) enforced on server.
- [x] Complete ranking engine with standard competition ranking (1, 2, 2, 4).
- [x] Official downloadable PDF result sheet with verification code.
- [x] Interactive student dashboard with Recharts comparison & trend charts.
- [x] Bulk CSV marks import with pre-flight validation reporting.
- [x] Result publishing and unpublishing workflows with mandatory audit reasons.
- [x] Official marks correction workflow with previous marks preservation.
- [x] Real-time administrative metrics dashboard.
- [x] Full CRUD for students, faculty, courses, sections, and examinations.
- [x] CSV and Excel exports for rankings, marks, and student rosters.
- [x] Dark/Light responsive UI conforming to design guidelines.
- [x] Automated tests executed and passing with 100% success rate.

