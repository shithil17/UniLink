import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useForm, useWatch } from "react-hook-form";
import { LockIcon } from "lucide-react";
import { AuthScreen, textLink, UnofficialNote } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
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
  const username = useWatch({ control: form.control, name: "username" }).trim();

  return (
    <AuthScreen
      split
      title="Join UniLink"
      intro="Takes a minute. Have your NSU email and student ID ready."
      footer={
        <>
          <p>
            Already have an account?{" "}
            <Link to="/login" className={textLink}>
              Log in
            </Link>
          </p>
          <UnofficialNote />
        </>
      }
    >
      <form
        onSubmit={form.handleSubmit((values) =>
          signup.mutate(values, { onError: (err) => toast.error(errorMessage(err)) }),
        )}
        noValidate
      >
        <FieldGroup className="gap-8">
          <FieldSet>
            <FieldLegend className={legend}>What students see</FieldLegend>
            <Field data-invalid={Boolean(errors.username)}>
              <FieldLabel htmlFor="username">Username</FieldLabel>
              <Input
                id="username"
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
            <IdentityPreview username={username} />
          </FieldSet>

          <FieldSet>
            <FieldLegend className={`${legend} flex items-center gap-2`}>
              <LockIcon aria-hidden="true" className="size-4 text-soft" />
              Only for you
            </FieldLegend>
            <FieldDescription className="[[data-variant=legend]+&]:-mt-2">
              Other students never see these. Your ID keeps it to one account per student.
            </FieldDescription>
            <Field data-invalid={Boolean(errors.fullName)}>
              <FieldLabel htmlFor="fullName">Full name</FieldLabel>
              <Input
                id="fullName"
                autoComplete="name"
                aria-invalid={Boolean(errors.fullName)}
                {...form.register("fullName")}
              />
              <FieldError errors={[errors.fullName]} />
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="email">NSU email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                placeholder={`name@${NSU_EMAIL_DOMAIN}`}
                aria-invalid={Boolean(errors.email)}
                {...form.register("email")}
              />
              <FieldError errors={[errors.email]} />
            </Field>
            <Field data-invalid={Boolean(errors.studentId)}>
              <FieldLabel htmlFor="studentId">NSU student ID</FieldLabel>
              <Input
                id="studentId"
                inputMode="numeric"
                autoComplete="off"
                placeholder="221 1234 042"
                aria-invalid={Boolean(errors.studentId)}
                {...form.register("studentId")}
              />
              <FieldError errors={[errors.studentId]} />
            </Field>
            <Field data-invalid={Boolean(errors.password)}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={Boolean(errors.password)}
                {...form.register("password")}
              />
              <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
              <FieldError errors={[errors.password]} />
            </Field>
          </FieldSet>

          <Button type="submit" size="lg" className="w-full" disabled={signup.isPending}>
            {signup.isPending ? "Creating account..." : "Create account"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}

const legend = "mb-3 text-[18px] leading-[1.3] font-semibold text-ink";

/**
 * How the student will appear on posts, updated as they type: the username and nothing else. It
 * makes the privacy split visible instead of repeating "private" under every field.
 */
function IdentityPreview({ username }: { username: string }) {
  return (
    <div className="flex min-h-[60px] items-center gap-3 rounded-row bg-surface px-4 py-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[15px] font-bold text-brand-ink uppercase"
      >
        {username ? username[0] : "?"}
      </span>
      <div className="min-w-0">
        <p
          className={`truncate text-[15px] leading-[1.3] font-semibold ${username ? "text-ink" : "text-faint"}`}
        >
          {username || "your_username"}
        </p>
        <p className="text-[13px] leading-[1.3] text-soft">This is all other students see.</p>
      </div>
    </div>
  );
}
