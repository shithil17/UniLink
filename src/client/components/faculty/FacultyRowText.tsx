import { departmentName } from "../../../shared/departments";
import { facultyTitle } from "../../../shared/facultySearch";

/** Name with initials in brackets (15/500), then designation and department in a 13px muted line. */
export function FacultyRowText({
  faculty,
}: {
  faculty: { name: string; initials: string | null; designation: string; department: string };
}) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[15px] leading-[1.35] font-medium text-ink">
        {facultyTitle(faculty)}
      </span>
      <span className="mt-0.5 block truncate text-[13px] leading-[1.3] font-medium text-faint">
        {faculty.designation} · {departmentName(faculty.department)}
      </span>
    </span>
  );
}
