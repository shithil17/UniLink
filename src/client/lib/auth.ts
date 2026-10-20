import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import {
  me,
  type ChangePasswordRequest,
  type LoginRequest,
  type SignupRequest,
} from "../../shared/schemas/auth";
import { ApiError, apiPost } from "./api";
import { disablePushBeforeLogout } from "./push";
import { meQuery } from "./queries";

/** Where a signed-in user lands: the forced password change first, otherwise Home. */
function useAfterSignIn() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (user: z.infer<typeof me>) => {
    queryClient.setQueryData(meQuery.queryKey, user);
    await navigate({ to: user.mustChangePassword ? "/change-password" : "/" });
  };
}

export function useSignup() {
  const afterSignIn = useAfterSignIn();
  return useMutation({
    mutationFn: (body: SignupRequest) => apiPost("/api/auth/signup", me, body),
    onSuccess: afterSignIn,
  });
}

export function useLogin() {
  const afterSignIn = useAfterSignIn();
  return useMutation({
    mutationFn: (body: LoginRequest) => apiPost("/api/auth/login", me, body),
    onSuccess: afterSignIn,
  });
}

export function useChangePassword() {
  const afterSignIn = useAfterSignIn();
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => apiPost("/api/auth/change-password", me, body),
    onSuccess: afterSignIn,
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const finish = async () => {
    // Drop everything cached for the old user before the next one signs in.
    queryClient.clear();
    queryClient.setQueryData(meQuery.queryKey, null);
    await navigate({ to: "/login" });
  };
  return useMutation({
    mutationFn: async () => {
      // Needs the session, so it runs first. Best effort: it never blocks logging out.
      await disablePushBeforeLogout();
      return apiPost("/api/auth/logout", z.object({ ok: z.boolean() }));
    },
    onSuccess: finish,
    // A 401 means the session was already gone, which is what logging out wanted anyway.
    onError: async (err) => {
      if (err instanceof ApiError && err.status === 401) await finish();
    },
  });
}
