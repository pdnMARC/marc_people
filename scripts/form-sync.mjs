// Profile form → pull requests. Run by .github/workflows/form-sync.yml every night at 00:00
// Sri Lanka time, or by hand ("Run workflow").
//
// Reads the Google Form's response sheet (CSV link in FORM_RESPONSES_CSV, from the GOOGLE_FORM_CSV_LINK secret). Every response that has
// not been handled yet becomes a pull request on branch profile-form/<id> with the new or updated
// profile and photo; a response that can't be used becomes an issue instead. A response whose pull
// request or issue exists (open, merged or closed) is never proposed again, so closing a pull
// request rejects that submission for good. Project teams are handled by the same workflow in
// marc_projects. Setup: google-form/README.md.
//
// Try it locally without git or GitHub (changes are written to the working tree):
//   DRY_RUN=1 FORM_RESPONSES_CSV=path/to/responses.csv node scripts/form-sync.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";

const Q = JSON.parse(fs.readFileSync(new URL("../google-form/questions.json", import.meta.url), "utf8"));
const DRY = process.env.DRY_RUN === "1";
const ROOT = process.cwd();
const PROFILES = path.join(ROOT, "profiles");

/** A problem with the answers (or the photo): reported in an issue instead of a pull request. */
class SubmissionError extends Error {}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/* ── Responses ─────────────────────────────────────────────────────────────── */

async function readSource(source) {
  if (!/^https?:\/\//.test(source)) return fs.readFileSync(source, "utf8");
  const res = await fetch(source, { redirect: "follow", headers: { "Cache-Control": "no-cache" } });
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error(`Could not read the response sheet (${res.status}). Is it shared as "Anyone with the link"? (google-form/README.md)`);
  }
  return text;
}

/** RFC 4180 CSV → objects keyed by the (trimmed) header row. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  text = text.replace(/^﻿/, "");
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  const [header = [], ...data] = rows;
  return data
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] ?? "").trim()])));
}

/** Answer by question title, ignoring upper/lower case (the sheet may write "Email Address"). */
const answer = (row, title) => {
  const key = Object.keys(row).find((k) => k.toLowerCase() === title.toLowerCase());
  return key ? row[key] : "";
};

/** Stable id of a response: same in this repository and in marc_projects. */
export const responseId = (row) =>
  crypto
    .createHash("sha1")
    .update([answer(row, Q.timestamp), answer(row, Q.submitter), answer(row, Q.email)].join("|").toLowerCase())
    .digest("hex")
    .slice(0, 10);

/* ── Profiles ──────────────────────────────────────────────────────────────── */

