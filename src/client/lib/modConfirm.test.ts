import { describe, expect, it } from "vite-plus/test";
import type { AuditEntry, ModQueuePost } from "../../shared/schemas/moderation";
import type { ModFaculty } from "../../shared/schemas/faculty";
import {
  approvePostConfirm,
  excerpt,
  facultyAddConfirm,
  facultyChanges,
  facultyEditConfirm,
  facultyHiddenConfirm,
  rejectPostConfirm,
  releaseKeyConfirm,
  resolveReportConfirm,
  reverseConfirm,
  roleChangeConfirm,
  userActionConfirm,
} from "./modConfirm";

const user = { username: "rafi_2", role: "student" as const };

const faculty: ModFaculty = {
  id: 4,
  name: "Dr. Rashid Khan",
  initials: "RkZ",
  designation: "Professor",
  department: "ECE",
  nsuPage: null,
  hidden: false,
};

const post: ModQueuePost = {
  kind: "post",
  targetType: "lost_found",
  id: 3,
  text: ["Found a black umbrella"],
  author: "rafi_2",
  category: "scam_or_spam",
  confidence: 0.64,
  flags: [],
  model: null,
  appealed: false,
};

describe("user action summaries", () => {
  it("names the action, the user and the reason, and says what follows", () => {
    const ban = userActionConfirm("ban", user, "posted a scam");
    expect(ban.title).toBe("Ban user");
    expect(ban.confirmLabel).toBe("Ban user");
    expect(ban.destructive).toBe(true);
    expect(ban.facts).toEqual([
      { label: "User", value: "rafi_2 · Student" },
      { label: "Reason", value: "posted a scam" },
    ]);
  });

  it.each([
    ["ban", true, /signed out/],
    ["reset-password", true, /can't be reversed/],
    ["unban", false, undefined],
    ["clear-probing", false, undefined],
  ] as const)("%s: destructive style %s, and says what follows", (action, destructive, effect) => {
    const summary = userActionConfirm(action, user, "reason");
    expect(summary.destructive ?? false).toBe(destructive);
    if (effect) expect(summary.effects.join(" ")).toMatch(effect);
  });

  it("shows a role change as a before and after", () => {
    expect(roleChangeConfirm(user, "mod", "helps a lot").changes).toEqual([
      { label: "Role", before: "Student", after: "Mod" },
    ]);
    const demote = roleChangeConfirm({ ...user, role: "mod" }, "student", "inactive");
    expect(demote.changes).toEqual([{ label: "Role", before: "Mod", after: "Student" }]);
    expect(demote.destructive).toBe(true);
  });

  it("never carries a student ID when releasing a key", () => {
    const release = releaseKeyConfirm(user, "not the owner");
    const text = JSON.stringify(release);
    expect(text).toContain("rafi_2");
    expect(text).not.toMatch(/\d{7}/);
  });
});

describe("report and post summaries", () => {
  it("says a dismissed report leaves the reported account alone", () => {
    const dismiss = resolveReportConfirm(
      { targetLabel: "sam_1", reporter: "rafi_2", reason: "rude" },
      "dismissed",
    );
    expect(dismiss.facts.map((f) => f.value)).toEqual(["sam_1", "rafi_2", "rude"]);
    expect(dismiss.effects[0]).toMatch(/Nothing happens/);
  });

  it("tells the author about an approval and shows the message a rejection sends", () => {
    expect(approvePostConfirm(post).effects.join(" ")).toMatch(/inbox message/);
    const reject = rejectPostConfirm(post, {
      category: "scam_or_spam",
      reason: "looks like a scam",
    });
    expect(reject.destructive).toBe(true);
    expect(reject.facts).toContainEqual({ label: "Category", value: "Scam or spam" });
    expect(reject.facts).toContainEqual({ label: "Reason", value: "looks like a scam" });
    expect(reject.effects.join(" ")).toMatch(/doesn't see/);
  });
});

describe("reversal summary", () => {
  const entry: AuditEntry = {
    id: 12,
    actor: "mod_1",
    action: "ban",
    targetType: "user",
    targetId: "5",
    targetLabel: "rafi_2",
    reason: "posted a scam",
    createdAt: 1,
    reverses: null,
    reversedBy: null,
    reversible: true,
  };

  it("names the entry, its target and what putting it back does", () => {
    const reverse = reverseConfirm(entry, "was a mistake");
    expect(reverse.destructive).toBe(true);
    expect(reverse.lead).toContain("rafi_2");
    expect(reverse.facts).toContainEqual({ label: "Done by", value: "mod_1" });
    expect(reverse.effects[0]).toMatch(/unbanned/);
  });
});

describe("faculty summaries", () => {
  it("lists only the changed fields, each as before and after", () => {
    const changes = facultyChanges(faculty, { designation: "Associate Professor", initials: null });
    expect(changes).toEqual([
      { label: "Initials", before: "RkZ", after: "None" },
      { label: "Designation", before: "Professor", after: "Associate Professor" },
    ]);
  });

  it("prints a department with its name", () => {
    expect(facultyChanges(faculty, { department: "CEE" })).toEqual([
      {
        label: "Department",
        before: "ECE · Electrical and Computer Engineering",
        after: "CEE · Civil and Environmental Engineering",
      },
    ]);
  });

  it("reports no changes for an empty patch", () => {
    expect(facultyChanges(faculty, {})).toEqual([]);
    expect(facultyEditConfirm(faculty, {}).changes).toEqual([]);
  });

  it("leaves empty optional fields out of an addition", () => {
    const add = facultyAddConfirm({
      name: "Dr. New",
      initials: null,
      designation: "Lecturer",
      department: "ECE",
      nsuPage: null,
    });
    expect(add.facts.map((f) => f.label)).toEqual(["Name", "Designation", "Department"]);
  });

  it("explains hiding and showing", () => {
    const hide = facultyHiddenConfirm(faculty, true, "left NSU");
    expect(hide.destructive).toBe(true);
    const show = facultyHiddenConfirm(faculty, false, "returned");
    expect(show.destructive).toBeUndefined();
  });
});

describe("excerpt", () => {
  it("flattens whitespace and cuts long text", () => {
    expect(excerpt("a\n  b")).toBe("a b");
    expect(excerpt("x".repeat(200), 20)).toHaveLength(20);
    expect(excerpt("x".repeat(200), 20).endsWith("…")).toBe(true);
  });
});
