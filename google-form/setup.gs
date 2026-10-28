/**
 * MARC website: builds the people-profile Google Form and its response sheet.
 *
 * Paste into a new Apps Script project (script.google.com) owned by the MARC Google account and
 * run setupForm() once. The nightly GitHub Actions in marc_people and marc_projects read the
 * response sheet and open pull requests (scripts/form-sync.mjs). This script never writes to
 * GitHub; it only reads the public project list. See README.md in this folder.
 */

// Same text as questions.json in this folder: the response sheet uses these as column headings.
const Q = {
  action: "What would you like to do?",
  actionNew: "Add a new profile",
  actionUpdate: "Update my existing profile",
  email: "Your main email address",
  name: "Your name, as it should appear on the website",
  post: "Your role at MARC",
  otherEmails: "Other email addresses",
  otherNames: "Other forms of your name in author lists",
  photo: "Profile photo",
  bio: "Biography",
  status: "Are you a current or a past member of MARC?",
  statusCurrent: "Current member",
  statusPast: "Past member",
  currentPosition: "Where are you now? (past members only)",
  projects: "Projects you work on as a researcher",
  roles: ["Director", "Deputy Director", "Research Assistant", "Volunteer"],
};
const PROJECTS_API = "https://api.github.com/repos/pdnMARC/marc_projects/contents/projects";

function setupForm() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("FORM_ID")) {
    throw new Error("A form already exists (script property FORM_ID). Delete that property to create another.");
  }

  const form = FormApp.create("MARC website: your people profile");
  form.setDescription(
    [
      "Add your profile to the People page of the MARC website, or update it.",
      "Every night your answers become a change request that a MARC maintainer reviews before it goes live.",
      "Answers are published in MARC's public GitHub repository; email addresses are never shown on the website itself.",
      "Updating? Fill in only what should change: blank answers keep what is already there.",
    ].join("\n\n"),
  );
  try {
    form.setEmailCollectionType(FormApp.EmailCollectionType.VERIFIED);
  } catch (e) {
    form.setCollectEmail(true); // older Forms API
  }

  form.addMultipleChoiceItem().setTitle(Q.action).setChoiceValues([Q.actionNew, Q.actionUpdate]).setRequired(true);
  form
    .addTextItem()
    .setTitle(Q.email)
    .setHelpText("The address MARC projects use for you, e.g. your @eng.pdn.ac.lk address. Updating? Use any address already in your profile.")
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build())
    .setRequired(true);
  form.addTextItem().setTitle(Q.name).setHelpText("Required for a new profile, e.g. Jane Doe.");
  form.addListItem().setTitle(Q.post).setHelpText("Required for a new profile.").setChoiceValues(Q.roles);
  form
    .addParagraphTextItem()
    .setTitle(Q.otherEmails)
    .setHelpText("Any other address a project may list for you (student, old or personal). One per line. Added to your profile, never removed.");
  form
    .addParagraphTextItem()
    .setTitle(Q.otherNames)
    .setHelpText("Every other way your name is written in your papers, so they appear on your profile. One per line, e.g.  Doe, J.  or  J. A. Doe");
  form
    .addParagraphTextItem()
    .setTitle(Q.bio)
    .setHelpText("A few sentences about you and your research. Links can be written as [text](https://…). Leave blank to keep your current biography.");
  form
    .addMultipleChoiceItem()
    .setTitle(Q.status)
    .setHelpText("Leave blank to keep your current setting.")
    .setChoiceValues([Q.statusCurrent, Q.statusPast]);
  form.addTextItem().setTitle(Q.currentPosition).setHelpText('Shown as "Now: …" for past members, e.g. PhD, Columbia University, USA');
  form
    .addCheckboxItem()
    .setTitle(Q.projects)
    .setHelpText("You are added to the team of each project you tick. Supervisors: please ask a maintainer.")
    .setChoiceValues(projectTitles_());

  const sheet = SpreadsheetApp.create("MARC profile form (responses)");
  form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
  SpreadsheetApp.flush();
  const tab = SpreadsheetApp.openById(sheet.getId())
    .getSheets()
    .find((s) => /^Form Responses/i.test(s.getName()));

  props.setProperty("FORM_ID", form.getId());
  console.log(
    [
      "Form created.",
      "Edit the form:   " + form.getEditUrl(),
      "Share this link: " + form.getPublishedUrl(),
      "Response sheet:  " + sheet.getUrl(),
      tab
        ? "CSV link for GitHub (README step 4): https://docs.google.com/spreadsheets/d/" + sheet.getId() + "/export?format=csv&gid=" + tab.getSheetId()
        : "Open the response sheet to find the gid of the 'Form Responses 1' tab (README step 4).",
      "Next: add the photo question (README step 2).",
    ].join("\n"),
  );
}

/** Re-reads the project list from GitHub. Run after projects are added or renamed (or on a daily trigger). */
function refreshProjectChoices() {
  const form = FormApp.openById(PropertiesService.getScriptProperties().getProperty("FORM_ID"));
  const item = form.getItems().find((i) => i.getTitle() === Q.projects);
  if (!item) throw new Error(`No "${Q.projects}" question in the form.`);
  item.asCheckboxItem().setChoiceValues(projectTitles_());
}

/** Project titles from the public marc_projects repository (the `project:` field of each file). */
function projectTitles_() {
  const files = JSON.parse(UrlFetchApp.fetch(PROJECTS_API).getContentText());
  const titles = files
    .filter((f) => f.type === "file" && /\.md$/i.test(f.name) && !/^readme\.md$/i.test(f.name))
    .map((f) => {
      const text = UrlFetchApp.fetch(f.download_url).getContentText("UTF-8");
      const m = text.match(/^project:\s*(.+)$/m);
      return m ? m[1].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1") : "";
    })
    .filter(Boolean);
  if (!titles.length) throw new Error("Could not read the project list from GitHub.");
  return titles.sort((a, b) => a.localeCompare(b));
}
