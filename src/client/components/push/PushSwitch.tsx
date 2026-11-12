import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { apiPost, errorMessage } from "@/lib/api";
import { disablePush, enablePush, type PushState } from "@/lib/push";
import { meQuery, pushStateQuery } from "@/lib/queries";
import { pushOk } from "../../../shared/schemas/push";

// `on` and `off` share one sentence so flipping the switch never rewraps the row.
const ENABLED_HINT = "Get an alert on this device when something new arrives in your inbox.";
const HINT: Record<PushState, string> = {
  on: ENABLED_HINT,
  off: ENABLED_HINT,
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

  if (!state) return <PushSwitchSkeleton />;
  const changeable = state === "on" || state === "off";

  return (
    <>
      <div className="flex min-h-15 items-center gap-3 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p id="push-switch-label" className="text-[15px] leading-[1.3] font-medium text-ink">
            Notifications on this device
          </p>
          <p id="push-switch-hint" className="mt-0.5 text-[13px] leading-[1.4] text-soft">
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
      {state === "on" ? <PushTestRow /> : null}
    </>
  );
}

/** The row's shape while the device's push state is read, so the group does not jump. */
function PushSwitchSkeleton() {
  return (
    <div data-slot="push-switch-skeleton" className="flex min-h-15 items-center gap-3 px-4 py-2.5">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      <Skeleton className="h-8 w-23 shrink-0 rounded-full" />
    </div>
  );
}

/** Admins only: send one test notification to their own devices to check push end to end. */
function PushTestRow() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery(meQuery);
  const send = useMutation({
    mutationFn: () => apiPost("/api/push/test", pushOk),
    onSuccess: () => {
      toast.success("Test sent. It should arrive in a few seconds.");
      void queryClient.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  if (me?.role !== "admin") return null;
  return (
    <div className="flex min-h-15 items-center gap-3 border-t border-line px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] leading-[1.3] font-medium text-ink">Test notification</p>
        <p className="mt-0.5 text-[13px] leading-[1.4] text-soft">
          Sends one to you on every device where notifications are on.
        </p>
      </div>
      <Button variant="outline" size="sm" loading={send.isPending} onClick={() => send.mutate()}>
        Send test
      </Button>
    </div>
  );
}
