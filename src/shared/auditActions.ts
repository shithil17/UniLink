// The audit actions the moderation tools write, shared so the server and the audit screen agree.
// Other phases write their own action strings; the screen prints those as is.

export const auditActions = {
  ban: "ban",
  unban: "unban",
  roleChange: "role_change",
  releaseKey: "release_key",
  softDelete: "soft_delete",
  resetPassword: "reset_password",
  resolveReport: "resolve_report",
  idLookup: "id_lookup",
  reverse: "reverse",
  clearProbingFlag: "clear_probing_flag",
  modApprovePost: "mod_approve_post",
  modRejectPost: "mod_reject_post",
  automodApprove: "automod_approve",
  automodHold: "automod_hold",
  automodReject: "automod_reject",
} as const;

export type AuditAction = (typeof auditActions)[keyof typeof auditActions];

/**
 * The actions an admin can reverse from the stored snapshot. A reversal is not one of them (do the
 * original action again instead), and neither are a password reset (the old hash is never stored),
 * a report resolution or an ID lookup (nothing to restore). A mod's decision on a held post is not
 * either: the author has already been told, so the author edits and resubmits instead.
 */
export const reversibleActions: readonly string[] = [
  auditActions.ban,
  auditActions.unban,
  auditActions.roleChange,
  auditActions.releaseKey,
  auditActions.softDelete,
  auditActions.clearProbingFlag,
];

const LABELS: Record<AuditAction, string> = {
  ban: "Banned a user",
  unban: "Unbanned a user",
  role_change: "Changed a role",
  release_key: "Released a student ID",
  soft_delete: "Removed a post",
  reset_password: "Reset a password",
  resolve_report: "Closed a report",
  id_lookup: "Looked up a student ID",
  reverse: "Reversed an action",
  clear_probing_flag: "Cleared a probing flag",
  mod_approve_post: "Approved a held post",
  mod_reject_post: "Rejected a held post",
  automod_approve: "Published a post",
  automod_hold: "Held a post for review",
  automod_reject: "Rejected a post",
};

/** Plain words for an audit action; an action from another phase falls back to its raw name. */
export function auditActionLabel(action: string): string {
  return (LABELS as Record<string, string | undefined>)[action] ?? action;
}
