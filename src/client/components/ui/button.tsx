import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircleIcon } from "lucide-react";
import { cn } from "cn";
import { focusRing } from "./focus";
import { press, pressIcon } from "./press";

// Colors change instantly; only the press scale animates (transform), so there is no color transition.
const buttonVariants = cva(
  `group/button relative inline-flex shrink-0 items-center justify-center rounded-control text-[15px] leading-none font-semibold whitespace-nowrap outline-none select-none ${focusRing} disabled:pointer-events-none disabled:bg-line disabled:text-faint disabled:inset-ring-0 disabled:no-underline aria-busy:cursor-progress [&_svg]:pointer-events-none [&_svg]:shrink-0`,
  {
    variants: {
      variant: {
        // Hover mixes 12% ink into the fill and press 18%, so the label keeps its contrast.
        default:
          "bg-primary text-primary-foreground hover:bg-[color-mix(in_srgb,var(--color-primary),var(--color-ink)_12%)] active:bg-[color-mix(in_srgb,var(--color-primary),var(--color-ink)_18%)]",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-brand-soft active:bg-brand-soft",
        // An inset 1.5px edge ring reads as the border without changing the box size.
        outline:
          "bg-transparent text-ink inset-ring-[1.5px] inset-ring-edge hover:bg-brand-soft active:bg-brand-soft aria-expanded:bg-brand-soft",
        ghost:
          "text-brand-ink hover:bg-brand-soft active:bg-brand-soft aria-expanded:bg-brand-soft",
        destructive:
          "bg-destructive text-on-danger hover:bg-[color-mix(in_srgb,var(--color-danger),var(--color-ink)_12%)] active:bg-[color-mix(in_srgb,var(--color-danger),var(--color-ink)_18%)]",
        link: "bg-transparent px-1.5! text-brand-ink underline underline-offset-[3px] hover:decoration-2 disabled:bg-transparent",
      },
      size: {
        default: `${press} min-h-12 gap-2 px-5 [&_svg:not([class*='size-'])]:size-5`,
        sm: `${press} min-h-11 gap-2 px-4 [&_svg:not([class*='size-'])]:size-[18px]`,
        // `lg` predates the 48px default and stays as an alias so existing callers keep working.
        lg: `${press} min-h-12 gap-2 px-5 [&_svg:not([class*='size-'])]:size-5`,
        // Icon buttons are 44px circles; `icon-sm` and `icon-lg` are aliases of the same size.
        icon: `${pressIcon} size-11 rounded-full px-0 [&_svg:not([class*='size-'])]:size-[22px]`,
        "icon-sm": `${pressIcon} size-11 rounded-full px-0 [&_svg:not([class*='size-'])]:size-[22px]`,
        "icon-lg": `${pressIcon} size-11 rounded-full px-0 [&_svg:not([class*='size-'])]:size-[22px]`,
      },
    },
    compoundVariants: [
      // A ghost icon button is quiet ink, not accent text.
      { variant: "ghost", size: ["icon", "icon-sm", "icon-lg"], className: "text-soft" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  loading = false,
  onClick,
  children,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & {
    /** Marks the button busy and shows a spinner. Clicks (and form submits) are ignored meanwhile. */
    loading?: boolean;
  }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      onClick={
        loading
          ? (event) => {
              event.preventDefault();
            }
          : onClick
      }
      {...props}
    >
      {loading ? (
        <LoaderCircleIcon
          aria-hidden
          className="animate-[spin_900ms_linear_infinite] motion-reduce:animate-none"
        />
      ) : null}
      {children}
    </ButtonPrimitive>
  );
}

export { Button, buttonVariants };
