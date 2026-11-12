import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { AuthScreen, textLink, UnofficialNote } from "@/components/auth/AuthForm";
import { BannedDetails } from "@/components/auth/BannedNotice";
import { showBannedToast } from "@/components/auth/showBannedToast";
import { SampleWeek } from "@/components/auth/SampleWeek";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api";
import { bannedAccount, useLogin } from "@/lib/auth";
import { greeting } from "@/lib/home";
import { meQuery } from "@/lib/queries";
import { useNow } from "@/lib/useNow";
import {
  loginRequest,
  type AccountBannedResponse,
  type LoginRequest,
} from "../../shared/schemas/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQuery).catch(() => null)) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const login = useLogin();
  const now = useNow();
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequest),
    defaultValues: { username: "", password: "" },
  });
  const { errors } = form.formState;
  // Kept beside the toast so a suspended account is never told by the toast alone.
  const [banned, setBanned] = useState<AccountBannedResponse | null>(null);

  function onLoginError(err: unknown) {
    const ban = bannedAccount(err);
    setBanned(ban);
    if (ban) showBannedToast(ban);
    else toast.error(errorMessage(err));
  }

  return (
    <AuthScreen
      split
      title={greeting(now)}
      intro="Log in to see your classes, course map and CGPA."
      lead={<SampleWeek />}
      footer={
        <>
          <p>
            New here?{" "}
            <Link to="/signup" className={textLink}>
              Create an account
            </Link>
          </p>
          <UnofficialNote />
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) => {
          setBanned(null);
          login.mutate(values, { onError: onLoginError });
        })}
        noValidate
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.username)}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={Boolean(errors.username)}
              {...form.register("username")}
            />
            <FieldError errors={[errors.username]} />
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <PasswordInput
              id="password"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          {banned ? (
            <FieldError>
              <span>
                <span className="block">{banned.message}</span>
                <BannedDetails ban={banned} linkClassName={`rounded-control ${focusRing}`} />
              </span>
            </FieldError>
          ) : null}
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Logging in..." : "Log in"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}
