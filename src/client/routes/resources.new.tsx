import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { RequestForm } from "@/components/resources/RequestForm";
import { courseMapQuery, meQuery } from "@/lib/queries";
import { routineCourseChoices } from "@/lib/routine";

export const Route = createFileRoute("/resources/new")({
  beforeLoad: async ({ context }) => {
    if (!(await context.queryClient.ensureQueryData(meQuery).catch(() => null))) {
      throw redirect({ to: "/login" });
    }
  },
  component: NewRequest,
});

function NewRequest() {
  const navigate = Route.useNavigate();
  const map = useQuery(courseMapQuery);
  // ceiling: the course list is the courses on the student's own map. Someone asking about a course
  // outside their curriculum picks a faculty member instead. Revisit if students ask for any course.
  const choices = map.data ? routineCourseChoices(map.data) : [];

  return (
    <div className="max-w-2xl space-y-5">
      <header>
        <h1 className="text-[28px] leading-[1.15] font-bold tracking-[-0.01em] text-ink md:text-[32px]">
          New request
        </h1>
        <p className="mt-1 text-soft">Ask other students for materials.</p>
      </header>
      <div className="rounded-panel bg-surface p-4 md:rounded-[24px] md:p-5">
        <RequestForm
          choices={choices}
          onSent={() => void navigate({ to: "/resources" })}
          onCancel={() => void navigate({ to: "/resources" })}
        />
      </div>
    </div>
  );
}
