const fs = require("node:fs");
const path = require("node:path");

const wrapperDir = path.resolve(__dirname, "..");
const wrapperPkgPath = path.join(wrapperDir, "package.json");
const backupPath = path.join(wrapperDir, "package.json.__prepack_backup__");

const rootPkgPath = path.resolve(wrapperDir, "..", "..", "package.json");

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

const rootPkg = readJson(rootPkgPath);
const version = rootPkg.version;
if (!version) {
  console.error("Could not read root package version from " + rootPkgPath);
  process.exit(1);
}

const wrapperRaw = fs.readFileSync(wrapperPkgPath, "utf8");
fs.writeFileSync(backupPath, wrapperRaw);

const wrapperPkg = JSON.parse(wrapperRaw);
wrapperPkg.dependencies = wrapperPkg.dependencies || {};
wrapperPkg.dependencies.railnode = `^${version}`;

fs.writeFileSync(wrapperPkgPath, JSON.stringify(wrapperPkg, null, 2) + "\n");
console.log(`prepack: set railnode dependency to ^${version}`);
