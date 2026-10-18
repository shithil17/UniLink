import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthScreen, FormError } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useSignup } from "@/lib/auth";
import { meQuery } from "@/lib/queries";
import {
  NSU_EMAIL_DOMAIN,
  PASSWORD_MIN_LENGTH,
  signupRequest,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type SignupRequest,
} from "../../shared/schemas/auth";

export const Route = createFileRoute("/signup")({
  beforeLoad: async ({ context }) => {
    if (await context.queryClient.ensureQueryData(meQuery).catch(() => null)) {
      throw redirect({ to: "/" });
    }
  },
  component: SignupPage,
});

function SignupPage() {
  const signup = useSignup();
  const form = useForm<SignupRequest>({
    resolver: zodResolver(signupRequest),
    defaultValues: { username: "", fullName: "", email: "", studentId: "", password: "" },
  });
  const { errors } = form.formState;

  return (
    <AuthScreen
      title="Sign up"
      intro="Use your NSU details. Only your username is ever shown to others."
    >
      <form onSubmit={form.handleSubmit((values) => signup.mutate(values))} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.username)}>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              className="h-11"
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={Boolean(errors.username)}
              {...form.register("username")}
            />
            <FieldDescription>
              {USERNAME_MIN_LENGTH} to {USERNAME_MAX_LENGTH} letters, numbers or underscores.
            </FieldDescription>
            <FieldError errors={[errors.username]} />
          </Field>
          <Field data-invalid={Boolean(errors.fullName)}>
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              className="h-11"
              autoComplete="name"
              aria-invalid={Boolean(errors.fullName)}
              {...form.register("fullName")}
            />
            <FieldDescription>Private. Never shown to other students.</FieldDescription>
            <FieldError errors={[errors.fullName]} />
          </Field>
          <Field data-invalid={Boolean(errors.email)}>
            <FieldLabel htmlFor="email">NSU email</FieldLabel>
            <Input
              id="email"
              type="email"
              className="h-11"
              autoComplete="email"
              autoCapitalize="none"
              placeholder={`name@${NSU_EMAIL_DOMAIN}`}
              aria-invalid={Boolean(errors.email)}
              {...form.register("email")}
            />
            <FieldDescription>Private. Never shown to other students.</FieldDescription>
            <FieldError errors={[errors.email]} />
          </Field>
          <Field data-invalid={Boolean(errors.studentId)}>
            <FieldLabel htmlFor="studentId">NSU student ID</FieldLabel>
            <Input
              id="studentId"
              className="h-11"
              inputMode="numeric"
              autoComplete="off"
              placeholder="221 1234 042"
              aria-invalid={Boolean(errors.studentId)}
              {...form.register("studentId")}
            />
            <FieldDescription>
              Private. Used once per student, never shown to others.
            </FieldDescription>
            <FieldError errors={[errors.studentId]} />
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              className="h-11"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register("password")}
            />
            <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
            <FieldError errors={[errors.password]} />
          </Field>
          <FormError message={signup.isError ? errorMessage(signup.error) : null} />
          <Button type="submit" className="h-11 w-full" disabled={signup.isPending}>
            {signup.isPending ? "Creating account..." : "Sign up"}
          </Button>
        </FieldGroup>
      </form>
      <p className="text-sm text-soft">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-ink underline">
          Log in
        </Link>
      </p>
    </AuthScreen>
  );
}
