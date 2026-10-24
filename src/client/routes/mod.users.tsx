import { zodResolver } from "@hookform/resolvers/zod";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronRightIcon, UsersIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorBlock } from "@/components/ui/error-block";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { focusRingInset } from "@/components/ui/focus";
import { Input } from "@/components/ui/input";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { modPanel as panel, modRowLine, modRowMin, modTitle } from "@/components/mod/modStyles";
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

/** The loading row in the final layout: a name, a short joined time and a chevron's room. */
const skeletonRow = (
  <>
    <Skeleton className="h-4 w-2/5" />
    <Skeleton className="ml-auto h-3.5 w-20 shrink-0" />
  </>
);

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
      <h1 className={modTitle}>Users</h1>
      <form onSubmit={search} noValidate className="flex items-start gap-2">
        <Field data-invalid={Boolean(form.formState.errors.q)} className="flex-1">
          <FieldLabel htmlFor="user-search" className="sr-only">
            Username starts with
          </FieldLabel>
          <Input
            id="user-search"
            type="search"
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
        <SkeletonRows rows={5} row={skeletonRow} label="Loading users" />
      ) : list.isError ? (
        <ErrorBlock
          title="The list didn't load"
          message={errorMessage(list.error)}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : users.length === 0 ? (
        <div className={panel}>
          <EmptyState
            icon={UsersIcon}
            title="No one found"
            description={q ? `No username starts with "${q}".` : "No one has signed up yet."}
          />
        </div>
      ) : (
        <>
          <ul className={panel}>
            {users.map((u) => (
              <li key={u.id} className={modRowLine}>
                <button
                  type="button"
                  onClick={() => setSelected(u)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-tint ${modRowMin} ${focusRingInset}`}
                >
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="max-w-full truncate text-[15px] font-medium text-ink">
                      {u.username}
                    </span>
                    {u.role !== "student" ? (
                      <Badge>{u.role === "admin" ? "Admin" : "Mod"}</Badge>
                    ) : null}
                    {u.bannedAt !== null ? <Badge>Banned</Badge> : null}
                    {u.probingFlaggedAt !== null ? <Badge>Flagged</Badge> : null}
                  </span>
                  <span className="shrink-0 text-right text-[13px] text-faint">
                    Joined <span className="tabular-nums">{timeAgo(u.createdAt, now)}</span>
                  </span>
                  <ChevronRightIcon aria-hidden="true" className="size-5 shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
          {list.hasNextPage ? (
            <Button
              variant="outline"
              className="w-full"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            >
              Show more
            </Button>
          ) : null}
        </>
      )}

      {me ? <UserSheet user={selected} me={me} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}
