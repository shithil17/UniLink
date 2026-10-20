import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "@/lib/toast";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { errorMessage } from "@/lib/api";
import { useChangeRole, useUserAction, type UserAction } from "@/lib/mod";
import { canActOn, type Role } from "../../../shared/modPolicy";
import { reasonBody, type ModUser } from "../../../shared/schemas/moderation";
import { ReasonField } from "./ReasonField";

type Values = z.infer<typeof reasonBody>;

const roleName = { student: "Student", mod: "Mod", admin: "Admin" } as const;

/** What a tap on a user opens: their state, and the actions this signed-in person may take on them. */
export function UserSheet({
  user,
  me,
  onClose,
}: {
  user: ModUser | null;
  me: { username: string; role: Role };
  onClose: () => void;
}) {
  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom">
        {user ? <UserActions key={user.id} user={user} me={me} onClose={onClose} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function UserActions({
  user,
  me: self,
  onClose,
}: {
  user: ModUser;
  me: { username: string; role: Role };
  onClose: () => void;
}) {
  // /auth/me does not expose the user id; usernames are unique, so they tell which row is "me".
  const me = { id: self.username === user.username ? user.id : 0, role: self.role };
  const userAction = useUserAction();
  const changeRole = useChangeRole();
  const form = useForm<Values>({
    resolver: zodResolver(reasonBody),
    defaultValues: { reason: "" },
  });
  const [temporary, setTemporary] = useState<string | null>(null);
  // Read once when the sheet opens: the pause is shown in whole minutes, so no ticking is needed.
  const [openedAt] = useState(() => Date.now());
  const pending = userAction.isPending || changeRole.isPending;
  const allowed = canActOn(me, user);

  const fail = (err: unknown) => toast.error(errorMessage(err));

  const run = (action: UserAction, done: string) =>
    form.handleSubmit(({ reason }) => {
      userAction.mutate(
        { id: user.id, action, reason },
        {
          onSuccess: (result) => {
            if ("temporaryPassword" in result) {
              setTemporary(result.temporaryPassword);
              return;
            }
            toast.success(done);
            onClose();
          },
          onError: fail,
        },
      );
    });

  const setRole = (role: "mod" | "student", done: string) =>
    form.handleSubmit(({ reason }) => {
      changeRole.mutate(
        { id: user.id, role, reason },
        {
          onSuccess: () => {
            toast.success(done);
            onClose();
          },
          onError: fail,
        },
      );
    });

  const flagged = user.probingFlaggedAt !== null;
  const state = [
    roleName[user.role],
    user.bannedAt === null ? null : "Banned",
    flagged ? "Flagged" : null,
  ]
    .filter(Boolean)
    .join(", ");
  const pausedMinutes =
    user.postingBlockedUntil === null
      ? 0
      : Math.max(0, Math.ceil((user.postingBlockedUntil - openedAt) / 60_000));

  return (
    <>
      <SheetHeader>
        <SheetTitle>{user.username}</SheetTitle>
        <SheetDescription>{state}</SheetDescription>
      </SheetHeader>
      <div className="space-y-4 px-4 pb-4">
        {flagged ? (
          <p className="text-sm text-soft">
            Flagged for several rejected posts in a short time.{" "}
            {pausedMinutes > 0 ? (
              <>
                Posting is paused for another <span className="tabular-nums">{pausedMinutes}</span>{" "}
                min.
              </>
            ) : (
              "The pause on posting is over."
            )}
          </p>
        ) : null}
        {temporary ? (
          <TemporaryPassword password={temporary} onDone={onClose} />
        ) : !allowed ? (
          <p className="text-sm text-soft">
            {user.id === me.id
              ? "You can't take moderation actions on your own account."
              : user.role === "admin"
                ? "Admin accounts can't be changed here."
                : "Only an admin can manage mods."}
          </p>
        ) : (
          <form noValidate onSubmit={(e) => e.preventDefault()}>
            <FieldGroup>
              <ReasonField
                id={`reason-${user.id}`}
                register={form.register("reason")}
                error={form.formState.errors.reason}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {user.bannedAt === null ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    disabled={pending}
                    onClick={() => void run("ban", "User banned")()}
                  >
                    Ban
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={pending}
                    onClick={() => void run("unban", "User unbanned")()}
                  >
                    Unban
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={pending}
                  onClick={() => void run("reset-password", "")()}
                >
                  Reset password
                </Button>
                {flagged ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled={pending}
                    onClick={() => void run("clear-probing", "Flag cleared")()}
                  >
                    Clear flag
                  </Button>
                ) : null}
                {me.role === "admin" ? (
                  user.role === "student" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={pending}
                      onClick={() => void setRole("mod", "Made a mod")()}
                    >
                      Make mod
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={pending}
                      onClick={() => void setRole("student", "Removed as mod")()}
                    >
                      Remove as mod
                    </Button>
                  )
                ) : null}
              </div>
            </FieldGroup>
          </form>
        )}
      </div>
    </>
  );
}

/** Shown once after a reset: the mod passes it on, and the student must replace it at next login. */
function TemporaryPassword({ password, onDone }: { password: string; onDone: () => void }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy. Select the password and copy it by hand.");
    }
  };
  return (
    <div className="space-y-3" role="status">
      <p className="text-sm text-soft">
        Temporary password. It is shown once, so pass it on now. They are signed out everywhere and
        must choose a new password when they log in.
      </p>
      <p className="rounded-control border border-line bg-tint px-3 py-3 text-center text-xl font-semibold tracking-wider text-ink tabular-nums select-all">
        {password}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" onClick={onDone}>
          Done
        </Button>
        <Button variant="outline" size="lg" onClick={() => void copy()}>
          Copy
        </Button>
      </div>
    </div>
  );
}
