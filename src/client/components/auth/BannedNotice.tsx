import type { AccountBannedResponse } from "../../../shared/schemas/auth";

const linkClass = "font-semibold underline underline-offset-[3px] hover:decoration-2";

/**
 * What a suspended user is told: the mod's reason (when there is one) and how to reach the admins.
 * The reason is plain text the server stored; React escapes it. Without a configured address the
 * contact line has no link.
 */
export function BannedDetails({
  ban,
  linkClassName,
}: {
  ban: AccountBannedResponse;
  linkClassName?: string;
}) {
  return (
    <>
      {ban.reason ? <span className="block break-words">Reason: {ban.reason}</span> : null}
      <span className="block">
        {ban.contact ? (
          <>
            Contact the admins at{" "}
            <a href={`mailto:${ban.contact}`} className={`${linkClass} ${linkClassName ?? ""}`}>
              {ban.contact}
            </a>
            .
          </>
        ) : (
          "Contact the admins."
        )}
      </span>
    </>
  );
}
