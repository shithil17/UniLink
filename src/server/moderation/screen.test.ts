import { describe, expect, it, vi } from "vite-plus/test";
import { makeWebp } from "../../shared/webp.fixture";
import { FakeModelStep, ModelCapReachedError, StubModelStep } from "../adapters/modelStep";
import { forceReviewFromEnv, moderationValues, screen } from "./screen";

const approve = { verdict: "approve", category: "fine", confidence: 0.97, scores: { fine: 0.97 } };
const fakeApprove = () => new FakeModelStep(async () => approve);
const clean = { texts: ["Lost a blue umbrella near the library"] };

describe("screen: rules first", () => {
  it("rejects a rule violation without ever calling the model step", async () => {
    const model = fakeApprove();
    const spy = vi.spyOn(model, "review");

    const result = await screen({ texts: ["my id is 221 2345 042"] }, { model });

    expect(spy).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      verdict: "reject",
      status: "rejected",
      category: "personal_data",
      source: "rules",
      modelName: null,
    });
    expect(result.flags.map((f) => f.rule)).toEqual(["student_id"]);
    expect(result.snapshot).not.toContain("2345");
  });

  it("rejects an invalid image through the rules, without calling the model", async () => {
    const model = fakeApprove();
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0]);

    const result = await screen({ ...clean, images: [png] }, { model });

    expect(model.calls).toHaveLength(0);
    expect(result).toMatchObject({ verdict: "reject", source: "rules" });
    expect(result.flags[0]).toMatchObject({ rule: "image" });
  });

  it("applies the rules even when review is forced", async () => {
    const result = await screen(
      { texts: ["selling yaba"] },
      { model: fakeApprove(), forceReview: true },
    );
    expect(result.verdict).toBe("reject");
  });
});

describe("screen: the stub model step", () => {
  it("publishes text-only posts", async () => {
    const result = await screen(clean, { model: new StubModelStep() });
    expect(result).toMatchObject({
      verdict: "approve",
      status: "published",
      source: "model",
      modelName: "stub",
    });
  });

  it("holds a post with images for review", async () => {
    const result = await screen({ ...clean, images: [makeWebp()] }, { model: new StubModelStep() });
    expect(result).toMatchObject({
      verdict: "review",
      status: "pending_review",
      modelName: "stub",
    });
  });
});

describe("screen: forced review", () => {
  it("holds a clean post and skips the model", async () => {
    const model = fakeApprove();
    const result = await screen(clean, { model, forceReview: true });
    expect(result).toMatchObject({ verdict: "review", status: "pending_review", source: "forced" });
    expect(model.calls).toHaveLength(0);
  });

  it("is on only for the exact value 1", () => {
    expect(forceReviewFromEnv({})).toBe(false);
    expect(forceReviewFromEnv({ SCREEN_FORCE_REVIEW: "true" })).toBe(false);
    expect(forceReviewFromEnv({ SCREEN_FORCE_REVIEW: "1" })).toBe(true);
  });
});

describe("screen: fail safe", () => {
  it("holds the post when the model step throws", async () => {
    const model = new FakeModelStep(async () => {
      throw new Error("boom");
    });
    const result = await screen(clean, { model });
    expect(result).toMatchObject({
      status: "pending_review",
      source: "fail_safe",
      failure: "error",
    });
  });

  it("holds the post when the model step times out, and aborts it", async () => {
    let aborted = false;
    const model = new FakeModelStep(
      (_input, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => {
            aborted = true;
            reject(new Error("aborted"));
          });
        }),
    );
    const result = await screen(clean, { model, timeoutMs: 20 });
    expect(result).toMatchObject({
      status: "pending_review",
      source: "fail_safe",
      failure: "timeout",
    });
    expect(aborted).toBe(true);
  });

  it("holds the post when the daily cap is used up", async () => {
    const model = new FakeModelStep(async () => {
      throw new ModelCapReachedError();
    });
    const result = await screen(clean, { model });
    expect(result).toMatchObject({ status: "pending_review", failure: "cap" });
  });

  it("holds the post when the model answers with something that is not valid", async () => {
    const model = new FakeModelStep(async () => ({ verdict: "publish-it", category: "fine" }));
    const result = await screen(clean, { model });
    expect(result).toMatchObject({ status: "pending_review", failure: "error" });
  });

  it("never auto-publishes or auto-rejects when the model failed", async () => {
    const model = new FakeModelStep(async () => {
      throw new Error("boom");
    });
    const result = await screen(clean, { model });
    expect(result.status).not.toBe("published");
    expect(result.status).not.toBe("rejected");
  });
});

describe("screen: model verdicts", () => {
  it("uses a valid model rejection and keeps scores for the audit row", async () => {
    const model = new FakeModelStep(async () => ({
      verdict: "reject",
      category: "scam_or_spam",
      confidence: 0.99,
      scores: { scam_or_spam: 0.99 },
    }));
    const result = await screen(clean, { model });
    expect(result).toMatchObject({
      status: "rejected",
      category: "scam_or_spam",
      confidence: 0.99,
      scores: { scam_or_spam: 0.99 },
      modelName: "fake",
    });
  });

  it("sends only the text and photos to the model", async () => {
    const model = fakeApprove();
    await screen({ texts: ["title", "details"], contacts: { phone: "+8801712345678" } }, { model });
    expect(model.calls).toEqual([{ text: "title\n\ndetails", images: [] }]);
  });
});

describe("moderationValues", () => {
  it("maps an outcome to the post columns", async () => {
    const result = await screen({ texts: ["selling yaba"] }, { model: fakeApprove() });
    expect(moderationValues(result)).toEqual({
      status: "rejected",
      moderationCategory: "prohibited_item",
      moderationFlags: '["banned_word"]',
      moderationConfidence: null,
      moderationModel: null,
    });
  });
});
