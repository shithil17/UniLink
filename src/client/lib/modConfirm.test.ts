import { describe, expect, it } from "vite-plus/test";
import type { AuditEntry, ModQueuePost } from "../../shared/schemas/moderation";
import type { ModFaculty } from "../../shared/schemas/faculty";
import {
  areaAddConfirm,
  areaHiddenConfirm,
  areaRenameConfirm,
  approvePostConfirm,
  excerpt,
  facultyAddConfirm,
  facultyChanges,
  facultyEditConfirm,
  facultyHiddenConfirm,
  missingTargetLabel,
  rejectPostConfirm,
  removableName,
  removeReportedConfirm,
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
      { targetType: "user", targetLabel: "sam_1", reporter: "rafi_2", reason: "rude" },
      "dismissed",
    );
    expect(dismiss.facts.map((f) => f.value)).toEqual(["sam_1", "rafi_2", "rude"]);
    expect(dismiss.effects[0]).toMatch(/Nothing happens/);
  });

  it("names a missing target by what kind it was, not always as an account", () => {
    expect(missingTargetLabel("user")).toBe("Removed account");
    expect(missingTargetLabel("resource_request")).toBe("A removed request");
    expect(missingTargetLabel("resource_submission")).toBe("A removed link");
    const handled = resolveReportConfirm(
      { targetType: "resource_submission", targetLabel: null, reporter: null, reason: "x" },
      "resolved",
    );
    expect(handled.facts[0]).toEqual({ label: "Reported", value: "A removed link" });
  });

  it("tells the author about an approval and shows the message a rejection sends", () => {
    expect(approvePostConfirm(post).effects.join(" ")).toMatch(/inbox message/);
    const link = approvePostConfirm({ ...post, targetType: "resource_submission" });
    expect(link.effects[0]).toBe("The student who asked can see it now.");
    expect(link.effects[1]).toContain("student who asked can see");
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

describe("reversing a removal", () => {
  const removal: AuditEntry = {
    id: 20,
    actor: "mod_1",
    action: "soft_delete",
    targetType: "resource_submission",
    targetId: "4",
    targetLabel: null,
    reason: "not course material",
    createdAt: 1,
    reverses: null,
    reversedBy: null,
    reversible: true,
  };

  it("names a link or a request and never claims it is live", () => {
    const link = reverseConfirm(removal, "mistake");
    expect(link.lead).toContain("Removed a link");
    expect(link.effects[0]).toBe("The link is restored to how it was before it was removed.");
    const request = reverseConfirm({ ...removal, targetType: "resource_request" }, "mistake");
    expect(request.lead).toContain("Removed a request");
    expect(request.effects[0]).toMatch(/^The request is restored/);
    expect(request.effects[0]).not.toMatch(/live/);
  });
});

describe("area summaries", () => {
  it("says where a new area goes and that adding can't be reversed", () => {
    const sub = areaAddConfirm("Mirpur 10", "Mirpur");
    expect(sub.lead).toContain("sub-area of Mirpur");
    expect(sub.facts).toContainEqual({ label: "Under", value: "Mirpur" });
    expect(areaAddConfirm("Uttara", null).lead).toContain("top-level");
    expect(sub.effects.join(" ")).toMatch(/can't be reversed/);
  });

  it("shows a rename as before and after", () => {
    expect(areaRenameConfirm("Mirpur", "Mirpur DOHS").changes).toEqual([
      { label: "Name", before: "Mirpur", after: "Mirpur DOHS" },
    ]);
  });

  it("hides with the reason and a destructive style, and shows again without one", () => {
    const hide = areaHiddenConfirm("Mirpur", true, "not a pickup point");
    expect(hide.destructive).toBe(true);
    expect(hide.facts).toContainEqual({ label: "Reason", value: "not a pickup point" });
    expect(hide.effects.join(" ")).toMatch(/already use it keep it/);
    expect(areaHiddenConfirm("Mirpur", false, "back").destructive).toBeUndefined();
  });

  it("explains reversing each area action in the audit log", () => {
    const entry = (action: string): AuditEntry => ({
      id: 3,
      actor: "mod_1",
      action,
      targetType: "area",
      targetId: "7",
      targetLabel: "Mirpur",
      reason: "r",
      createdAt: 1,
      reverses: null,
      reversedBy: null,
      reversible: true,
    });
    expect(reverseConfirm(entry("area_hide"), "oops").effects[0]).toMatch(/shows in the ride/);
    expect(reverseConfirm(entry("area_unhide"), "oops").effects[0]).toMatch(/hidden again/);
    expect(reverseConfirm(entry("area_rename"), "oops").effects[0]).toMatch(/old name/);
    expect(reverseConfirm(entry("area_hide"), "oops").lead).toContain("Hid an area");
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

describe("removeReportedConfirm", () => {
  it("names what is removed, the reporter and the reason, and says it can be reversed", () => {
    const c = removeReportedConfirm(
      {
        targetType: "resource_submission",
        targetLabel: "https://example-site.com/x",
        reporter: "sam_1",
      },
      "not course material",
    );
    expect(c.title).toBe("Remove link");
    expect(c.destructive).toBe(true);
    expect(c.facts).toEqual([
      { label: "Removing", value: "https://example-site.com/x" },
      { label: "Reported by", value: "sam_1" },
      { label: "Reason", value: "not course material" },
    ]);
    expect(c.effects.join(" ")).toMatch(/reverse/);
  });

  it("is offered for requests and links, not users", () => {
    expect(removableName("resource_request")).toBe("request");
    expect(removableName("resource_submission")).toBe("link");
    expect(removableName("user")).toBeNull();
  });
});
