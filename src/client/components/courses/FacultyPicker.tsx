import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { facultyOptions, NO_FACULTY } from "@/lib/attempts";
import { facultyQuery } from "@/lib/queries";
import { toast } from "@/lib/toast";
import { OptionSelect } from "./OptionSelect";

/**
 * The faculty member who taught the course, or none. Optional everywhere it is used, so a list that
 * fails to load never blocks saving: the control is disabled and a toast says why.
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
  useEffect(() => {
    if (isError) {
      toast.error("The faculty list did not load. You can save without it.", {
        id: "faculty-load",
      });
    }
  }, [isError]);
  return (
    <OptionSelect
      id={id}
      value={value === null ? NO_FACULTY : String(value)}
      onChange={(v) => onChange(v === NO_FACULTY ? null : Number(v))}
      options={facultyOptions(data ?? [])}
      disabled={!data}
    />
  );
}
