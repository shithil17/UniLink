import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * The trigger look for a picker that opens a sheet instead of a menu (courses, faculty): the same
 * 48px field as an input or select, with an 18px chevron.
 */
export const pickerTrigger =
  "flex min-h-12 w-full items-center justify-between gap-1.5 rounded-control border-[1.5px] border-input bg-surface py-2 pr-[42px] pl-3.5 text-left text-base text-ink outline-none disabled:cursor-not-allowed disabled:border-line disabled:bg-line disabled:text-faint aria-invalid:border-destructive aria-invalid:outline-destructive";

export type Option = { value: string; label: string };

/** A shadcn select over plain `{value, label}` options, sized for touch. */
export function OptionSelect({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
  disabled,
}: {
  id: string;
  value: string | null;
  onChange: (value: string) => void;
  options: readonly Option[];
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      items={options}
      disabled={disabled}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
