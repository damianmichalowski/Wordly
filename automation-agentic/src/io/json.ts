import fs from "fs";
import path from "path";

export function readJson<T>(filePath: string): T {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export function writeText(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}
