const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed is disabled in production. Create production accounts through the secured administrator workflow.");
  }
  console.log("Seeding Shri Ram Group of Colleges (SRGC) demo database...");

  // 1. System Settings
  const settings = [
    { key: "COLLEGE_NAME", value: "Shri Ram Group of Colleges", description: "Institution Full Name" },
    { key: "COLLEGE_CODE", value: "SRGC", description: "Institution Code" },
    { key: "ACCREDITATION", value: "Autonomous Institution | Approved by AICTE & Accredited with Grade A++", description: "Accreditation string" },
    { key: "PORTAL_VERSION", value: "2.4.0", description: "SRP System Version" },
  ];

  for (const s of settings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 2. Grade Scales
  const gradeScales = [
    { minPercentage: 90.0, maxPercentage: 100.0, grade: "O", gradePoint: 10.0, description: "Outstanding" },
    { minPercentage: 80.0, maxPercentage: 89.99, grade: "A+", gradePoint: 9.0, description: "Excellent" },
    { minPercentage: 70.0, maxPercentage: 79.99, grade: "A", gradePoint: 8.0, description: "Very Good" },
    { minPercentage: 60.0, maxPercentage: 69.99, grade: "B+", gradePoint: 7.0, description: "Good" },
    { minPercentage: 50.0, maxPercentage: 59.99, grade: "B", gradePoint: 6.0, description: "Above Average" },
    { minPercentage: 45.0, maxPercentage: 49.99, grade: "C", gradePoint: 5.0, description: "Average" },
    { minPercentage: 40.0, maxPercentage: 44.99, grade: "P", gradePoint: 4.0, description: "Pass" },
    { minPercentage: 0.0, maxPercentage: 39.99, grade: "F", gradePoint: 0.0, description: "Fail" },
  ];

  for (const g of gradeScales) {
    const existing = await prisma.gradeScale.findFirst({
      where: { minPercentage: g.minPercentage, maxPercentage: g.maxPercentage },
    });
    if (!existing) {
      await prisma.gradeScale.create({ data: g });
    }
  }

  // 3. Departments
  const deptCSE = await prisma.department.upsert({
    where: { code: "CSE" },
    update: { name: "Computer Science & Engineering" },
    create: { code: "CSE", name: "Computer Science & Engineering" },
  });

  const deptECE = await prisma.department.upsert({
    where: { code: "ECE" },
    update: { name: "Electronics & Communication Engineering" },
    create: { code: "ECE", name: "Electronics & Communication Engineering" },
  });

  // 4. Branches
  const branchCSE = await prisma.branch.upsert({
    where: { code: "BTECH_CSE" },
    update: { name: "B.Tech Computer Science & Engineering", departmentId: deptCSE.id },
    create: {
      code: "BTECH_CSE",
      name: "B.Tech Computer Science & Engineering",
      departmentId: deptCSE.id,
    },
  });

  // 5. Academic Year
  const academicYear = await prisma.academicYear.upsert({
    where: { name: "2025-2026" },
    update: { isCurrent: true },
    create: {
      name: "2025-2026",
      startDate: new Date("2025-08-01"),
      endDate: new Date("2026-06-30"),
      isCurrent: true,
    },
  });

  // 6. Batch
  const batch = await prisma.batch.upsert({
    where: {
      branchId_name: {
        branchId: branchCSE.id,
        name: "2023-2027",
      },
    },
    update: {},
    create: {
      branchId: branchCSE.id,
      name: "2023-2027",
      startYear: 2023,
      endYear: 2027,
    },
  });

  // 7. Semesters
  const semesters = [];
  for (let i = 1; i <= 8; i++) {
    const sem = await prisma.semester.upsert({
      where: { number: i },
      update: { name: `Semester ${i}` },
      create: { number: i, name: `Semester ${i}` },
    });
    semesters.push(sem);
  }
  const sem5 = semesters[4]; // Semester 5

  // 8. Sections
  const sectionA = await prisma.section.upsert({
    where: { branchId_name: { branchId: branchCSE.id, name: "A" } },
    update: {},
    create: { branchId: branchCSE.id, name: "A" },
  });

  const sectionB = await prisma.section.upsert({
    where: { branchId_name: { branchId: branchCSE.id, name: "B" } },
    update: {},
    create: { branchId: branchCSE.id, name: "B" },
  });

  // 9. Subjects for Semester 5
  const subjectsData = [
    { code: "CS501", name: "Database Management Systems", credits: 4.0, type: "THEORY" },
    { code: "CS502", name: "Operating Systems & Concurrency", credits: 4.0, type: "THEORY" },
    { code: "CS503", name: "Computer Networks & Security", credits: 3.0, type: "THEORY" },
    { code: "CS504", name: "Theory of Computation", credits: 3.0, type: "THEORY" },
    { code: "CS505", name: "Full Stack Web Technologies", credits: 3.0, type: "LAB" },
  ];

  const subjects = [];
  for (const sub of subjectsData) {
    const s = await prisma.subject.upsert({
      where: { code: sub.code },
      update: { name: sub.name, credits: sub.credits, type: sub.type },
      create: {
        code: sub.code,
        name: sub.name,
        credits: sub.credits,
        type: sub.type,
        branchId: branchCSE.id,
        semesterId: sem5.id,
      },
    });
    subjects.push(s);
  }

  // 10. Administrator User
  const adminPasswordHash = await hashPassword("Admin@12345");
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@college.edu" },
    update: { passwordHash: adminPasswordHash, role: "ADMIN", isActive: true },
    create: {
      email: "admin@college.edu",
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // 11. Faculty Users & Profiles
  const facultyPasswordHash = await hashPassword("Faculty@12345");

  // Faculty 1: Dr. Rajesh Sharma
  const facultyUser1 = await prisma.user.upsert({
    where: { email: "prof.sharma@college.edu" },
    update: { passwordHash: facultyPasswordHash, role: "FACULTY" },
    create: {
      email: "prof.sharma@college.edu",
      passwordHash: facultyPasswordHash,
      role: "FACULTY",
    },
  });

  const faculty1 = await prisma.faculty.upsert({
    where: { employeeCode: "EMP-CSE-001" },
    update: { userId: facultyUser1.id, departmentId: deptCSE.id },
    create: {
      userId: facultyUser1.id,
      employeeCode: "EMP-CSE-001",
      firstName: "Rajesh",
      lastName: "Sharma",
      email: "prof.sharma@college.edu",
      phone: "+91 98765 43210",
      designation: "Professor & Head of Department",
      departmentId: deptCSE.id,
    },
  });

  // Faculty 2: Dr. Anita Verma
  const facultyUser2 = await prisma.user.upsert({
    where: { email: "prof.verma@college.edu" },
    update: { passwordHash: facultyPasswordHash, role: "FACULTY" },
    create: {
      email: "prof.verma@college.edu",
      passwordHash: facultyPasswordHash,
      role: "FACULTY",
    },
  });

  const faculty2 = await prisma.faculty.upsert({
    where: { employeeCode: "EMP-CSE-002" },
    update: { userId: facultyUser2.id, departmentId: deptCSE.id },
    create: {
      userId: facultyUser2.id,
      employeeCode: "EMP-CSE-002",
      firstName: "Anita",
      lastName: "Verma",
      email: "prof.verma@college.edu",
      phone: "+91 98765 43211",
      designation: "Associate Professor",
      departmentId: deptCSE.id,
    },
  });

  // Faculty Assignments
  // Prof Sharma teaches CS501 (DBMS) and CS502 (OS) for Sem 5 Sec A & B
  for (const sub of [subjects[0], subjects[1]]) {
    for (const sec of [sectionA, sectionB]) {
      await prisma.facultyAssignment.upsert({
        where: {
          facultyId_subjectId_academicYearId_semesterId_sectionId: {
            facultyId: faculty1.id,
            subjectId: sub.id,
            academicYearId: academicYear.id,
            semesterId: sem5.id,
            sectionId: sec.id,
          },
        },
        update: { canEnterMarks: true },
        create: {
          facultyId: faculty1.id,
          subjectId: sub.id,
          academicYearId: academicYear.id,
          semesterId: sem5.id,
          sectionId: sec.id,
          canEnterMarks: true,
        },
      });
    }
  }

  // Prof Verma teaches CS503 (CN), CS504 (TOC) and CS505 (Web Tech) for Sem 5 Sec A & B
  for (const sub of [subjects[2], subjects[3], subjects[4]]) {
    for (const sec of [sectionA, sectionB]) {
      await prisma.facultyAssignment.upsert({
        where: {
          facultyId_subjectId_academicYearId_semesterId_sectionId: {
            facultyId: faculty2.id,
            subjectId: sub.id,
            academicYearId: academicYear.id,
            semesterId: sem5.id,
            sectionId: sec.id,
          },
        },
        update: { canEnterMarks: true },
        create: {
          facultyId: faculty2.id,
          subjectId: sub.id,
          academicYearId: academicYear.id,
          semesterId: sem5.id,
          sectionId: sec.id,
          canEnterMarks: true,
        },
      });
    }
  }

  // 12. Students Data
  const studentPasswordHash = await hashPassword("Student@12345");
  const rawStudents = [
    // Section A
    { roll: "23CS001", enr: "ENR2023001", first: "Aarav", last: "Patel", email: "aarav.patel@student.college.edu", sec: sectionA },
    { roll: "23CS002", enr: "ENR2023002", first: "Ananya", last: "Sharma", email: "ananya.sharma@student.college.edu", sec: sectionA },
    { roll: "23CS003", enr: "ENR2023003", first: "Rohan", last: "Gupta", email: "rohan.gupta@student.college.edu", sec: sectionA },
    { roll: "23CS004", enr: "ENR2023004", first: "Priya", last: "Nair", email: "priya.nair@student.college.edu", sec: sectionA },
    { roll: "23CS005", enr: "ENR2023005", first: "Kabir", last: "Singh", email: "kabir.singh@student.college.edu", sec: sectionA },
    // Section B
    { roll: "23CS021", enr: "ENR2023021", first: "Diya", last: "Reddy", email: "diya.reddy@student.college.edu", sec: sectionB },
    { roll: "23CS022", enr: "ENR2023022", first: "Ishan", last: "Verma", email: "ishan.verma@student.college.edu", sec: sectionB },
    { roll: "23CS023", enr: "ENR2023023", first: "Meera", last: "Iyer", email: "meera.iyer@student.college.edu", sec: sectionB },
    { roll: "23CS024", enr: "ENR2023024", first: "Siddharth", last: "Malhotra", email: "siddharth.m@student.college.edu", sec: sectionB },
    { roll: "23CS025", enr: "ENR2023025", first: "Tanvi", last: "Joshi", email: "tanvi.joshi@student.college.edu", sec: sectionB },
  ];

  const students = [];
  for (const s of rawStudents) {
    const user = await prisma.user.upsert({
      where: { email: s.email },
      update: { passwordHash: studentPasswordHash, role: "STUDENT" },
      create: { email: s.email, passwordHash: studentPasswordHash, role: "STUDENT" },
    });

    const stu = await prisma.student.upsert({
      where: { rollNo: s.roll },
      update: {
        userId: user.id,
        enrollmentNo: s.enr,
        firstName: s.first,
        lastName: s.last,
        email: s.email,
        currentSemesterId: sem5.id,
        currentSectionId: s.sec.id,
      },
      create: {
        userId: user.id,
        rollNo: s.roll,
        enrollmentNo: s.enr,
        firstName: s.first,
        lastName: s.last,
        email: s.email,
        departmentId: deptCSE.id,
        branchId: branchCSE.id,
        batchId: batch.id,
        currentSemesterId: sem5.id,
        currentSectionId: s.sec.id,
      },
    });

    // Student Enrollment History record
    await prisma.studentEnrollment.upsert({
      where: {
        studentId_academicYearId_semesterId: {
          studentId: stu.id,
          academicYearId: academicYear.id,
          semesterId: sem5.id,
        },
      },
      update: { sectionId: s.sec.id },
      create: {
        studentId: stu.id,
        academicYearId: academicYear.id,
        batchId: batch.id,
        semesterId: sem5.id,
        sectionId: s.sec.id,
        status: "ACTIVE",
      },
    });

    students.push({ ...stu, section: s.sec });
  }

  // 13. Examinations
  // Exam 1: Published Exam (Internal Assessment 1)
  const exam1 = await prisma.examination.upsert({
    where: { id: "exam-ia-1" },
    update: {
      status: "PUBLISHED",
      publishedAt: new Date("2025-10-15T10:00:00Z"),
      publishedById: adminUser.id,
    },
    create: {
      id: "exam-ia-1",
      name: "Internal Assessment 1",
      academicYearId: academicYear.id,
      semesterId: sem5.id,
      batchId: batch.id,
      examDate: new Date("2025-10-10"),
      description: "First mid-term internal evaluation covering Units 1 & 2",
      status: "PUBLISHED",
      publishedAt: new Date("2025-10-15T10:00:00Z"),
      publishedById: adminUser.id,
    },
  });

  // ExamSubjects for Exam 1
  const examSubjectsConfig = [
    { subject: subjects[0], maxMarks: 100, passingMarks: 40 },
    { subject: subjects[1], maxMarks: 100, passingMarks: 40 },
    { subject: subjects[2], maxMarks: 100, passingMarks: 40 },
    { subject: subjects[3], maxMarks: 100, passingMarks: 40 },
    { subject: subjects[4], maxMarks: 50, passingMarks: 20 },
  ];

  const exam1Subjects = [];
  for (const item of examSubjectsConfig) {
    const es = await prisma.examSubject.upsert({
      where: {
        examId_subjectId: {
          examId: exam1.id,
          subjectId: item.subject.id,
        },
      },
      update: { maxMarks: item.maxMarks, passingMarks: item.passingMarks },
      create: {
        examId: exam1.id,
        subjectId: item.subject.id,
        maxMarks: item.maxMarks,
        passingMarks: item.passingMarks,
        weightage: 1.0,
      },
    });
    exam1Subjects.push(es);
  }

  // Student Exam Enrollments for Exam 1 (historical snapshot at exam time)
  for (const stu of students) {
    await prisma.studentExamEnrollment.upsert({
      where: {
        examId_studentId: {
          examId: exam1.id,
          studentId: stu.id,
        },
      },
      update: { isEligible: true },
      create: {
        examId: exam1.id,
        studentId: stu.id,
        batchId: batch.id,
        semesterId: sem5.id,
        sectionId: stu.section.id,
        isEligible: true,
      },
    });
  }

  // Marks Matrix for Exam 1 (Realistic score spreads with ties, high scores, and realistic grading)
  // [DBMS(100), OS(100), CN(100), TOC(100), WEB(50)]
  const exam1MarksMatrix = [
    // Sec A:
    { roll: "23CS001", marks: [94, 91, 88, 92, 47] }, // Total: 412/450 (91.56%) - Top Ranker
    { roll: "23CS002", marks: [88, 85, 90, 86, 45] }, // Total: 394/450 (87.56%)
    { roll: "23CS003", marks: [88, 85, 90, 86, 45] }, // Exact Tie with 23CS002! (Tests competition tie 2, 2 -> 4)
    { roll: "23CS004", marks: [76, 72, 79, 74, 38] }, // Total: 339/450 (75.33%)
    { roll: "23CS005", marks: [62, 58, 64, 55, 30] }, // Total: 269/450 (59.78%)
    // Sec B:
    { roll: "23CS021", marks: [96, 94, 92, 95, 48] }, // Total: 425/450 (94.44%) - Batch Rank 1!
    { roll: "23CS022", marks: [84, 82, 80, 85, 42] }, // Total: 373/450 (82.89%)
    { roll: "23CS023", marks: [79, 75, 78, 81, 40] }, // Total: 353/450 (78.44%)
    { roll: "23CS024", marks: [55, 52, 60, 48, 25] }, // Total: 240/450 (53.33%)
    { roll: "23CS025", marks: [42, 38, 45, 40, 22] }, // Failed in OS (38 < 40)! Tests pass/fail detection
  ];

  for (const row of exam1MarksMatrix) {
    const stu = students.find((s) => s.rollNo === row.roll);
    if (!stu) continue;

    for (let i = 0; i < exam1Subjects.length; i++) {
      const examSub = exam1Subjects[i];
      const marksObtained = row.marks[i];

      await prisma.mark.upsert({
        where: {
          examSubjectId_studentId: {
            examSubjectId: examSub.id,
            studentId: stu.id,
          },
        },
        update: {
          marksObtained,
          status: "PUBLISHED",
          isAbsent: false,
          isWithheld: false,
        },
        create: {
          examSubjectId: examSub.id,
          studentId: stu.id,
          marksObtained,
          status: "PUBLISHED",
          enteredById: facultyUser1.id,
          isAbsent: false,
          isWithheld: false,
        },
      });
    }
  }

  // Result publication record
  await prisma.resultPublication.upsert({
    where: { id: "pub-exam-ia-1" },
    update: { isActive: true },
    create: {
      id: "pub-exam-ia-1",
      examId: exam1.id,
      publishedById: adminUser.id,
      publishedAt: new Date("2025-10-15T10:00:00Z"),
      isActive: true,
      version: 1,
    },
  });

  // Exam 2: Draft Exam (Internal Assessment 2)
  const exam2 = await prisma.examination.upsert({
    where: { id: "exam-ia-2" },
    update: {},
    create: {
      id: "exam-ia-2",
      name: "Internal Assessment 2",
      academicYearId: academicYear.id,
      semesterId: sem5.id,
      batchId: batch.id,
      examDate: new Date("2025-11-20"),
      description: "Second internal evaluation covering Units 3 & 4",
      status: "DRAFT",
    },
  });

  for (const item of examSubjectsConfig) {
    await prisma.examSubject.upsert({
      where: { examId_subjectId: { examId: exam2.id, subjectId: item.subject.id } },
      update: {},
      create: {
        examId: exam2.id,
        subjectId: item.subject.id,
        maxMarks: item.maxMarks,
        passingMarks: item.passingMarks,
      },
    });
  }

  // Exam 3: Mid-Semester Examination (Under Review)
  const exam3 = await prisma.examination.upsert({
    where: { id: "exam-mid-sem" },
    update: {},
    create: {
      id: "exam-mid-sem",
      name: "Mid-Semester Examination",
      academicYearId: academicYear.id,
      semesterId: sem5.id,
      batchId: batch.id,
      examDate: new Date("2025-12-05"),
      description: "Comprehensive mid-semester examination",
      status: "UNDER_REVIEW",
    },
  });

  for (const item of examSubjectsConfig) {
    await prisma.examSubject.upsert({
      where: { examId_subjectId: { examId: exam3.id, subjectId: item.subject.id } },
      update: {},
      create: {
        examId: exam3.id,
        subjectId: item.subject.id,
        maxMarks: item.maxMarks,
        passingMarks: item.passingMarks,
      },
    });
  }

  // Audit Log sample entries
  await prisma.auditLog.createMany({
    data: [
      {
        userId: adminUser.id,
        action: "PORTAL_INITIALIZED",
        entityType: "System",
        entityId: "system",
        details: JSON.stringify({ message: "Academic year 2025-2026 initialized with departments, branches and courses." }),
      },
      {
        userId: facultyUser1.id,
        action: "MARKS_SUBMITTED",
        entityType: "Examination",
        entityId: exam1.id,
        details: JSON.stringify({ examName: "Internal Assessment 1", subject: "CS501", recordsCount: 10 }),
      },
      {
        userId: adminUser.id,
        action: "RESULT_PUBLISHED",
        entityType: "Examination",
        entityId: exam1.id,
        details: JSON.stringify({ examName: "Internal Assessment 1", status: "PUBLISHED", publishedStudents: 10 }),
      },
    ],
  });

  console.log("Database seeded successfully!");
  console.log("\n============================================================");
  console.log("DEMO ACCOUNTS READY:");
  console.log("1. Admin:   admin@college.edu       / Admin@12345");
  console.log("2. Faculty: prof.sharma@college.edu / Faculty@12345");
  console.log("3. Faculty: prof.verma@college.edu  / Faculty@12345");
  console.log("4. Student: aarav.patel@student.college.edu  / Student@12345 (Section A, Rank 1)");
  console.log("5. Student: diya.reddy@student.college.edu   / Student@12345 (Section B, Batch Rank 1)");
  console.log("6. Student: ananya.sharma@student.college.edu / Student@12345 (Tied Rank 2 in Sec A)");
  console.log("7. Student: tanvi.joshi@student.college.edu  / Student@12345 (Failed in OS to test fail state)");
  console.log("============================================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
