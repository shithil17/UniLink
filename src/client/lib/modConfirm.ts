import { auditActionLabel, auditActions } from "../../shared/auditActions";
import { DEPARTMENTS } from "../../shared/departments";
import type { Role } from "../../shared/modPolicy";
import { notificationCopy } from "../../shared/notificationCopy";
import type { FacultyInput, FacultyPatch, ModFaculty } from "../../shared/schemas/faculty";
import type {
  AuditEntry,
  ModQueuePost,
  ModReport,
  rejectCategory,
} from "../../shared/schemas/moderation";
import type { z } from "zod";
import type { UserAction } from "./mod";
import { categoryLabel, postTypeLabel } from "./modQueue";

/*
 * What the confirm dialog says before a mod or admin action goes out. Every action builds its words
 * here, from the real target and the values the form was submitted with, so the dialog and the
 * request can't drift apart and the wording can be tested without rendering anything.
 *
 * A student ID never goes into a summary: users are named by username only.
 */

/** One labelled line: who or what is affected, the reason entered, a file name. */
export type Fact = { label: string; value: string };

/** One changed field of an edit. Only fields that changed are listed. */
export type Change = { label: string; before: string; after: string };

export type ConfirmContent = {
  /** Names the action: "Ban user", "Hide course". The confirm button wears the same words. */
  title: string;
  confirmLabel: string;
  /** Ban, reject, hide, reverse and reset password use the destructive style. */
  destructive?: boolean;
  /** One sentence that says what is about to happen to whom. */
  lead: string;
  facts: Fact[];
  /** A before and after for each changed field of an edit. */
  changes?: Change[];
  /** Headline figures, such as what an import adds, changes and removes. */
  counts?: Fact[];
  /** What follows from the change, where it is true and known. */
  effects: string[];
};

/** A confirm sheet's content plus the request it sends. */
export type ConfirmRequest = ConfirmContent & {
  /** Sends the request. Resolves when it worked and throws when it didn't. */
  run: () => Promise<unknown>;
};

/** Shown instead of a dialog when an edit leaves every field as it was. */
export const NOTHING_TO_SAVE = "Nothing to save. You haven't changed anything.";

const roleName: Record<Role, string> = { student: "Student", mod: "Mod", admin: "Admin" };

const reasonFact = (reason: string): Fact => ({ label: "Reason", value: reason });

/** The one-line excerpt of a post, so the dialog names it without repeating a whole post. */
const EXCERPT_MAX = 140;
export function excerpt(text: string, max: number = EXCERPT_MAX): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
}

// ---- Users ------------------------------------------------------------------------------------

export type UserTarget = { username: string; role: Role };

const userFact = (user: UserTarget): Fact => ({
  label: "User",
  value: `${user.username} · ${roleName[user.role]}`,
});

export function userActionConfirm(
  action: UserAction,
  user: UserTarget,
  reason: string,
): ConfirmContent {
  const facts = [userFact(user), reasonFact(reason)];
  switch (action) {
    case "ban":
      return {
        title: "Ban user",
        confirmLabel: "Ban user",
        destructive: true,
        lead: `${user.username} will be banned.`,
        facts,
        effects: [
          "They're signed out everywhere and can't log in.",
          "An admin can reverse this from the audit log.",
        ],
      };
    case "unban":
      return {
        title: "Unban user",
        confirmLabel: "Unban user",
        lead: `${user.username} will be unbanned.`,
        facts,
        effects: ["They can log in again."],
      };
    case "reset-password":
      return {
        title: "Reset password",
        confirmLabel: "Reset password",
        destructive: true,
        lead: `${user.username}'s password will be replaced with a temporary one.`,
        facts,
        effects: [
          "They're signed out everywhere.",
          "You get the temporary password once, to pass on. They must choose a new password when they log in.",
          "This can't be reversed.",
        ],
      };
    case "clear-probing":
      return {
        title: "Clear flag",
        confirmLabel: "Clear flag",
        lead: `The probing flag on ${user.username} will be cleared.`,
        facts,
        effects: [
          "Any pause on their posting ends now.",
          "Their count of rejected posts starts again from zero.",
        ],
      };
  }
}

