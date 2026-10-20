import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  FakeModelStep,
  ModelCapReachedError,
  StubModelStep,
  withDailyCap,
} from "../adapters/modelStep";
import { getDb } from "../db/client";
import { limits } from "../limits";
import { recordScreening } from "./record";
import { screen } from "./screen";

const db = () => getDb(env.DB);

type AuditRow = {
  actor: string;
  action: string;
  target_type: string;
  target_id: string;
  before: string | null;
  reason: string | null;
  created_at: number;
};
const auditRows = () =>
  env.DB.prepare("SELECT * FROM audit_log ORDER BY id")
    .all<AuditRow>()
    .then((r) => r.results);

beforeEach(async () => {
  for (const table of ["audit_log", "rate_limits"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
});

describe("recordScreening", () => {
  it("writes an automod audit row with the model, category, scores and a text snapshot", async () => {
    const model = new FakeModelStep(
      async () => ({
        verdict: "review",
        category: "scam_or_spam",
        confidence: 0.6,
        scores: { scam_or_spam: 0.6, fine: 0.3 },
      }),
      { name: "clef-flash" },
    );
    const result = await screen({ texts: ["Selling my bike, DM me"] }, { model });

    await recordScreening(db(), result, { type: "ride", id: 7 }, 5000);

    const [row] = await auditRows();
    expect(row).toMatchObject({
      actor: "automod",
      action: "automod_hold",
      target_type: "ride",
      target_id: "7",
      reason: "scam_or_spam (model)",
      created_at: 5000,
    });
    expect(JSON.parse(row.before ?? "")).toMatchObject({
      text: "Selling my bike, DM me",
      model: "clef-flash",
      category: "scam_or_spam",
      confidence: 0.6,
      scores: { scam_or_spam: 0.6, fine: 0.3 },
    });
  });

  it("records approvals and rule rejections, and never stores an ID in the snapshot", async () => {
    const stub = new StubModelStep();
    await recordScreening(db(), await screen({ texts: ["fine post"] }, { model: stub }), {
      type: "ride",
      id: 1,
    });
    await recordScreening(db(), await screen({ texts: ["id 221 2345 042"] }, { model: stub }), {
      type: "ride",
      id: 2,
    });

    const rows = await auditRows();
    expect(rows.map((r) => [r.actor, r.action])).toEqual([
      ["automod", "automod_approve"],
      ["automod", "automod_reject"],
    ]);
    expect(rows[1].before).not.toContain("2345");
    expect(JSON.parse(rows[1].before ?? "").rules).toEqual([
      { rule: "student_id", category: "personal_data", index: 0 },
    ]);
  });
});

describe("withDailyCap", () => {
  it("lets calls through up to the cap, then holds posts for review", async () => {
    const inner = new FakeModelStep(async () => ({
      verdict: "approve",
      category: "fine",
      confidence: null,
      scores: {},
    }));
    const capped = withDailyCap(inner, db(), () => 1_000);

    // One call short of the cap for the current UTC day.
    await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, 0, ?)")
      .bind("model-cap:fake", limits.screen.modelDailyCap - 1)
      .run();
    await capped.review({ text: "x", images: [] }, new AbortController().signal);
    await expect(
      capped.review({ text: "x", images: [] }, new AbortController().signal),
    ).rejects.toBeInstanceOf(ModelCapReachedError);

    const held = await screen({ texts: ["a fine post"] }, { model: capped });
    expect(held).toMatchObject({ status: "pending_review", failure: "cap" });
    expect(inner.calls).toHaveLength(1);
  });
});
