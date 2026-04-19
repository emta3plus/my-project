/**
 * build-skills-cache.ts
 *
 * Build-time script that reads all skill and agent markdown files
 * and bundles them into a single JSON cache for Vercel deployment.
 *
 * Usage: npx tsx scripts/build-skills-cache.ts
 */

import * as fs from "fs";
import * as path from "path";

// ── Configuration ──────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, "..");
const SKILLS_DIR = path.join(PROJECT_ROOT, "skills");
const AGENTS_DIR = path.join(PROJECT_ROOT, "agents");
const OUTPUT_PATH = path.join(PROJECT_ROOT, "src", "lib", "skills-cache.json");

// ── Types ──────────────────────────────────────────────────────────────────────
interface SkillsCache {
  skills: Record<string, string>;
  agents: Record<string, string>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Recursively find all directories that contain a SKILL.md file
 * under the given skills root directory.
 */
function findSkillDirs(root: string): string[] {
  if (!fs.existsSync(root)) {
    console.warn(`[build-skills-cache] Skills directory not found: ${root}`);
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const dirs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(root, entry.name);
    const skillFile = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(skillFile)) {
      dirs.push(skillDir);
    }
  }

  return dirs;
}

/**
 * Find all .md files in the agents directory.
 */
function findAgentFiles(root: string): string[] {
  if (!fs.existsSync(root)) {
    console.warn(`[build-skills-cache] Agents directory not found: ${root}`);
    return [];
  }

  const entries = fs.readdirSync(root, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
    files.push(path.join(root, entry.name));
  }

  return files;
}

/**
 * Derive a kebab-case skill ID from its directory name.
 * e.g. "skills/flutter-dart-code-review" → "flutter-dart-code-review"
 */
function skillIdFromDir(dirPath: string): string {
  return path.basename(dirPath);
}

/**
 * Derive an agent ID from its filename (without .md extension).
 * e.g. "agents/code-reviewer.md" → "code-reviewer"
 */
function agentIdFromFile(filePath: string): string {
  return path.basename(filePath, ".md");
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main(): void {
  console.log("[build-skills-cache] Starting cache generation...\n");

  const cache: SkillsCache = {
    skills: {},
    agents: {},
  };

  // ── Read Skills ──
  const skillDirs = findSkillDirs(SKILLS_DIR);
  console.log(`[build-skills-cache] Found ${skillDirs.length} skill directories`);

  for (const dir of skillDirs) {
    const id = skillIdFromDir(dir);
    const filePath = path.join(dir, "SKILL.md");

    try {
      const content = fs.readFileSync(filePath, "utf-8");
      cache.skills[id] = content;
    } catch (err) {
      console.warn(`[build-skills-cache] Failed to read skill "${id}": ${err}`);
    }
  }

  // ── Read Agents ──
  const agentFiles = findAgentFiles(AGENTS_DIR);
  console.log(`[build-skills-cache] Found ${agentFiles.length} agent files`);

  for (const file of agentFiles) {
    const id = agentIdFromFile(file);

    try {
      const content = fs.readFileSync(file, "utf-8");
      cache.agents[id] = content;
    } catch (err) {
      console.warn(`[build-skills-cache] Failed to read agent "${id}": ${err}`);
    }
  }

  // ── Write Output ──
  const outputDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cache, null, 2), "utf-8");

  const skillCount = Object.keys(cache.skills).length;
  const agentCount = Object.keys(cache.agents).length;
  const fileSizeKB = (fs.statSync(OUTPUT_PATH).size / 1024).toFixed(1);

  console.log(
    `\n[build-skills-cache] Cache written to ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`
  );
  console.log(
    `[build-skills-cache]   Skills: ${skillCount} | Agents: ${agentCount} | Size: ${fileSizeKB} KB\n`
  );
}

main();
