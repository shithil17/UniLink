import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { app } from "../../app";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { SESSION_COOKIE } from "../../middleware/session";
import { resourceRequestsRepo } from "../../repos/resources";
import { createTestSession, createTestUser } from "../../test/factories";

const db = () => getDb(env.DB);
const DAY = 24 * 60 * 60 * 1000;

const call = async (method: string, path: string, token: string | null) =>
  app.request(
    path,
    { method, headers: token ? { cookie: `${SESSION_COOKIE}=${token}` } : {} },
    env,
  );

let author: { id: number; token: string };
let other: { id: number; token: string };

const person = async () => {
  const u = await createTestUser(db(), { createdAt: Date.now() - 2 * DAY });
  return { id: u.id, token: await createTestSession(db(), u.id) };
};

const addRequest = (status: "published" | "pending_review" | "rejected") =>
  resourceRequestsRepo(db()).insert({
    authorId: author.id,
    courseCode: "CSE115",
    facultyId: null,
    note: null,
    expiresAt: Date.now() + DAY,
    createdAt: Date.now(),
    status,
    moderationCategory: status === "rejected" ? "scam_or_spam" : null,
  });

beforeEach(async () => {
  for (const table of ["resource_requests", "rate_limits", "sessions", "users"]) {
    await env.DB.prepare(`DELETE FROM ${table}`).run();
  }
  author = await person();
  other = await person();
});

describe("POST /api/posts/:type/:id/appeal", () => {
  it("sends the author's own rejected post to the queue", async () => {
    const id = await addRequest("rejected");
    const res = await call("POST", `/api/posts/resource_request/${id}/appeal`, author.token);
    expect(res.status).toBe(200);
    const row = await env.DB.prepare(
      "SELECT status, moderation_appealed_at FROM resource_requests WHERE id = ?",
    )
      .bind(id)
      .first<{ status: string; moderation_appealed_at: number | null }>();
    expect(row?.status).toBe("pending_review");
    expect(row?.moderation_appealed_at).not.toBeNull();
  });

  it("needs a login, and treats someone else's post, an unknown type and a missing post as 404", async () => {
    const id = await addRequest("rejected");
    expect((await call("POST", `/api/posts/resource_request/${id}/appeal`, null)).status).toBe(401);
    expect(
      (await call("POST", `/api/posts/resource_request/${id}/appeal`, other.token)).status,
    ).toBe(404);
    expect((await call("POST", `/api/posts/nope/${id}/appeal`, author.token)).status).toBe(404);
    expect(
      (await call("POST", `/api/posts/resource_request/9999/appeal`, author.token)).status,
    ).toBe(404);
  });

  it("is a 409 for a post that was not rejected", async () => {
    const id = await addRequest("published");
    const res = await call("POST", `/api/posts/resource_request/${id}/appeal`, author.token);
    expect(res.status).toBe(409);
  });

  it("is rate limited", async () => {
    const id = await addRequest("published");
    for (let i = 0; i < limits.appeal.limit; i++) {
      await call("POST", `/api/posts/resource_request/${id}/appeal`, author.token);
    }
    const res = await call("POST", `/api/posts/resource_request/${id}/appeal`, author.token);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).not.toBeNull();
  });
});

describe("a rejected resource request", () => {
  it("shows its author the rejection category and nobody else", async () => {
    const id = await addRequest("rejected");
    const mine = await call("GET", "/api/resources/requests/mine", author.token);
    const items = (
      (await mine.json()) as { items: { id: number; rejectionCategory: string | null }[] }
    ).items;
    expect(items.find((r) => r.id === id)?.rejectionCategory).toBe("scam_or_spam");
    expect((await call("GET", `/api/resources/requests/${id}`, other.token)).status).toBe(404);
  });
});
