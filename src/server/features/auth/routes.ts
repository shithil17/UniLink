import { Hono, type Context } from "hono";
import { changePasswordRequest, loginRequest, signupRequest } from "../../../shared/schemas/auth";
import type { Me } from "../../../shared/schemas/auth";
import { parseStudentId } from "../../../shared/studentId";
import { getDb } from "../../db/client";
import { limits } from "../../limits";
import { requireUserAllowingPasswordChange } from "../../middleware/auth";
import { rateLimit, rateLimitBy, rateLimitedResponse } from "../../middleware/rateLimit";
import { clearSessionCookie, setSessionCookie } from "../../middleware/session";
import type { AppEnv } from "../../middleware/types";
import { hashPassword, needsRehash, verifyPassword } from "../../password";
import { sessionsRepo } from "../../repos/sessions";
import { usersRepo, type UserRow } from "../../repos/users";
import { generateSessionToken, hashSessionToken } from "../../sessionToken";
import { validateJson } from "../../validate";

const ID_REGISTERED = {
  error: "student_id_registered",
  message: "This ID is already registered. Contact a mod.",
} as const;
const EMAIL_REGISTERED = {
  error: "email_registered",
  message: "This email is already registered. Contact a mod.",
} as const;
const USERNAME_TAKEN = { error: "username_taken", message: "That username is taken." } as const;
const BAD_CREDENTIALS = {
  error: "invalid_credentials",
  message: "Wrong username or password.",
} as const;

function toMe(user: UserRow): Me {
  return {
    username: user.username,
    role: user.role,
    admissionYear: user.admissionYear,
    mustChangePassword: user.mustChangePassword,
  };
}

/** Creates a session row and sets the cookie. Only the token's hash is stored. */
async function startSession(c: Context<AppEnv>, userId: number) {
  const token = generateSessionToken();
  const now = Date.now();
  await sessionsRepo(getDb(c.env.DB)).create({
    userId,
    tokenHash: await hashSessionToken(token),
    createdAt: now,
    expiresAt: now + limits.sessionTtlMs,
  });
  setSessionCookie(c, token);
}

export const authRoutes = new Hono<AppEnv>()
  .post(
    "/signup",
    // Counted before any other work, so a flood of bad requests is limited too.
    rateLimitBy(
      (c) => `signup:ip:${c.req.header("CF-Connecting-IP") ?? "unknown"}`,
      limits.signupPerIp.limit,
      limits.signupPerIp.windowMs,
    ),
    validateJson(signupRequest),
    async (c) => {
      const body = c.req.valid("json");
      const parsed = parseStudentId(body.studentId);
      if (!parsed) return c.json({ error: "invalid_request", message: "Invalid student ID" }, 400);
      const users = usersRepo(getDb(c.env.DB));

      if (await users.studentKeyExists(parsed.key)) return c.json(ID_REGISTERED, 409);
      if (await users.emailExists(body.email)) return c.json(EMAIL_REGISTERED, 409);
      if (await users.findByUsername(body.username)) return c.json(USERNAME_TAKEN, 409);

      const password = await hashPassword(body.password);
      const created = await users.createUnique({
        username: body.username,
        fullName: body.fullName,
        email: body.email,
        studentKey: parsed.key,
        studentSuffix: parsed.suffix,
        admissionYear: parsed.admissionYear,
        passwordHash: password.hash,
        passwordSalt: password.salt,
        passwordAlgo: password.algo,
        passwordIterations: password.iterations,
        createdAt: Date.now(),
      });
      // Two signups racing past the checks above hit the unique constraints; same answers.
      if (!created.ok) {
        const answers = {
          student_key: ID_REGISTERED,
          email: EMAIL_REGISTERED,
          username: USERNAME_TAKEN,
        };
        return c.json(answers[created.conflict], 409);
      }
      await startSession(c, created.user.id);
      return c.json(toMe(created.user), 201);
    },
  )
  .post("/login", validateJson(loginRequest), async (c) => {
    const body = c.req.valid("json");
    const db = getDb(c.env.DB);
    const attempt = await rateLimit(
      db,
      `login:${body.username}`,
      limits.loginPerUsername.limit,
      limits.loginPerUsername.windowMs,
    );
    if (!attempt.allowed) return rateLimitedResponse(c, attempt);

    const users = usersRepo(db);
    const user = await users.findByUsername(body.username);
    if (!user) {
      // Spend the same time as a real check so response time does not reveal which usernames exist.
      await hashPassword(body.password);
      return c.json(BAD_CREDENTIALS, 401);
    }
    const stored = {
      hash: user.passwordHash,
      salt: user.passwordSalt,
      algo: user.passwordAlgo,
      iterations: user.passwordIterations,
    };
    if (!(await verifyPassword(body.password, stored))) return c.json(BAD_CREDENTIALS, 401);
    if (user.bannedAt !== null) {
      return c.json(
        { error: "account_banned", message: "This account is suspended. Contact a mod." },
        403,
      );
    }
    if (needsRehash(stored)) await users.updatePassword(user.id, await hashPassword(body.password));
    await startSession(c, user.id);
    return c.json(toMe(user));
  })
  .post("/logout", requireUserAllowingPasswordChange, async (c) => {
    const user = c.get("user");
    if (user) await sessionsRepo(getDb(c.env.DB)).deleteById(user.sessionId);
    clearSessionCookie(c);
    return c.json({ ok: true });
  })
  .post(
    "/change-password",
    requireUserAllowingPasswordChange,
    validateJson(changePasswordRequest),
    async (c) => {
      const session = c.get("user");
      if (!session) return c.json({ error: "unauthorized" }, 401);
      const body = c.req.valid("json");
      const db = getDb(c.env.DB);

      // The current password is a guessing target for a stolen session, so it shares the login limit.
      const attempt = await rateLimit(
        db,
        `change-password:user:${session.id}`,
        limits.loginPerUsername.limit,
        limits.loginPerUsername.windowMs,
      );
      if (!attempt.allowed) return rateLimitedResponse(c, attempt);

      const users = usersRepo(db);
      const user = await users.findById(session.id);
      if (!user) return c.json({ error: "unauthorized" }, 401);
      const ok = await verifyPassword(body.currentPassword, {
        hash: user.passwordHash,
        salt: user.passwordSalt,
        algo: user.passwordAlgo,
        iterations: user.passwordIterations,
      });
      if (!ok) {
        return c.json({ error: "wrong_password", message: "Your current password is wrong." }, 400);
      }
      if (body.newPassword === body.currentPassword) {
        return c.json(
          { error: "same_password", message: "Choose a password different from your current one." },
          400,
        );
      }

      await users.updatePassword(user.id, await hashPassword(body.newPassword), {
        clearMustChange: true,
      });
      // Every other device is signed out; this one gets a fresh session.
      await sessionsRepo(db).deleteAllForUser(user.id);
      await startSession(c, user.id);
      return c.json(toMe({ ...user, mustChangePassword: false }));
    },
  )
  .get("/me", requireUserAllowingPasswordChange, (c) => {
    const user = c.get("user");
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json({
      username: user.username,
      role: user.role,
      admissionYear: user.admissionYear,
      mustChangePassword: user.mustChangePassword,
    } satisfies Me);
  });
