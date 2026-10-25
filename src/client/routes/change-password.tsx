import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthScreen } from "@/components/auth/AuthForm";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { toast } from "@/lib/toast";
import { errorMessage } from "@/lib/api";
import { useChangePassword } from "@/lib/auth";
import { meQuery } from "@/lib/queries";
import {
  changePasswordForm,
  changePasswordRequest,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordForm,
} from "../../shared/schemas/auth";

export const Route = createFileRoute("/change-password")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: ChangePasswordPage,
});

function ChangePasswordPage() {
  const { data: user } = useQuery(meQuery);
  const change = useChangePassword();
  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordForm),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  return (
    <AuthScreen
      title="Change password"
      back={user?.mustChangePassword ? undefined : { to: "/settings", label: "Settings" }}
      intro={
        user?.mustChangePassword
          ? "You're on a temporary password. Pick your own to keep going."
          : "This signs you out of your other devices."
      }
      footer={<LogoutButton />}
    >
      <form
        onSubmit={form.handleSubmit((values) =>
          change.mutate(changePasswordRequest.parse(values), {
            onError: (err) => toast.error(errorMessage(err)),
          }),
        )}
        noValidate
      >
        <FieldGroup>
          <Field data-invalid={Boolean(errors.currentPassword)}>
            <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.currentPassword)}
              {...form.register("currentPassword")}
            />
            <FieldError errors={[errors.currentPassword]} />
          </Field>
          <Field data-invalid={Boolean(errors.newPassword)}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.newPassword)}
              {...form.register("newPassword")}
            />
            <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
            <FieldError errors={[errors.newPassword]} />
          </Field>
          <Field data-invalid={Boolean(errors.confirmPassword)}>
            <FieldLabel htmlFor="confirmPassword">Confirm new password</FieldLabel>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...form.register("confirmPassword")}
            />
            <FieldError errors={[errors.confirmPassword]} />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={change.isPending}>
            {change.isPending ? "Saving..." : "Change password"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}
