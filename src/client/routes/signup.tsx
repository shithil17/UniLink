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
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api";
import { useSignup } from "@/lib/auth";
import { meQuery } from "@/lib/queries";
import {
  NSU_EMAIL_DOMAIN,
  PASSWORD_MIN_LENGTH,
  signupForm,
  signupRequest,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  type SignupForm,
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
  const form = useForm<SignupForm>({
    resolver: zodResolver(signupForm),
    defaultValues: {
      username: "",
      fullName: "",
      email: "",
      studentId: "",
      password: "",
      confirmPassword: "",
    },
  });
  const { errors } = form.formState;
  const username = useWatch({ control: form.control, name: "username" }).trim();

  return (
    <AuthScreen
      split
      wide
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
          signup.mutate(signupRequest.parse(values), {
            onError: (err) => toast.error(errorMessage(err)),
          }),
        )}
        noValidate
      >
        <FieldGroup className="gap-8">
          <FieldSet>
            <FieldLegend className={legend}>What students see</FieldLegend>
            <div className={pairs}>
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
              {/* Beside the field it previews, lined up with the input rather than the label. */}
              <div className={pairedBeside}>
                <IdentityPreview username={username} />
              </div>
            </div>
          </FieldSet>

          <FieldSet>
            <FieldLegend className={`${legend} flex items-center gap-2`}>
              <LockIcon aria-hidden="true" className="size-4 text-soft" />
              Only for you
            </FieldLegend>
            <FieldDescription className="[[data-variant=legend]+&]:-mt-2">
              Other students never see these. Your ID keeps it to one account per student.
            </FieldDescription>
            <div className={pairs}>
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
              <Field data-invalid={Boolean(errors.email)} className={pairedFull}>
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
              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <PasswordInput
                  id="password"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.password)}
                  {...form.register("password")}
                />
                <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
                <FieldError errors={[errors.password]} />
              </Field>
              <Field data-invalid={Boolean(errors.confirmPassword)}>
                <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  aria-invalid={Boolean(errors.confirmPassword)}
                  {...form.register("confirmPassword")}
                />
                <FieldError errors={[errors.confirmPassword]} />
              </Field>
            </div>
          </FieldSet>

          <Button
            type="submit"
            size="lg"
            className={`w-full ${pairedButton}`}
            disabled={signup.isPending}
          >
            {signup.isPending ? "Creating account..." : "Create account"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}

const legend = "mb-3 text-[18px] leading-[1.3] font-semibold text-ink";

/*
 * Fields pair up in two columns wherever the column is 640px or more: from `md` while the screen is
 * one column, then again from `xl` once `AuthAside` leaves room for it. At `lg` the space right of the
 * panel is about 460px, too narrow for two inputs, so the form stacks there.
 */
const pairs = "grid gap-5 md:grid-cols-2 md:gap-x-4 lg:grid-cols-1 xl:grid-cols-2";
/** A field that spans both columns when they pair. */
const pairedFull = "md:col-span-2 lg:col-span-1 xl:col-span-2";
/** Drops the preview by one label line (13px at 1.3 plus the 8px gap) so it sits level with the input. */
const pairedBeside = "md:pt-[25px] lg:pt-0 xl:pt-[25px]";
/** The submit button keeps its own width when the form pairs up, instead of stretching across both. */
const pairedButton =
  "md:w-auto md:self-start md:px-8 lg:w-full lg:self-stretch xl:w-auto xl:self-start";

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
