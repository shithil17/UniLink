import { departmentName } from "../../../shared/departments";
import { facultyTitle } from "../../../shared/facultySearch";

/** Name with initials in brackets, then designation and department in a muted line. */
export function FacultyRowText({
  faculty,
}: {
  faculty: { name: string; initials: string | null; designation: string; department: string };
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium text-ink">{facultyTitle(faculty)}</span>
      <span className="block truncate text-xs text-faint">
        {faculty.designation} · {departmentName(faculty.department)}
      </span>
    </span>
  );
}