export function roleChangeConfirm(
  user: UserTarget,
  to: "mod" | "student",
  reason: string,
): ConfirmContent {
  const promote = to === "mod";
  return {
    title: promote ? "Make mod" : "Remove as mod",
    confirmLabel: promote ? "Make mod" : "Remove as mod",
    destructive: !promote,
    lead: promote
      ? `${user.username} will become a mod.`
      : `${user.username} will stop being a mod.`,
    facts: [{ label: "User", value: user.username }, reasonFact(reason)],
    changes: [{ label: "Role", before: roleName[user.role], after: roleName[to] }],
    effects: [
      promote
        ? "They get access to the moderation tools."
        : "They lose access to the moderation tools.",
      "An admin can reverse this from the audit log.",
    ],
  };
}

/** The ID-check release: bans the holder and frees the key. The student ID itself is never repeated. */
export function releaseKeyConfirm(holder: UserTarget, reason: string): ConfirmContent {
  return {
    title: "Release ID and ban",
    confirmLabel: "Release ID and ban",
    destructive: true,
    lead: `${holder.username} will be banned and the student ID they registered with will be freed.`,
    facts: [userFact(holder), reasonFact(reason)],
    effects: [
      "The ID's real owner can sign up with it.",
      "They're signed out everywhere and can't log in.",
      "An admin can reverse this while nobody else has taken the ID.",
    ],
  };
}

// ---- Reports and held posts -------------------------------------------------------------------

export function resolveReportConfirm(
  report: Pick<ModReport, "targetLabel" | "reporter" | "reason">,
  outcome: "resolved" | "dismissed",
): ConfirmContent {
  const handled = outcome === "resolved";
  return {
    title: handled ? "Mark report handled" : "Dismiss report",
    confirmLabel: handled ? "Mark handled" : "Dismiss report",
    lead: handled
      ? "This report will be marked as handled."
      : "This report will be dismissed without action.",
    facts: [
      { label: "Reported", value: report.targetLabel ?? "Removed account" },
      { label: "Reported by", value: report.reporter ?? "A removed account" },
      { label: "Their reason", value: excerpt(report.reason) },
    ],
    effects: [
      `It moves to ${handled ? "Handled" : "Dismissed"}. Nothing happens to the reported account or post.`,
    ],
  };
}

const postFacts = (post: ModQueuePost): Fact[] => [
  { label: "Author", value: post.author ?? "Removed account" },
  { label: "Post", value: `${postTypeLabel(post.targetType)} post` },
  { label: "Text", value: excerpt(post.text.join(" · ")) },
];

export function approvePostConfirm(post: ModQueuePost): ConfirmContent {
  return {
    title: "Approve post",
    confirmLabel: "Approve post",
    lead: "This held post will go live.",
    facts: postFacts(post),
    effects: [
      "Other students can see it now.",
      `The author gets an inbox message: "${notificationCopy("post_approved").detail}"`,
    ],
  };
}

export function rejectPostConfirm(
  post: ModQueuePost,
  { category, reason }: { category: z.infer<typeof rejectCategory>; reason: string },
): ConfirmContent {
  return {
    title: "Reject post",
    confirmLabel: "Reject post",
    destructive: true,
    lead: "This held post will be rejected.",
    facts: [
      ...postFacts(post),
      { label: "Category", value: categoryLabel(category) },
      reasonFact(reason),
    ],
    effects: [
      `The author gets an inbox message: "${notificationCopy("post_rejected", { category }).detail}"`,
      "Your reason stays in the audit log. The author doesn't see it.",
    ],
  };
}

// ---- Audit ------------------------------------------------------------------------------------

/** What putting an action back does, in words. Actions with no entry fall back to the general line. */
const REVERSAL_EFFECT: Record<string, string> = {
  [auditActions.ban]: "The user is unbanned and can log in again.",
  [auditActions.unban]: "The user is banned again.",
  [auditActions.roleChange]: "Their role goes back to what it was.",
  [auditActions.releaseKey]:
    "The ID goes back to this account and the ban is put back as it was. It's refused if someone has taken the ID since.",
  [auditActions.softDelete]: "The post is live again.",
  [auditActions.clearProbingFlag]:
    "The flag and the posting pause come back. The count of rejected posts doesn't.",
  [auditActions.facultyEdit]:
    "The edited fields go back to their old values. It's refused if the old initials or name have been taken since.",
  [auditActions.facultyHide]: "The faculty member shows in the picker again.",
  [auditActions.facultyUnhide]: "The faculty member is hidden again.",
  [auditActions.courseEdit]:
    "The edited fields go back to their old values. It's refused if the old code or prerequisite no longer fits.",
  [auditActions.courseHide]: "The course shows on students' maps again.",
  [auditActions.courseUnhide]: "The course is hidden again.",
};

