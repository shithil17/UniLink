import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthScreen, FormError } from "@/components/auth/AuthForm";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useChangePassword } from "@/lib/auth";
import { meQuery } from "@/lib/queries";
import {
  changePasswordRequest,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordRequest,
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
  const form = useForm<ChangePasswordRequest>({
    resolver: zodResolver(changePasswordRequest),
    defaultValues: { currentPassword: "", newPassword: "" },
  });
  const { errors } = form.formState;

  return (
    <AuthScreen
      title="Change password"
      intro={
        user?.mustChangePassword
          ? "You're on a temporary password. Pick your own to keep going."
          : "This signs you out of your other devices."
      }
      footer={<LogoutButton />}
    >
      <form onSubmit={form.handleSubmit((values) => change.mutate(values))} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.currentPassword)}>
            <FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
            <Input
              id="currentPassword"
              type="password"
              className="h-11"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.currentPassword)}
              {...form.register("currentPassword")}
            />
            <FieldError errors={[errors.currentPassword]} />
          </Field>
          <Field data-invalid={Boolean(errors.newPassword)}>
            <FieldLabel htmlFor="newPassword">New password</FieldLabel>
            <Input
              id="newPassword"
              type="password"
              className="h-11"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.newPassword)}
              {...form.register("newPassword")}
            />
            <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters.</FieldDescription>
            <FieldError errors={[errors.newPassword]} />
          </Field>
          <FormError message={change.isError ? errorMessage(change.error) : null} />
          <Button type="submit" size="lg" className="w-full" disabled={change.isPending}>
            {change.isPending ? "Saving..." : "Change password"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}
