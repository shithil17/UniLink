import { Button } from "@/components/ui/button";
import { useLogout } from "@/lib/auth";

export function LogoutButton() {
  const logout = useLogout();
  return (
    <Button
      variant="outline"
      size="lg"
      className="w-full sm:w-auto"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
    >
      Log out
    </Button>
  );
}
