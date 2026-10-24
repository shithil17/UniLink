import { useRef, useState } from "react";
import { ConfirmSheet } from "@/components/mod/ConfirmSheet";
import { errorMessage } from "./api";
import type { ConfirmRequest } from "./modConfirm";

type Asked = { request: ConfirmRequest; pending: boolean; error: string | null };

/**
 * Drives the confirm sheet. `ask(request)` opens it; render `element` once, inside the action's own
 * sheet so the two nest. While the request runs the confirm button shows progress and ignores taps,
 * and the sheet can't be dismissed. If the request fails the sheet stays open with the error inline,
 * so the mod can try again or cancel.
 */
export function useConfirm() {
  const [asked, setAsked] = useState<Asked | null>(null);
  // A tap handler and a re-render can race; the ref makes a second tap a no-op at once.
  const sending = useRef(false);

  const ask = (request: ConfirmRequest) => setAsked({ request, pending: false, error: null });
  const cancel = () => {
    if (!sending.current) setAsked(null);
  };
  const confirm = async () => {
    if (!asked || sending.current) return;
    sending.current = true;
    setAsked({ ...asked, pending: true, error: null });
    try {
      await asked.request.run();
      setAsked(null);
    } catch (err) {
      setAsked((now) => (now ? { ...now, pending: false, error: errorMessage(err) } : now));
    } finally {
      sending.current = false;
    }
  };

  const element = (
    <ConfirmSheet
      request={asked?.request ?? null}
      pending={asked?.pending ?? false}
      error={asked?.error ?? null}
      onConfirm={() => void confirm()}
      onCancel={cancel}
    />
  );
  return { ask, element };
}
