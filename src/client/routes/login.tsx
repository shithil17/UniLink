import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { AuthScreen, FormError, textLink } from "@/components/auth/AuthForm";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/api";
import { useLogin } from "@/lib/auth";
import { meQuery } from "@/lib/queries";
import { loginRequest, type LoginRequest } from "../../shared/schemas/auth";

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
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginRequest),
    defaultValues: { username: "", password: "" },
  });
  const { errors } = form.formState;

  return (
    <AuthScreen
      title="Log in"
      intro="Welcome back."
      footer={
        <p>
          New here?{" "}
          <Link to="/signup" className={textLink}>
            Create an account
          </Link>
        </p>
      }
    >
      <form onSubmit={form.handleSubmit((values) => login.mutate(values))} noValidate>
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
            <FieldError errors={[errors.username]} />
          </Field>
          <Field data-invalid={Boolean(errors.password)}>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              type="password"
              className="h-11"
              autoComplete="current-password"
              aria-invalid={Boolean(errors.password)}
              {...form.register("password")}
            />
            <FieldError errors={[errors.password]} />
          </Field>
          <FormError message={login.isError ? errorMessage(login.error) : null} />
          <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
            {login.isPending ? "Logging in..." : "Log in"}
          </Button>
        </FieldGroup>
      </form>
    </AuthScreen>
  );
}
