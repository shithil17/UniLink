import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import { UserSheet } from "@/components/mod/UserSheet";
import { errorMessage } from "@/lib/api";
import { timeAgo } from "@/lib/inbox";
import { modUsersList } from "@/lib/mod";
import { meQuery } from "@/lib/queries";
import { userSearchForm, type ModUser } from "../../shared/schemas/moderation";

export const Route = createFileRoute("/mod/users")({
  validateSearch: (search: Record<string, unknown>): { q?: string } => ({
    q: typeof search.q === "string" && search.q !== "" ? search.q : undefined,
  }),
  component: UsersPage,
});

const panel = "overflow-hidden rounded-panel border border-line bg-surface";
const flat = "rounded-control bg-tint";

type SearchValues = z.input<typeof userSearchForm>;

function UsersPage() {
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: me } = useQuery(meQuery);
  const list = useInfiniteQuery(modUsersList(q));
  const [selected, setSelected] = useState<ModUser | null>(null);

  const form = useForm<SearchValues, unknown, z.output<typeof userSearchForm>>({
    resolver: zodResolver(userSearchForm),
    defaultValues: { q },
  });
  const search = form.handleSubmit((values) =>
    navigate({ search: { q: values.q === "" ? undefined : values.q } }),
  );

  const users = list.data?.pages.flatMap((p) => p.items) ?? [];
  const now = list.dataUpdatedAt;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold text-ink">Users</h1>
      <form onSubmit={search} noValidate className="flex items-start gap-2">
        <Field data-invalid={Boolean(form.formState.errors.q)} className="flex-1">
          <FieldLabel htmlFor="user-search" className="sr-only">
            Username starts with
          </FieldLabel>
          <Input
            id="user-search"
            type="search"
            className="h-11"
            placeholder="Username starts with"
            autoCapitalize="none"
            autoComplete="off"
            aria-invalid={Boolean(form.formState.errors.q)}
            {...form.register("q")}
          />
          <FieldError errors={[form.formState.errors.q]} />
        </Field>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      {list.isPending ? (
        <div className={panel} aria-busy="true" aria-label="Loading users">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="border-b border-line px-4 py-3 last:border-b-0">
              <div className={`${flat} h-4 w-1/3`} />
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">The list didn't load</p>
          <p className="mt-1 text-sm text-soft">{errorMessage(list.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => void list.refetch()}>
            Try again
          </Button>
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-panel border border-line bg-surface p-6 text-center">
          <p className="font-medium text-ink">No one found</p>
          <p className="mt-1 text-sm text-soft">
            {q ? `No username starts with "${q}".` : "No one has signed up yet."}
          </p>
        </div>
      ) : (
        <>
          <ul className={panel}>
            {users.map((u) => (
              <li key={u.id} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => setSelected(u)}
                  className={`flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-tint ${focusRingInset}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{u.username}</span>
                    <span className="block text-xs text-faint">
                      Joined <span className="tabular-nums">{timeAgo(u.createdAt, now)}</span>
                    </span>
                  </span>
                  {u.role !== "student" ? (
                    <Badge>{u.role === "admin" ? "Admin" : "Mod"}</Badge>
                  ) : null}
                  {u.bannedAt !== null ? <Badge>Banned</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              disabled={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              {list.isFetchingNextPage ? "Loading" : "Show more"}
            </Button>
          ) : null}
        </>
      )}

      {me ? <UserSheet user={selected} me={me} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
