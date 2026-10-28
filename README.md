# marc_people

:wave: This repository stores the people profiles that are pulled into the MARC website during deployment.

If your pull request is merged here, the website workflow will clone this repository into the website build, and your profile can appear on the live site.

**No GitHub account?** Use the MARC profile form instead (its link is on the website's Documentation page). Every night at midnight Sri Lanka time, new form responses become pull requests here for a maintainer to review: see [google-form/README.md](google-form/README.md).

## :pencil2: Quick start: update your own profile

Everyone at MARC keeps their own profile up to date. You can do it entirely in the browser:

1. Open your file in [`profiles/`](profiles/) and click the pencil icon (**Edit this file**).
2. Sign in to GitHub if asked. If you are not a member of this repository, GitHub offers to fork it for you. Accept.
3. Change the front matter (`name`, `post`, `photo`) or the biography below it.
4. Click **Commit changes…** (or **Propose changes**), then **Create pull request**.
5. When a MARC maintainer merges the pull request, the website rebuilds and your changes go live.

**On a project?** Your profile does not list your projects; each project file lists its team. Add your `email` (copied from your profile) under `projectMembers` or `supervisors` in each project's file in [marc_projects/projects](https://github.com/pdnMARC/marc_projects/tree/main/projects), and open a pull request there too. The two pull requests can be merged in either order. Guide: [Add yourself to your projects](https://pdnmarc.github.io/docs/profiles/#add-yourself-to-your-projects).

To change your photo, first upload the new image to [`profiles/photos/`](profiles/photos/) (**Add file → Upload files**), then point `photo:` at it, for example `photo: ./photos/jane_doe.jpg`.

Your `email` and `name` link you to your projects and publications. To replace one, move the old value to `otherEmails` / `otherNames` instead of deleting it (see **Linking keys** below).

New to MARC? Follow **Option A** below to add a new profile.

## :file_folder: Where things go

```text
marc_people/
├── profiles/              ← one Markdown file per person
│   ├── Jane_Doe.md
│   └── photos/            ← profile photos
│       └── jane_doe.jpg
└── scripts/validate-people.mjs
```

Markdown files outside `profiles/` are not picked up by the website, and the validator reports them.

## :key: Linking keys: how a profile connects to projects and publications

These fields connect a profile to the rest of the website. Everything else (`post`, `photo`, biography) is safe to change at any time.

| Field | Linked from | Purpose |
|---|---|---|
| `email` | `projectMembers` / `supervisors` in [marc_projects](https://github.com/pdnMARC/marc_projects) | Your main address and unique identifier. Never shown on the website. |
| `otherEmails` (optional list) | The same project lists | Any other address a project may use for you: student, old or personal. |
| `name` | `Authors` column of the MARC Publications sheet | Your display name, and the first form used to find your papers. |
| `otherNames` (optional list) | The same Authors column | Other forms of your name in author lists, e.g. `"Ratnayake, A."` or `"R. M. A. Ratnayake"`. At least two words each; quote forms that contain a comma. |

```yaml
email: jane.doe@eng.pdn.ac.lk
otherEmails:
  - e19999@eng.pdn.ac.lk
name: Jane Doe
otherNames:
  - "Doe, J."
  - "J. A. Doe"
```

- Matching ignores upper and lower case, and for names also full stops and spacing (`J.A. Doe` = `J. A. Doe`).
- **Changing your email or name:** put the new value in `email` / `name` and move the old one to `otherEmails` / `otherNames`. Projects and papers that use the old one keep linking to you, with no other file to edit.
- An address or a name form may belong to one profile only; the validator reports clashes. Make name forms specific enough not to match a colleague.
- **The file name** is your page address (`Jane_Doe.md` → `/people/jane_doe/`). Renaming it breaks links shared elsewhere.

Full guide: [pdnmarc.github.io/docs/profiles](https://pdnmarc.github.io/docs/profiles/)

## :wave: When you leave MARC

Don't delete your profile. Add these two lines to its front matter instead:

```yaml
status: past
currentPosition: "PhD, Example University, USA"
```

Your profile moves to **Past members** on the People page (with "Now: …" from `currentPosition`), and keeps all its links: your projects and publications stay on your profile, and you stay on those project pages, marked as a past member. Keep `post` as the role you held at MARC, and leave your lines in the project files. `currentPosition` is only allowed together with `status: past`.

## :sparkles: What you will add

You will usually add:
- one Markdown file for your profile inside `profiles/`
- optionally one photo file inside `profiles/photos/`

A typical profile file looks like this:

```md
---
email: your-email@example.com
post: Research Assistant
name: Your Name
photo: ./photos/your_name.jpg
---
Write your short biography here in Markdown.
```

The text below the front matter becomes the biography section on your profile page.

## :brain: Before you start

You should have:
- a GitHub account
- basic familiarity with editing files and committing changes
- an email address to place in the front matter

The `email` field is important. In the website data model it acts as the primary key for a person. That means it is the main unique identifier used to connect your profile to projects and publications.

You are free to use any email address you want, but once other data starts referring to that email, changing it later can break those links.

## :triangular_ruler: YAML front matter basics

The block between the top `---` line and the next `---` line is YAML front matter.

This is where the website reads your profile metadata.

A few YAML gotchas to watch for:
- every field name must be followed by a colon, like `email:`
- do not use tabs for indentation
- if a value contains special characters, a colon, or you just want to be safe, wrap it in quotes
- do not forget the closing `---` line before your normal Markdown biography starts
- the `photo` path must match the actual file name exactly
- avoid extra spaces inside file paths

Good example:

```yaml
email: jane.doe@example.com
post: Volunteer
name: Jane Doe
photo: ./photos/jane_doe.jpg
```

Safe quoted example:

```yaml
name: "Jane Doe"
post: "Research Assistant"
```

Since the people front matter only uses single values and not YAML lists, it is simpler than `marc_projects`, but the field names and colons still need to be correct.

## :memo: What you can write in the content section

Everything below the closing `---` line is normal Markdown content.

For people profiles, this usually means your biography. You can include:
- plain paragraphs
- section headings
- bullet lists
- links
- emphasis such as bold or italic text
- images using Markdown syntax

Example:

```md
---
email: jane.doe@example.com
post: Volunteer
name: Jane Doe
photo: ./photos/jane_doe.jpg
---
Jane Doe is interested in biomedical signal processing and machine learning.

## Research Interests

- Wearable sensing
- Signal processing
- Applied AI

You can also link to your work: [Google Scholar](https://scholar.google.com/).

Here is an inline image:
![Lab photo](./photos/jane_doe.jpg)
```

If you include an image in the content section, put it in `profiles/photos/` and use a path relative to your profile file, such as `./photos/jane_doe_lab.jpg`.


Keep it reasonably simple and readable. Plain paragraphs are completely fine.

## :bookmark_tabs: Fields used by the website

The website currently validates each person entry with these fields:
- `email`: must be a valid email address
- `post`: your role
- `name`: your display name
- `photo`: optional image path
- `otherEmails`: optional list of other email addresses, used to match project teams
- `otherNames`: optional list of other forms of your name, used to match publication authors
- `status`: optional, `current` (default) or `past`
- `currentPosition`: optional, past members only: where they are now, e.g. `"PhD, Columbia University, USA"`

The website also renders your Markdown content as the biography on your profile page.

## :label: Supported roles

Use one of these exact values for `post`:
- `Director`
- `Deputy Director`
- `Research Assistant`
- `Volunteer`

These values come from the website code. If you use a different role, the website may not show your profile in the main people listing.

## :globe_with_meridians: Option A: Edit using the GitHub website

This is the easiest option if you do not want to use Git locally.

### 1. Fork the repository

1. Open `pdnMARC/marc_people` on GitHub.
2. Click `Fork`.
3. Create the fork under your own GitHub account.

### 2. Create your profile file in the browser

1. Open your fork on GitHub.
2. Open the `profiles/` folder, then click `Add file`.
3. Choose `Create new file`.
4. Name the file something clear, for example:

```text
profiles/Jane_Doe.md
```

5. Paste your profile content.

Example:

```md
---
email: jane.doe@example.com
post: Volunteer
name: Jane Doe
photo: ./photos/jane_doe.jpg
---
Jane Doe works on ...

Her interests include ...
```

### 3. Add your photo in the browser

If you want a profile photo:

1. Open the `profiles/photos/` folder in your fork.
2. Click `Add file`.
3. Choose `Upload files`.
4. Upload your image.
5. Make sure the `photo` field matches the uploaded file name exactly.

Example:

```md
photo: ./photos/jane_doe.jpg
```

Notes:
- Common formats such as `.jpg`, `.jpeg`, and `.png` are appropriate.
- If you do not add a `photo`, the website can fall back to a default avatar.
- There is no separate people cover photo field in the current website validation. For people profiles, the supported image field is `photo`.

### 4. Edit an existing profile on GitHub

If you already have a profile and just want to update it:

1. Open your existing `.md` file in the `profiles/` folder of your fork.
2. Click the pencil icon to edit it.
3. Update the front matter or biography.
4. Scroll down and commit the change to a new branch.
5. Open a pull request.

You can manage both new profiles and later updates entirely from the GitHub website this way.

### 5. Commit your changes on GitHub

When editing in the browser:

1. Scroll to the commit section below the editor.
2. Enter a short commit message such as `Add profile for Jane Doe`.
3. Choose `Create a new branch for this commit and start a pull request` if GitHub offers it.
4. Click `Propose changes` or `Commit changes`.

### 6. Open a pull request

1. GitHub will usually guide you to a pull request page.
2. Open a pull request from your fork to `pdnMARC/marc_people:main`.
3. Briefly say that you are adding or updating your profile.

## :computer: Option B: Edit locally with Git

Use this option if you prefer working on your own machine.

### 1. Fork the repository

1. Open the `pdnMARC/marc_people` repository on GitHub.
2. Click `Fork`.
3. Create the fork under your own GitHub account.

### 2. Clone your fork

```bash
git clone https://github.com/<your-github-username>/marc_people.git
cd marc_people
```

### 3. Create a branch

```bash
git checkout -b add-my-profile
```

Use any clear branch name such as `add-jane-doe-profile`.

### 4. Add your profile file

Create a new Markdown file inside the `profiles/` folder.

Example:

```text
profiles/Jane_Doe.md
```

Add front matter at the top of the file.

Required fields:
- `email`
- `post`
- `name`

Optional fields:
- `photo`
- `otherEmails`
- `otherNames`
- `status`
- `currentPosition`

Example:

```md
---
email: jane.doe@example.com
post: Volunteer
name: Jane Doe
photo: ./photos/jane_doe.jpg
---
Jane Doe works on ...

Her interests include ...
```

### 5. Add your biography

After the front matter, write your biography in Markdown.

Plain paragraphs are enough.

### 6. Add your photo

If you want a profile photo:

1. Put the image file inside the `profiles/photos/` folder.
2. Reference it in the `photo` field.

Example:

```md
photo: ./photos/jane_doe.jpg
```

### 7. Commit and push

```bash
git add .
git commit -m "Add profile for Jane Doe"
git push origin add-my-profile
```

### 8. Open a pull request

1. Go to your fork on GitHub.
2. Open a pull request from your branch to `pdnMARC/marc_people:main`.
3. In the pull request description, briefly state that you are adding or updating your profile.

## :arrows_counterclockwise: How the website uses this repository

The MARC website GitHub Actions workflow clones `pdnMARC/marc_people` into the website build as the people collection.

That is why profile changes belong in this repository rather than directly in the website repository.

In practice, the flow is:
1. You update `marc_people`.
2. Your pull request is merged.
3. The website workflow pulls this repository during deployment.
4. Your profile becomes part of the website build.

## :white_check_mark: Checklist before opening the pull request

- Your Markdown file is in the `profiles/` folder.
- Your front matter includes `email`, `post`, and `name`.
- Your `post` value matches one of the supported roles exactly.
- Your `email` is the identifier you want the system to use going forward.
- Your `photo` path is correct if you added an image.
- Your biography is below the closing `---` line.