const clean = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const lines = (v) => String(v ?? "").split(/[\n;]+/).map(clean).filter(Boolean);
const asList = (v) => (Array.isArray(v) ? v : v ? [v] : []).map(String);
const emailsOf = (d) => [d.email, ...asList(d.otherEmails)].filter(Boolean).map((x) => String(x).toLowerCase());
const fileSlug = (name) => clean(name).replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "profile";
const union = (...lists) => {
  const seen = new Set();
  return lists.flat().filter((x) => {
    const key = String(x).toLowerCase();
    if (!x || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function readProfiles() {
  return fs
    .readdirSync(PROFILES)
    .filter((f) => /\.md$/i.test(f))
    .map((file) => {
      const parsed = matter(fs.readFileSync(path.join(PROFILES, file), "utf8"));
      return { file, data: parsed.data, body: parsed.content.trim() };
    });
}

/** Same layout as the hand-written profiles: known fields first, in order. */
export function profileMarkdown(d, body, extras = {}) {
  const q = (s) => JSON.stringify(String(s)); // a JSON string is a valid double-quoted YAML string
  const out = ["---", `email: ${d.email}`, `post: ${d.post}`, `name: ${q(d.name)}`];
  if (d.photo) out.push(`photo: ${d.photo}`);
  if (d.otherEmails.length) out.push("otherEmails:", ...d.otherEmails.map((x) => `  - ${x}`));
  if (d.otherNames.length) out.push("otherNames:", ...d.otherNames.map((x) => `  - ${q(x)}`));
  if (d.status === "past") {
    out.push("status: past");
    if (d.currentPosition) out.push(`currentPosition: ${q(d.currentPosition)}`);
  }
  for (const [k, v] of Object.entries(extras)) {
    if (Array.isArray(v)) out.push(v.length ? `${k}:` : `${k}: []`, ...v.map((x) => `  - ${q(x)}`));
    else out.push(`${k}: ${q(v)}`);
  }
  out.push("---");
  return out.join("\n") + "\n" + (body ? body.trim() + "\n" : "");
}

async function photoJpeg(cell) {
  let bytes;
  if (cell.startsWith("file:")) {
    bytes = fs.readFileSync(new URL(cell)); // local tries only
  } else {
    const id = (cell.match(/[?&]id=([\w-]+)/) || cell.match(/\/d\/([\w-]+)/) || [])[1];
    if (!id) throw new SubmissionError("The photo link in the response could not be read.");
    const res = await fetch(`https://drive.google.com/uc?export=download&id=${id}`, { redirect: "follow" });
    if (!res.ok || !(res.headers.get("content-type") || "").startsWith("image/")) {
      throw new SubmissionError(
        "The photo could not be downloaded. Check that the form's upload folder is shared as \"Anyone with the link\" (google-form/README.md, step 4).",
      );
    }
    bytes = Buffer.from(await res.arrayBuffer());
  }
  const { default: sharp } = await import("sharp");
  try {
    // Upright, at most 800 × 800, as JPEG. sharp drops EXIF data (camera, location) by default.
    return await sharp(bytes).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toBuffer();
  } catch {
    throw new SubmissionError("The photo is not an image we can use. Please upload a JPG, PNG or WebP file.");
  }
}

/** Writes the response's profile (and photo) into the working tree. Returns a summary for the pull request. */
export async function applyResponse(row) {
  const email = clean(answer(row, Q.email)).toLowerCase();
  const wantsUpdate = answer(row, Q.action) === Q.actionUpdate;
  const profiles = readProfiles();
  const existing = profiles.find((p) => emailsOf(p.data).includes(email));
  if (!email) throw new SubmissionError("The response has no email address.");
  if (wantsUpdate && !existing) {
    throw new SubmissionError(`No profile uses the address ${email}. The person should enter an address already in their profile, or choose "${Q.actionNew}".`);
  }
  const isUpdate = Boolean(existing);
  const base = existing?.data ?? {};

  // An answer replaces the current value, a blank keeps it, and lists only grow (never drop a link).
  const status = answer(row, Q.status);
  const d = {
    email: base.email || email,
    post: clean(answer(row, Q.post)) || base.post || "",
    name: clean(answer(row, Q.name)) || base.name || "",
    photo: base.photo || "",
    status: status === Q.statusPast ? "past" : status === Q.statusCurrent ? "current" : base.status || "current",
    currentPosition: clean(answer(row, Q.currentPosition)) || base.currentPosition || "",
  };
  const primary = String(d.email).toLowerCase();
  d.otherEmails = union(asList(base.otherEmails), lines(answer(row, Q.otherEmails)).map((x) => x.toLowerCase()), isUpdate ? [email] : []).filter(
    (x) => x.toLowerCase() !== primary,
  );
  d.otherNames = union(asList(base.otherNames), lines(answer(row, Q.otherNames))).filter((x) => x !== d.name);

  if (!d.name) throw new SubmissionError("A new profile needs a name.");
  if (!Q.roles.includes(d.post)) throw new SubmissionError(`A new profile needs a role (one of: ${Q.roles.join(", ")}).`);
  const bad = d.otherEmails.find((x) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x));
  if (bad) throw new SubmissionError(`"${bad}" is not an email address.`);
  const clash = profiles.find((p) => p !== existing && emailsOf(p.data).some((x) => d.otherEmails.includes(x)));
  if (clash) throw new SubmissionError(`One of the other email addresses is already used in ${clash.file}.`);

  let file = existing?.file ?? `${fileSlug(d.name)}.md`;
  for (let n = 2; !existing && profiles.some((p) => p.file.toLowerCase() === file.toLowerCase()); n++) file = `${fileSlug(d.name)}_${n}.md`;
  const slug = file.replace(/\.md$/i, "");

  const changes = [];
  const photoCell = answer(row, Q.photo);
  if (photoCell) {
    const jpeg = await photoJpeg(photoCell.split(/,\s*/)[0]);
    const photoFile = `${slug.toLowerCase()}.jpg`;
    fs.mkdirSync(path.join(PROFILES, "photos"), { recursive: true });
    fs.writeFileSync(path.join(PROFILES, "photos", photoFile), jpeg);
    // Remove this person's previous photo when it had another name and nobody else uses it.
    const old = base.photo && path.join(PROFILES, base.photo);
    if (old && path.basename(old) !== photoFile && fs.existsSync(old) && !profiles.some((p) => p !== existing && p.data.photo === base.photo)) {
      fs.rmSync(old);
    }
    d.photo = `./photos/${photoFile}`;
    changes.push("photo");
  }

  const bio = String(answer(row, Q.bio) ?? "").replace(/\r\n/g, "\n").trim();
  const body = bio || existing?.body || "";
  const known = new Set(["email", "post", "name", "photo", "otherEmails", "otherNames", "status", "currentPosition"]);
  const extras = Object.fromEntries(Object.entries(base).filter(([k]) => !known.has(k)));

  if (isUpdate) {
    for (const k of ["name", "post", "status", "currentPosition"]) {
      if (String(base[k] ?? (k === "status" ? "current" : "")) !== String(d[k] ?? "")) changes.push(k);
    }
    if (d.otherEmails.length > asList(base.otherEmails).length) changes.push("otherEmails");
    if (d.otherNames.length > asList(base.otherNames).length) changes.push("otherNames");
    if (body !== (existing.body || "")) changes.push("biography");
    if (!changes.length) throw new SubmissionError("The answers don't change anything in the profile.");
  } else {
    changes.push("new profile");
  }

  fs.writeFileSync(path.join(PROFILES, file), profileMarkdown(d, body, extras));
  const submitter = clean(answer(row, Q.submitter)).toLowerCase();
  return { file: `profiles/${file}`, name: d.name, isUpdate, wantsUpdate, changes, submitter, ownAddress: Boolean(submitter) && emailsOf(d).includes(submitter), photo: Boolean(photoCell) };
}

/* ── Git and GitHub ────────────────────────────────────────────────────────── */

function handledIds() {
  const ids = new Set();
  const add = (s) => {
    const m = String(s).match(/profile-form\/([0-9a-f]{10})\b|response ([0-9a-f]{10})\b/);
    if (m) ids.add(m[1] || m[2]);
  };
  JSON.parse(run("gh", ["pr", "list", "--state", "all", "--limit", "1000", "--json", "headRefName"])).forEach((p) => add(p.headRefName));
  JSON.parse(run("gh", ["issue", "list", "--state", "all", "--limit", "1000", "--search", "Profile form response in:title", "--json", "title"])).forEach((i) => add(i.title));
  run("git", ["ls-remote", "--heads", "origin", "profile-form/*"]).split("\n").forEach(add);
  return ids;
}

function validate() {
  try {
    return { ok: true, output: run("node", ["scripts/validate-people.mjs"]) };
  } catch (err) {
    return { ok: false, output: `${err.stdout || ""}${err.stderr || ""}`.trim() };
  }
}

function prBody(id, s, check) {
  return [
    `Submitted through the MARC profile form (response \`${id}\`).`,
    "",
    `- **File:** \`${s.file}\`${s.isUpdate ? "" : " (new)"}`,
    `- **Changes:** ${s.changes.join(", ")}`,
    `- **Submitted from:** ${s.submitter || "(no email collected)"}${s.ownAddress ? " (one of this profile's addresses)" : ""}`,
    `- **Validator:** ${check.ok ? "✅ passed" : "❌ failed"}`,
    check.ok ? null : "\n```\n" + check.output + "\n```",
    "",
    "Before merging:",
    s.ownAddress ? null : "- [ ] ⚠️ Submitted from an address that is not in this profile: confirm it really is this person.",
    s.photo ? "- [ ] The photo is appropriate and the person agreed to publish it." : null,
    "- [ ] The name, role and biography look right.",
    s.isUpdate && !s.wantsUpdate ? '- [ ] They chose "Add a new profile", but a profile with this address exists, so this updates it.' : null,
    "",
    "Merge to publish, or close to reject (this response won't be proposed again).",
    "Checks don't start by themselves on pull requests opened by a workflow; the validator result above is from this run.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

function withBodyFile(text, fn) {
  const file = path.join(os.tmpdir(), `form-sync-${process.pid}.md`);
  fs.writeFileSync(file, text);
  try {
    return fn(file);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

/* ── Main ──────────────────────────────────────────────────────────────────── */

async function main() {
  const source = process.env.FORM_RESPONSES_CSV;
  if (!source) {
    console.log("FORM_RESPONSES_CSV is not set: nothing to do (google-form/README.md, step 5).");
    return;
  }
  const rows = parseCsv(await readSource(source));
  const handled = DRY ? new Set() : handledIds();
  const todo = rows.filter((row) => !handled.has(responseId(row)));
  console.log(`${rows.length} response(s), ${todo.length} new.`);

  for (const row of todo) {
    const id = responseId(row);
    const branch = `profile-form/${id}`;
    if (!DRY) {
      // Start every response from main, dropping whatever an earlier unusable response left behind.
      run("git", ["reset", "--hard"]);
      run("git", ["clean", "-fd", "profiles"]);
      run("git", ["checkout", "-B", branch, "origin/main"]);
    }
    try {
      const summary = await applyResponse(row);
      const check = validate();
      console.log(`${id}: ${summary.isUpdate ? "update" : "new"} ${summary.file} (${summary.changes.join(", ")}), validator ${check.ok ? "passed" : "failed"}`);
      if (DRY) continue;
      run("git", ["add", "-A", "profiles"]);
      run("git", ["commit", "-m", `${summary.isUpdate ? "Update" : "Add"} profile: ${summary.name} (profile form ${id})`]);
      run("git", ["push", "-u", "origin", branch]);
      withBodyFile(prBody(id, summary, check), (bodyFile) =>
        run("gh", ["pr", "create", "--base", "main", "--head", branch, "--title", `${summary.isUpdate ? "Update" : "Add"} profile: ${summary.name}`, "--body-file", bodyFile, ...(check.ok ? [] : ["--draft"])]),
      );
    } catch (err) {
      if (!(err instanceof SubmissionError)) throw err;
      console.log(`${id}: not usable: ${err.message}`);
      if (DRY) continue;
      const who = clean(answer(row, Q.submitter)) || clean(answer(row, Q.email)) || "(unknown)";
      withBodyFile(
        [
          `A profile form response could not be turned into a pull request.`,
          "",
          `- **Problem:** ${err.message}`,
          `- **Submitted:** ${answer(row, Q.timestamp)} from ${who}`,
          "",
          "Contact the person if needed, then close this issue. The response won't be processed again; they can submit the form again.",
        ].join("\n"),
        (bodyFile) => run("gh", ["issue", "create", "--title", `Profile form response ${id} needs attention`, "--body-file", bodyFile]),
      );
    }
  }
  if (!DRY) {
    run("git", ["reset", "--hard"]);
    run("git", ["checkout", "-f", "main"]);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
