/**
 * Dry-run reconciler.
 *
 * Phase 1 writes nothing. This module answers one question: given the database
 * says X, what would the filesystem have to look like for X to be true — and
 * how far is the current filesystem from that?
 *
 * That question is the whole deliverable. A permission table with no view of
 * its consequences is just inventory; a diff against the real machine is a
 * contract you can review before anything executes.
 *
 * Reads are real (the pairing store, the profiles directory). Writes are not.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { profileDirFor } from "./agents";

const HERMES_HOME = process.env.HERMES_HOME || path.join(homedir(), ".hermes");
const PROFILES_DIR = path.join(HERMES_HOME, "profiles");
const PAIRING_FILE = path.join(
  HERMES_HOME,
  "platforms",
  "pairing",
  "whatsapp-approved.json",
);

/** One intended filesystem effect. `verb` says what kind of change it is. */
export type ReconcileAction = {
  verb: "create" | "write" | "skip" | "blocked";
  target: string;
  /** Human sentence explaining why this action is proposed. */
  reason: string;
  /** The exact content that would be written, when applicable. */
  payload?: string;
};

export type ReconcilePlan = {
  handle: string;
  profileDir: string;
  actions: ReconcileAction[];
  /** True when every action is a no-op — disk already matches intent. */
  inSync: boolean;
  /** Reasons the plan cannot proceed even if approved. */
  blockers: string[];
};

export type PairingStore = Record<
  string,
  { user_name: string; approved_at: number }
>;

/** Read the pairing store. Missing file is an empty store, not an error. */
export async function readPairingStore(): Promise<PairingStore> {
  try {
    const raw = await readFile(PAIRING_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/** Which profile directories exist on disk right now. */
export async function listExistingProfiles(): Promise<string[]> {
  try {
    const entries = await readdir(PROFILES_DIR, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function dirExists(p: string): Promise<boolean> {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Build the plan for one user.
 *
 * `phone` is passed in rather than stored on AgentProfile on purpose: the
 * schema stays free of transport coupling, and the caller decides which
 * identifier the agent layer should key on.
 */
export async function planForUser(params: {
  handle: string;
  name: string;
  phone: string | null;
  status: "PENDING" | "GRANTED" | "SUSPENDED";
}): Promise<ReconcilePlan> {
  const { handle, name, phone, status } = params;
  const profileDir = profileDirFor(handle);
  const actions: ReconcileAction[] = [];
  const blockers: string[] = [];

  const profiles = await listExistingProfiles();
  const profileExists = profiles.includes(profileDir);
  const pairing = await readPairingStore();
  const inPairing = phone ? Boolean(pairing[phone]) : false;

  if (status === "GRANTED") {
    // A profile must exist before the pairing entry. If the pairing entry
    // lands first, the user's first message routes to the default profile —
    // which has host shell access. Order matters, so it is encoded here.
    if (profileExists) {
      actions.push({
        verb: "skip",
        target: `~/.hermes/profiles/${profileDir}/`,
        reason: "Profile directory already exists",
      });
    } else {
      actions.push({
        verb: "create",
        target: `~/.hermes/profiles/${profileDir}/`,
        reason: "GRANTED requires a profile; creating it first keeps the pairing entry from routing to default",
        payload: [
          `SOUL.md`,
          `USER.md`,
          `state.db`,
          `hindsight/config.json`,
          ``,
          `sandbox:   lab-research-calc:latest (4 GB · 1 vCPU · no network)`,
          `workspace: /mnt/lab-quota/${name}`,
        ].join("\n"),
      });
    }

    if (!phone) {
      blockers.push(
        "No phone number on the account — cannot write a pairing entry without one",
      );
    } else if (inPairing) {
      actions.push({
        verb: "skip",
        target: `~/.hermes/platforms/pairing/whatsapp-approved.json → ${phone}`,
        reason: "Already approved in the pairing store",
      });
    } else {
      actions.push({
        verb: "write",
        target: `~/.hermes/platforms/pairing/whatsapp-approved.json → ${phone}`,
        reason: "GRANTED means the pairing store should carry this number",
        payload: JSON.stringify(
          { [phone]: { user_name: name, approved_at: "<now, at apply>" } },
          null,
          2,
        ),
      });
    }

    actions.push({
      verb: "skip",
      target: "gateway.profile_routes",
      reason:
        "Routes load once at gateway boot — one reload applies them; not written per-user",
    });
  }

  if (status === "SUSPENDED") {
    if (inPairing) {
      actions.push({
        verb: "write",
        target: `~/.hermes/platforms/pairing/whatsapp-approved.json → ${phone}`,
        reason: "SUSPENDED means the pairing entry must be removed",
        payload: `DELETE key ${phone}`,
      });
    } else {
      actions.push({
        verb: "skip",
        target: `~/.hermes/platforms/pairing/whatsapp-approved.json → ${phone ?? "(no phone)"}`,
        reason: "No pairing entry to remove",
      });
    }

    // Archive, never delete. The directory stays; only the route goes.
    actions.push({
      verb: "skip",
      target: `~/.hermes/profiles/${profileDir}/`,
      reason: profileExists
        ? "Kept on disk — suspending archives, it does not delete memory"
        : "Nothing on disk to archive",
    });
  }

  if (status === "PENDING") {
    actions.push({
      verb: "skip",
      target: "—",
      reason: "PENDING means no agent should exist; nothing to do",
    });
  }

  return {
    handle,
    profileDir,
    actions,
    inSync: actions.every((a) => a.verb === "skip"),
    blockers,
  };
}

/** Cheap environment probe so the UI can say whether dry-run is even meaningful. */
export async function probeEnvironment(): Promise<{
  hermesHome: string;
  profilesDirReadable: boolean;
  profileCount: number;
  pairingStoreReadable: boolean;
  pairingEntryCount: number;
  canWrite: false;
}> {
  const profiles = await listExistingProfiles();
  let pairingReadable = false;
  let pairingCount = 0;
  try {
    await stat(PAIRING_FILE);
    pairingReadable = true;
    pairingCount = Object.keys(await readPairingStore()).length;
  } catch {
    pairingReadable = false;
  }

  return {
    hermesHome: HERMES_HOME,
    profilesDirReadable: profiles.length > 0 || (await dirExists(PROFILES_DIR)),
    profileCount: profiles.length,
    pairingStoreReadable: pairingReadable,
    pairingEntryCount: pairingCount,
    // Hard-coded false until Phase 2. The type makes it impossible to forget.
    canWrite: false,
  };
}
