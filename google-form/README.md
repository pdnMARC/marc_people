# Profile form

A Google Form lets MARC members add or update their People profile without a GitHub account. Every night at 00:00 Sri Lanka time a GitHub Action turns new responses into pull requests, and a maintainer reviews them before they go live.

```text
Google Form ──► response sheet (CSV) ──► nightly GitHub Actions ──► pull requests ──► maintainer merges ──► website rebuilds
                                            marc_people:   profile + photo
                                            marc_projects: project teams
```

| File | What it does |
|---|---|
| `setup.gs` | Google Apps Script that builds the form and its response sheet (run once). |
| `questions.json` | The question titles. They are the response sheet's column headings, so the form and the sync scripts must agree. |
| `../scripts/form-sync.mjs` | Turns responses into profile pull requests (photo resized to 800 px, location and camera data removed). |
| `../.github/workflows/form-sync.yml` | Runs the sync every night, or on demand. |
| `marc_projects/scripts/form-sync.mjs` | Adds respondents to the projects they ticked, in a second pull request. |

The same pattern runs the student profiles of [people.ce.pdn.ac.lk](https://github.com/cepdnaclk/people.ce.pdn.ac.lk) (`GOOGLE_FORM_CSV_LINK`, nightly at 18:30 UTC). Unlike that site, nothing here is committed straight to `main`: every change is a pull request.

## How a response is handled

- **New profile:** a new file `profiles/First_Last.md`, plus the photo in `profiles/photos/`.
- **Update:** the profile is found by any of its addresses (`email` or `otherEmails`). A filled-in answer replaces the current value, a blank answer keeps it, and `otherEmails` / `otherNames` are only ever added to, so an update never breaks a link to a project or publication.
- **Projects ticked:** the person's email is added to `projectMembers` in each project they are not already on (a separate pull request in marc_projects).
- **Unusable response** (unknown address for an update, no role for a new profile, a photo that can't be read, nothing to change, …): an issue titled *Profile form response … needs attention* instead of a pull request.
- **Each response is handled once.** Its id is in the branch name (`profile-form/<id>`). Closing a pull request or issue rejects that response for good; the person can send the form again.

## One-time setup

You need the MARC Google account that should own the form, and admin access to `pdnMARC/marc_people` and `pdnMARC/marc_projects`.

### 1. Create the form

1. Signed in as the MARC account, open [script.google.com](https://script.google.com) and create a **New project**.
2. Replace the editor's contents with [`setup.gs`](setup.gs) and save.
3. Choose `setupForm` in the function list and click **Run**. Allow the permissions it asks for (create a form and a spreadsheet, read the public project list from GitHub).
4. Open **Execution log**. It prints the form's edit link, the link to share, the response sheet, and the **CSV link** you need in step 5.

### 2. Add the photo question

Apps Script can't create file-upload questions, so add this one by hand in the form editor:

- Type **File upload**, title exactly `Profile photo`.
- Allow only specific file types: **Image**. Maximum number of files: **1**. Maximum file size: **10 MB**.
- Help text, for example: *A clear, recent photo of your face, square if possible. Leave empty to keep your current photo.*

File-upload questions make respondents sign in with a Google account, which also records who sent each response.

### 3. Check the form settings

- **Settings → Responses → Collect email addresses: Verified** (set by the script).
- If MARC uses Google Workspace, consider **Restrict to users in your organisation**.
- Leave **Limit to 1 response** off: people update their profile more than once.

### 4. Share the responses with the Action

The Action reads the responses without a Google login, so both of these need **General access → Anyone with the link → Viewer** (in Google Drive, **Share**):

- the response sheet *MARC profile form (responses)*;
- the folder of uploaded photos, *MARC website: your people profile (File responses)*, created after the first photo upload (send a test response first).

Anyone holding these links can see the responses. The links are stored only as a GitHub secret (step 5) and are never published.

### 5. Connect GitHub (in both marc_people and marc_projects)

1. **Settings → Secrets and variables → Actions → New repository secret**
   - Name: `GOOGLE_FORM_CSV_LINK`
   - Value: the CSV link from step 1, in the form
     `https://docs.google.com/spreadsheets/d/<sheet id>/export?format=csv&gid=<tab id>`
     (the `gid` is the number after `#gid=` in the address bar when the *Form Responses 1* tab is open).
2. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create and approve pull requests**. For an organisation repository this may first need allowing in the organisation's settings.

### 6. Test it

1. Send a test response (for example an update to your own profile).
2. **Actions → Profile Form Sync → Run workflow**, in both repositories.
3. A pull request appears in marc_people (and in marc_projects if you ticked a project). Close them if they were only a test.

### 7. Publish the form link

Put the form's share link in `forms.profile` in `src/data/site.ts` of the website repository. The documentation pages then show a **Use the profile form** button.

## Reviewing submissions

Each pull request lists what changed, who submitted it and the validator result, with a short checklist:

- **Submitted from an address not in the profile?** Confirm it really is that person before merging.
- **Photo:** check it is appropriate and the person agreed to publish it.
- **Merge** to publish (the website rebuilds), or **close** to reject.

Checks don't start by themselves on pull requests opened by a workflow; the validator result in the description is from the sync run. To run the checks on GitHub too, close and reopen the pull request.

## Maintenance

- **Projects added or renamed:** in the Apps Script project, run `refreshProjectChoices` (or add a daily time-driven trigger for it) so the form lists the current projects.
- **Changing a question's wording:** change it in the form, in `questions.json`, in `setup.gs` and in `Q` at the top of `marc_projects/scripts/form-sync.mjs`. The response sheet's column heading changes with the question.
- **Role list:** the roles come from `allowedRoles` in `scripts/validate-people.mjs`; keep `questions.json` and the form's drop-down in step.
- **Scheduled runs stop** after 60 days without any activity in a public repository. GitHub sends a notice; re-enable the workflow from the Actions tab.

## Trying it locally

```bash
npm install
DRY_RUN=1 FORM_RESPONSES_CSV=path/to/responses.csv node scripts/form-sync.mjs
```

`DRY_RUN=1` applies every response to the working tree and prints a summary, without git or GitHub. Download the CSV from the response sheet (**File → Download → CSV**). Use a scratch copy of the repository, and `git checkout -- profiles` to undo.
