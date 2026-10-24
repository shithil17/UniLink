import { Toaster as Sonner, type ToasterProps } from "sonner";
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react";

/**
 * The toast is a pill: `ink` ground with `app` text, 48px tall, float shadow, centered. Its look and
 * enter/exit motion live in `index.css` under `.cn-toast`, because sonner's own stylesheet is
 * injected at runtime with plain selectors that class utilities cannot out-rank.
 *
 * ceiling: sonner's own stacking, expand-on-hover and swipe-to-dismiss stay as they are; only the
 * skin and the enter/exit change. Replacing them would need our own toast queue, which a few
 * short action results do not justify.
 */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Themes change colors only, and the toast reads our tokens through `.cn-toast`.
      theme="light"
      className="toaster group"
      position="bottom-center"
      // `--toast-bottom` is 92px (plus the home-indicator inset) above the phone tab bar, and
      // a plain 24px once the tab bar becomes a rail at md. Defined in index.css.
      offset={{ bottom: "var(--toast-bottom)" }}
      mobileOffset={{ bottom: "var(--toast-bottom)", left: 16, right: 16 }}
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
