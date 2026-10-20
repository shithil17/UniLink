import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { errorMessage } from "@/lib/api";
import { disablePush, enablePush, type PushState } from "@/lib/push";
import { pushStateQuery } from "@/lib/queries";

const HINT: Record<PushState, string> = {
  on: "You'll get an alert on this device when something new arrives in your inbox.",
  off: "Get an alert on this device when something new arrives in your inbox.",
  denied:
    "Notifications are blocked for UniLink in your browser settings. Allow them there, then come back.",
  "needs-install":
    "On iPhone, add UniLink to your Home Screen first (Share, then Add to Home Screen) and open it from there.",
  unsupported: "This browser can't show notifications from UniLink.",
};

/** The per-device notifications row. Only the on and off states can be changed from here. */
export function PushSwitch() {
  const queryClient = useQueryClient();
  const { data: state } = useQuery(pushStateQuery);
  const refresh = () => queryClient.invalidateQueries({ queryKey: pushStateQuery.queryKey });

  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? enablePush() : disablePush().then(() => "off" as const)),
    onSuccess: (result) => {
      if (result === "unavailable") toast.error("Notifications are not available right now.");
    },
    onError: (err) => toast.error(errorMessage(err)),
    onSettled: refresh,
  });

  if (!state) return null;
  const changeable = state === "on" || state === "off";

  return (
    <div className="flex min-h-14 items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p id="push-switch-label" className="font-medium text-ink">
          Notifications on this device
        </p>
        <p id="push-switch-hint" className="mt-0.5 text-sm text-soft">
          {HINT[state]}
        </p>
      </div>
      <Switch
        aria-labelledby="push-switch-label"
        aria-describedby="push-switch-hint"
        checked={state === "on"}
        disabled={!changeable || toggle.isPending}
        onCheckedChange={(on) => toggle.mutate(on)}
      />
    </div>
  );
}
