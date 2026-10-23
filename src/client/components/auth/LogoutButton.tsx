import { LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth";

/** Ends the session. One tap, as before: logging out is reversible, so there is no confirm step. */
export function LogoutButton() {
  const logout = useLogout();
  return (
    <Button
      variant="outline"
      className="w-full sm:w-auto"
      loading={logout.isPending}
      onClick={() => logout.mutate()}
    >
      {logout.isPending ? null : <LogOutIcon aria-hidden />}
      Log out
    </Button>
  );
}
