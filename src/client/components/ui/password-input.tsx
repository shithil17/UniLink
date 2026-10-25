import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { cn } from "cn";
import { focusRing } from "./focus";
import { Input } from "./input";

/**
 * A password field with a show/hide toggle inside its right edge. The toggle is a 44px target and
 * says what it does through `aria-pressed`, so the label stays "Show password" in both states.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);
  const Icon = visible ? EyeOffIcon : EyeIcon;

  return (
    <div className="relative w-full">
      <Input
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        aria-label="Show password"
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
        className={`absolute top-1/2 right-0.5 flex size-11 -translate-y-1/2 items-center justify-center rounded-full text-soft hover:text-ink ${focusRing}`}
      >
        <Icon aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

export { PasswordInput };
