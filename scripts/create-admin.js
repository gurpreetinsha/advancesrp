const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function createAdmin() {
  const args = process.argv.slice(2);
  const email = args[0] || process.env.ADMIN_EMAIL || "admin@college.edu";
  const password = args[1] || process.env.ADMIN_PASSWORD;

  if (!password) {
    console.error("Usage: node scripts/create-admin.js <email> <password>");
    console.error("Example: node scripts/create-admin.js superadmin@college.edu MySecurePassword123!");
    process.exit(1);
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const user = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: email.toLowerCase(),
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "ADMIN_PROVISIONED",
      entityType: "User",
      entityId: user.id,
      details: JSON.stringify({ email: user.email, role: "ADMIN" }),
    },
  });

  console.log(`\nAdministrator provisioned successfully: ${user.email}`);
  console.log("Role: ADMIN | Active: Yes\n");
}

createAdmin()
  .catch((e) => {
    console.error("Failed to provision administrator:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

