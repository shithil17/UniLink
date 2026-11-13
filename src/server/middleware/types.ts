import type { Geocoder } from "../adapters/geocoder";

export type Role = "student" | "mod" | "admin";

/** The signed-in user as route handlers see them. Never carries the student ID. */
export type SessionUser = {
  id: number;
  username: string;
  role: Role;
  admissionYear: number;
  mustChangePassword: boolean;
  createdAt: number;
  sessionId: number;
};

export type AppEnv = {
  Bindings: Env;
  Variables: {
    user: SessionUser | null;
    /** Set only by tests to swap in a fake; routes fall back to the real geocoder. */
    geocoder?: Geocoder;
  };
};