export function reverseConfirm(entry: AuditEntry, reason: string): ConfirmContent {
  const what = entry.targetLabel ?? `${entry.targetType} ${entry.targetId}`;
  return {
    title: "Reverse action",
    confirmLabel: "Reverse action",
    destructive: true,
    lead: `"${auditActionLabel(entry.action)}" on ${what} will be put back.`,
    facts: [
      { label: "Action", value: auditActionLabel(entry.action) },
      { label: "Target", value: what },
      { label: "Done by", value: entry.actor },
      { label: "Entry", value: String(entry.id) },
      { label: "Your reason", value: reason },
    ],
    effects: [
      REVERSAL_EFFECT[entry.action] ?? "It puts back what the action changed.",
      "The reversal is logged too.",
    ],
  };
}

// ---- Faculty ----------------------------------------------------------------------------------

const NONE = "None";

const departmentLabel = (code: string) => {
  const found = DEPARTMENTS.find((d) => d.code === code);
  return found ? `${found.code} · ${found.name}` : code;
};

const FACULTY_FIELDS = [
  ["name", "Name"],
  ["initials", "Initials"],
  ["designation", "Designation"],
  ["department", "Department"],
  ["nsuPage", "NSU page"],
] as const satisfies readonly (readonly [keyof FacultyInput, string])[];

/** Every faculty field is text or empty; the department prints with its name. */
const facultyText = (key: keyof FacultyInput, value: string | null | undefined): string =>
  value == null ? NONE : key === "department" ? departmentLabel(value) : value;

/** The fields a faculty edit changes, as before and after. Empty when nothing changed. */
export function facultyChanges(original: ModFaculty, patch: FacultyPatch): Change[] {
  return FACULTY_FIELDS.flatMap(([key, label]) =>
    patch[key] === undefined
      ? []
      : [
          {
            label,
            before: facultyText(key, original[key]),
            after: facultyText(key, patch[key]),
          },
        ],
  );
}

export function facultyAddConfirm(values: FacultyInput): ConfirmContent {
  return {
    title: "Add faculty",
    confirmLabel: "Add faculty",
    lead: `${values.name} will be added to the faculty directory.`,
    // Optional fields left empty are left out rather than printed as "None".
    facts: FACULTY_FIELDS.filter(([key]) => values[key] !== null).map(([key, label]) => ({
      label,
      value: facultyText(key, values[key]),
    })),
    effects: ["They show in the attempt picker right away."],
  };
}

export function facultyEditConfirm(original: ModFaculty, patch: FacultyPatch): ConfirmContent {
  return {
    title: "Save faculty changes",
    confirmLabel: "Save changes",
    lead: `${original.name} will be updated.`,
    facts: [],
    changes: facultyChanges(original, patch),
    effects: ["Students see the changes right away, including on attempts that name them."],
  };
}

export function facultyHiddenConfirm(
  faculty: Pick<ModFaculty, "name" | "initials">,
  hidden: boolean,
  reason: string,
): ConfirmContent {
  const who = faculty.initials ? `${faculty.name} (${faculty.initials})` : faculty.name;
  return hidden
    ? {
        title: "Hide faculty",
        confirmLabel: "Hide faculty",
        destructive: true,
        lead: `${who} will be hidden from students.`,
        facts: [{ label: "Faculty", value: who }, reasonFact(reason)],
        effects: [
          "They no longer show in the attempt picker.",
          "Attempts that already name them keep the name.",
          "An admin can reverse this from the audit log.",
        ],
      }
    : {
        title: "Show faculty again",
        confirmLabel: "Show again",
        lead: `${who} will show to students again.`,
        facts: [{ label: "Faculty", value: who }, reasonFact(reason)],
        effects: ["They show in the attempt picker again."],
      };
}
