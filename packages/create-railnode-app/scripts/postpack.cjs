const fs = require("node:fs");
const path = require("node:path");

const wrapperDir = path.resolve(__dirname, "..");
const wrapperPkgPath = path.join(wrapperDir, "package.json");
const backupPath = path.join(wrapperDir, "package.json.__prepack_backup__");

if (!fs.existsSync(backupPath)) {
  // Nothing to restore.
  process.exit(0);
}

const backup = fs.readFileSync(backupPath, "utf8");
fs.writeFileSync(wrapperPkgPath, backup);
fs.unlinkSync(backupPath);
console.log("postpack: restored wrapper package.json");
