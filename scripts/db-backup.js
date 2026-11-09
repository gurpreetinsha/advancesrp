const fs = require("fs");
const path = require("path");

function backup() {
  const backupDir = path.resolve(__dirname, "../backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const dbPath = path.resolve(__dirname, "../prisma/dev.db");
  if (!fs.existsSync(dbPath)) {
    console.error("Database file not found at:", dbPath);
    process.exit(1);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const targetBackupFile = path.join(backupDir, `backup-srp-${timestamp}.db`);

  fs.copyFileSync(dbPath, targetBackupFile);
  console.log(`\nDatabase backup created successfully:`);
  console.log(`Saved to: ${targetBackupFile}`);
  console.log(`File size: ${(fs.statSync(targetBackupFile).size / 1024).toFixed(2)} KB\n`);
}

backup();

