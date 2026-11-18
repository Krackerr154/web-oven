/**
 * Provisioning state for a member's Telegram link.
 *
 * Pure and dependency-free so both the API route and the client card can use
 * it. The authoritative facts live in Postgres:
 *
 *   ap_users.telegram_linked_at   when the member linked Telegram
 *   ap_agent_profiles.status      GRANTED | SUSPENDED | PENDING
 *   ap_agent_profiles.provisioned_at  last successful host-side write
 *   ap_agent_profiles.last_error      last failed host-side write
 *
 * The host provisioner runs on a 30 s timer, so "linked but not yet
 * provisioned" is a normal transient state, not an error.
 */

export type AgentStatus = "PENDING" | "GRANTED" | "SUSPENDED";

export type ProvisioningState =
  | "not_linked"
  | "pending_access"
  | "suspended"
  | "provisioning"
  | "ready"
  | "failed";

export type ProvisioningInfo = {
  state: ProvisioningState;
  label: string;
  detail: string;
  provisionedAt: string | null;
  lastError: string | null;
};

export function resolveProvisioning(input: {
  linkedAt: Date | null;
  agentStatus: AgentStatus | null;
  provisionedAt: Date | null;
  lastError: string | null;
}): ProvisioningInfo {
  const { linkedAt, agentStatus, provisionedAt, lastError } = input;

  const base = {
    provisionedAt: provisionedAt ? provisionedAt.toISOString() : null,
    lastError: lastError ?? null,
  };

  if (!linkedAt) {
    return {
      ...base,
      state: "not_linked",
      label: "Not linked",
      detail: "Link your Telegram account to talk to LUMA.",
    };
  }

  if (agentStatus === "SUSPENDED") {
    return {
      ...base,
      state: "suspended",
      label: "Access suspended",
      detail: "Your LUMA access is suspended. Ask the lab administrator.",
    };
  }

  if (agentStatus !== "GRANTED") {
    return {
      ...base,
      state: "pending_access",
      label: "Awaiting access",
      detail:
        "Telegram is linked. LUMA access has not been granted yet — an administrator must approve it.",
    };
  }

  // provisioned_at is only meaningful if it happened after the current link.
  // A re-link (or a fresh link) leaves older timestamps stale.
  const fresh = provisionedAt !== null && provisionedAt >= linkedAt;

  if (fresh && !lastError) {
    return {
      ...base,
      state: "ready",
      label: "Ready",
      detail: "LUMA is ready. Message the bot and it will know who you are.",
    };
  }

  if (lastError) {
    return {
      ...base,
      state: "failed",
      label: "Provisioning failed",
      detail: lastError,
    };
  }

  return {
    ...base,
    state: "provisioning",
    label: "Provisioning…",
    detail: "Setting up your LUMA route. This usually takes under a minute.",
  };
}
