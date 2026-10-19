import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
      <SelectTrigger id={id} className="h-11 w-full" aria-invalid={invalid}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} className="min-h-11 px-3">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
