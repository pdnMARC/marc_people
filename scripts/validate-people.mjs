import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";

const repoRoot = process.cwd();
// Markdown files live in profiles/, together with their images (profiles/photos/).
const contentDir = path.join(repoRoot, "profiles");
// The website's People page groups people by these roles (pdnmarc.github.io src/pages/people/index.astro).
// Keep google-form/questions.json (and the form's drop-down) in step.
const allowedRoles = [
  "Director",
  "Deputy Director",
  "Project Coordinator",
  "Research Engineer",
  "Research Assistant",
  "Research Intern",
  "Volunteer",
];

const frontmatterSchema = z
  .object({
    email: z.string().email(),
    post: z.enum(allowedRoles),
    name: z.string().trim().min(1),
    photo: z.string().trim().min(1).optional(),
    // Optional aliases the website also links by: extra addresses that project files may use,
    // and other forms of the name used in publication author lists (e.g. "Ratnayake, A.").
    otherEmails: z.array(z.string().email()).optional(),
    otherNames: z.array(z.string().trim().min(1)).optional(),
    // Past members stay on the website under "Past members", still linked to their projects and papers.
    status: z.enum(["current", "past"]).optional(),
    currentPosition: z.string().trim().min(1).optional(),
  })
  .strict();

// Same normalisation as the website (src/lib/people.ts): lower case, no leading title,
// full stops as spaces, ", " after commas, single spaces.
const normName = (name) =>
  name
    .toLowerCase()
    .replace(/^\s*(prof|dr|mr|ms|mrs|eng|ir)\.?\s+/, "")
    .replace(/\./g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/[\s,]+$/, "")
    .trim();

const isMarkdown = (entry) =>
  entry.isFile() &&
  entry.name.toLowerCase().endsWith(".md") &&
  entry.name.toLowerCase() !== "readme.md";

// Markdown left at the repository root is not picked up by the website.
const misplacedFiles = fs
  .readdirSync(repoRoot, { withFileTypes: true })
  .filter(isMarkdown)
  .map((entry) => entry.name);

const markdownFiles = fs
  .readdirSync(contentDir, { withFileTypes: true })
  .filter(isMarkdown)
  .map((entry) => entry.name)
  .sort((a, b) => a.localeCompare(b));

const failures = [];
for (const fileName of misplacedFiles) {
  failures.push(`${fileName}: move this file into the profiles/ folder`);
}
const seenEmails = new Map();
const seenNames = new Map();

for (const fileName of markdownFiles) {
  const filePath = path.join(contentDir, fileName);
  const raw = fs.readFileSync(filePath, "utf8");

  let parsed;
  try {
    parsed = matter(raw);
  } catch (error) {
    failures.push(
      `${fileName}: could not parse front matter (${error.message})`,
    );
    continue;
  }

  const result = frontmatterSchema.safeParse(parsed.data);
  if (!result.success) {
    for (const issue of result.error.issues) {
      const issuePath = issue.path.length > 0 ? issue.path.join(".") : "frontmatter";
      failures.push(`${fileName}: ${issuePath} ${issue.message}`);
    }
    continue;
  }

  const data = result.data;

  if (data.currentPosition && data.status !== "past") {
    failures.push(`${fileName}: currentPosition is only shown for past members (status: past)`);
  }

  // Every address, primary or other, may belong to one profile only.
  for (const email of [data.email, ...(data.otherEmails ?? [])]) {
    const normalizedEmail = email.trim().toLowerCase();
    const owner = seenEmails.get(normalizedEmail);
    if (owner && owner !== fileName) {
      failures.push(`${fileName}: email "${email}" is also used in ${owner}`);
    } else if (owner === fileName) {
      failures.push(`${fileName}: email "${email}" is listed twice`);
    } else {
      seenEmails.set(normalizedEmail, fileName);
    }
  }

  // A name form that matched two people would put papers on the wrong profile.
  for (const name of new Set([data.name, ...(data.otherNames ?? [])].map(normName))) {
    if (!name.includes(" ")) {
      if (name !== normName(data.name)) {
        failures.push(`${fileName}: otherNames entry "${name}" needs at least two words, e.g. "Ratnayake, A."`);
      }
      continue;
    }
    const owner = seenNames.get(name);
    if (owner && owner !== fileName) {
      failures.push(`${fileName}: name form "${name}" is also used in ${owner}; make it more specific`);
    } else {
      seenNames.set(name, fileName);
    }
  }

  if (data.photo) {
    if (!data.photo.startsWith("./photos/")) {
      failures.push(
        `${fileName}: photo must use a relative path starting with "./photos/"`,
      );
    }

    const photoPath = path.resolve(path.dirname(filePath), data.photo);
    if (!fs.existsSync(photoPath)) {
      failures.push(`${fileName}: photo file not found at ${data.photo}`);
    }
  }
}

if (markdownFiles.length === 0) {
  failures.push("No profile markdown files were found.");
}

if (failures.length > 0) {
  console.error("marc_people validation failed:\n");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Validated ${markdownFiles.length} profile file(s) successfully.`);
