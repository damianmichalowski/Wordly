import fs from "fs";
import path from "path";

export function loadDotenv(rootDir = process.cwd()) {
  const candidates = [
    path.resolve(rootDir, ".env"),
    path.resolve(rootDir, "automation-agentic", ".env"),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, "utf-8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  }
}
