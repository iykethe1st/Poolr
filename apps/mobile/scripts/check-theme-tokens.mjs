import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const requestedPaths = process.argv.slice(2);
const scanRoots =
  requestedPaths.length > 0
    ? requestedPaths.map((target) => path.resolve(root, target))
    : [path.join(root, "app"), path.join(root, "src")];
const violations = [];
const literalColor =
  /#[\da-f]{3,8}\b|rgba?\s*\([^)]*\)|(?:color|backgroundColor|borderColor|tintColor)\s*(?::\s*|=\s*(?:\{\s*)?)['"][^'"]+['"]/i;
const numericFontSize =
  /\bfontSize\s*:\s*\d+(?:\.\d+)?\b|\bfontSize\s*=\s*\{\s*\d+(?:\.\d+)?\s*\}/;

async function collectFiles(target) {
  const info = await import("node:fs/promises").then(({ stat }) =>
    stat(target),
  );
  if (info.isFile()) return [target];
  const entries = await readdir(target, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter(
        (entry) =>
          entry.isDirectory() || /\.(?:ts|tsx|js|jsx)$/.test(entry.name),
      )
      .filter((entry) => entry.name !== "node_modules")
      .map((entry) => collectFiles(path.join(target, entry.name))),
  );
  return nested.flat();
}

for (const scanRoot of scanRoots) {
  let files;
  try {
    files = await collectFiles(scanRoot);
  } catch (error) {
    console.error(`Unable to scan ${path.relative(root, scanRoot)}:`, error);
    process.exitCode = 1;
    continue;
  }

  for (const file of files) {
    const relativePath = path.relative(root, file);
    const pathParts = relativePath.split(path.sep);
    if (pathParts[0] === "src" && pathParts[1] === "theme") continue;
    const contents = await readFile(file, "utf8");
    const lines = contents.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (literalColor.test(line)) {
        violations.push(
          `${relativePath}:${index + 1}: color literal outside src/theme`,
        );
      }
      if (numericFontSize.test(line)) {
        violations.push(
          `${relativePath}:${index + 1}: numeric font size outside src/theme`,
        );
      }
    });
  }
}

if (violations.length > 0) {
  console.error("Theme token violations found:");
  for (const violation of violations) console.error(`  ${violation}`);
  process.exitCode = 1;
} else {
  console.log("Theme token check passed.");
}
