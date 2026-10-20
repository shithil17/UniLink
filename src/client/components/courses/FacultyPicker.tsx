import { useQuery } from "@tanstack/react-query";
import { facultyOptions, NO_FACULTY } from "@/lib/attempts";
import { facultyQuery } from "@/lib/queries";
import { OptionSelect } from "./OptionSelect";

/**
 * The faculty member who taught the course, or none. Optional everywhere it is used, so a list that
 * fails to load never blocks saving: the control is disabled and says so.
 */
export function FacultyPicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const { data, isError } = useQuery(facultyQuery);
  return (
    <>
      <OptionSelect
        id={id}
        value={value === null ? NO_FACULTY : String(value)}
        onChange={(v) => onChange(v === NO_FACULTY ? null : Number(v))}
        options={facultyOptions(data ?? [])}
        disabled={!data}
      />
      {isError ? (
        <p role="alert" className="text-sm text-soft">
          The faculty list did not load. You can save without it.
        </p>
      ) : null}
    </>
  );
}
