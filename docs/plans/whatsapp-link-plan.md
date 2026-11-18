# LUMA — WhatsApp account linking

Status: **Phases 1–4 implemented; Phase 5 verification pending**
Branch: `feat/ap-lab-core`
Date: 2026-11-18

> **Phase 0 closed.** The LUMA number `6285139540316` is paired to the LUMA
> instance (QR flow), its bridge runs on port 3001 inside the container, and the
> root gateway's session on 3000 was never restarted (uptime unbroken across the
> pairing). Two Phase 0 findings changed the work below:
>
> 1. The adapter resolves the bridge from an install path that does not exist in
>    LUMA's tree, so `platforms.whatsapp.extra.bridge_script` now points at a
>    copy in `data/whatsapp-bridge/`. Without it WhatsApp would not start at all.
> 2. The 8-character code flow failed twice with the account id accepted but the
>    exchange never completing. QR succeeded first try. Code pairing is therefore
>    **not** the onboarding path — the members' proof of possession is the code
>    Hermes DMs them, which is a different mechanism and works.

## Objective

A lab member connects their WhatsApp to AP-Lab with four taps and no typing, and
from then on talks to LUMA on WhatsApp with their own profile, their own memory
bank, and their own workspace.

Telegram already works this way through a signed Login Widget. WhatsApp has no
equivalent — there is no "Log in with WhatsApp" — so the proof has to be inverted:
the member proves control of the phone by **receiving** something on it, not by
handing the browser a token.

## Current state (verified on Forge, 2026-11-18)

### Two Hermes instances, two transports

This is the fact that most shapes the work. They are not one system.

| | Root gateway | LUMA container |
|---|---|---|
| Unit | `hermes-gateway.service` | `luma-hermes` (Docker) |
| Home | `/home/arya/.hermes` | `/home/arya/services/luma-hermes/data` (mounted to `/home/arya/.hermes` inside) |
| Serves | **WhatsApp** | **Telegram** |
| Creds | `~/.hermes/whatsapp/session/creds.json` present | no WhatsApp creds; `platforms/pairing/telegram-approved.json` present |
| Routes | `~/.hermes/config.yaml` — lippie-dm, gerald-res-dm (`6282247077893`), celsi-dm | `data/config.yaml` — phase0-gerald, tg-nirwan |

**Consequence (current state):** "WhatsApp LUMA" today runs on the **root**
gateway, not on the LUMA container. The pairing store in use is
`~/.hermes/platforms/pairing/whatsapp-pending.json`; the routes live in
`~/.hermes/config.yaml`.

`luma-hermes` has `whatsapp: enabled: true` with no credential, which is the source
of the recurring `whatsapp is enabled but no profile provided a bot credential`
warning on every boot.

### Target architecture

Gerald holds a **dedicated number for LUMA**. It is paired to the **LUMA instance**,
not to the root gateway:

| | Root gateway | LUMA instance (after pairing) |
|---|---|---|
| Serves | personal WhatsApp | **LUMA WhatsApp** (new number) + Telegram |
| Pairing store | `~/.hermes/platforms/pairing/` | `data/platforms/pairing/` |
| Routes | `~/.hermes/config.yaml` | `data/config.yaml` |
| Locale overlay | `~/.hermes/locales/` | `data/locales/` |
| Allowed users | root `.env` | LUMA `.env` |

This is why `pairing -p <profile> whatsapp` matters: a secondary session gets its
own bridge port and its own credential store, so the two numbers never share a
catalogue or a pairing file.

**The locale scoping depends on this.** `t()` resolves from `_current_home()` — the
serving process's home, not a member's profile — and the pairing reply is emitted
before routing. Pairing the new number to the LUMA instance therefore confines the
override to LUMA; adding it to the root gateway instead would put an AP-Lab link in
front of strangers messaging Gerald's personal line.

### Provisioner

- `/home/arya/services/luma-hermes/provisioner/luma_provision.py`
- `luma-provision.timer`, every 30s, currently **active** (oneshot service, so it
  shows `inactive dead` between ticks — that is normal)
- Reads Postgres via `docker exec` + `psql`
- Writes `profile_routes`, per-profile allowlists, restarts the gateway
- `PROVISIONER.md` documents the established contract: **the gateway is stopped
  around a route write**, because a member allowlisted-but-unrouted falls through
  to the profile that owns the transport (Gerald's `res-gerald`) and would read
  his memory.

### Ledger

`AgentProfile` (`ap_agent_profiles`): `userId` unique, `handle` unique, `status`
(`PENDING|GRANTED|SUSPENDED`), `grantedAt/By`, `revokedAt/By/Reason`,
`provisionedAt`, `lastError`.

`User` already carries `telegramUserId/Username/LinkedAt`.

### Memory isolation (verified 2026-11-18)

Banks are isolated **per member**, by configuration, not by convention. Each profile
carries its own binding:

```
~/.hermes/profiles/res-<handle>/hindsight/config.json  →  { "bank_id": "res-<handle>-bank" }
```

Confirmed on disk for all six: `res-gerald`, `res-nirwan`, `res-nia`, `res-bunga`,
`res-indi`, `res-qoni`.

The web side reaches the same answer independently, in `src/lib/hindsight.ts`:

```ts
export function bankIdForHandle(handle: string): string {
  return `res-${handle}-bank`;
}
```

So web and WhatsApp converge on **the same bank per person** and never across
people. `res-gerald-bank` being recalled from both interfaces is correct — that is
one person's continuity across two surfaces, not sharing between members.

Live bank inventory on `:8888` confirms it: `main-memory` (Hephaestus),
`res-gerald-bank` (78 facts), `res-nia-bank` (4), `res-nirwan-bank` (2), alongside
the persona banks (`lippie`, `eris`, `calypso`, `calliope`, `polemarch`, `celsi`).

**Two consequences worth recording:**

1. `res-bunga-bank`, `res-indi-bank`, `res-qoni-bank` are configured but **not yet
   present** on the server — banks are created lazily on first write. Configured
   is not the same as existing, and neither is the same as having content.

2. **The failure mode is routing, not memory.** If an approved number has no
   `profile_routes` entry, the message is served by the **default profile of the
   serving instance** — on the LUMA instance that is `res-gerald`, so the member is
   answered as Gerald and reads `res-gerald-bank`. Bank isolation still holds at
   the storage layer; the profile is chosen *before* memory is loaded, and that
   choice fails open. This is the real risk, and it is why Phase 3 writes route and
   approval together.

### Hermes pairing, as it actually is

- Unknown DM → bot replies with an **8-character code** (32-char unambiguous
  alphabet, `secrets.choice()`, **1h TTL**, 1 request/user/10 min, max 3 pending
  per platform, 5 failed approvals → 1h lockout, files `0600`, codes never logged)
- Approve: `hermes pairing approve <platform> <request-id|code>`
- Reply text is a **locale string**, not hardcoded:
  `gateway.pairing.code_reply` with `{code}`, `{validity}`, `{approve_cmd}`
- Locale resolution merges **bundled → per-home overlay → plugin packs**
  (`agent/i18n.py::_load_catalog`), so `<home>/locales/en.yaml` overrides a single
  key without replacing the catalogue or touching core.

## Design

### The flow

1. `/profile` → **Connect WhatsApp**
   → opens `https://wa.me/<bot_number>?text=link`
2. Member taps **Send** (message is prefilled)
3. Bot replies with one tappable link
   → `https://ap-lab.g-labs.my.id/whatsapp/confirm?c=ABCDEFGH`
4. Member taps it → already signed in → page shows the code and
   **"Link this WhatsApp to your account?"** → **Confirm**

**One deviation from the original design, forced by the architecture.** The
confirm page cannot show the number *before* approval: the pending store keeps
only a salted hash of the code, so the number is unresolvable until the
provisioner runs `hermes pairing approve`, and the web container has no
filesystem access to LUMA's home to read it even then. The page therefore shows
the code (which the member just received) and asks them to confirm; the resolved
number appears immediately afterwards on the same page and on `/profile`.

That is not a weakening. The code already proves possession — it arrived on the
phone. The session proves the account. Pressing Confirm is the act that joins
them, and no number is ever asserted by the browser.

Four taps, zero typing, no tab juggling.

### Why this does not trust user input

**The phone number is never typed into a web form.** The only number the system
ever sees is the one WhatsApp attached to the message — resolved by Hermes, not
asserted by a browser.

- the **code** proves possession of that WhatsApp account
- the **authenticated session** on `/whatsapp/confirm` proves which AP-Lab user
- neither is forgeable by the other

This closes the "claim someone else's number" attack that a typed-number design
would have allowed, without requiring an admin to judge anything.

### What is deliberately not done

- No user-entered phone number anywhere
- No admin approval step for the normal path (the code is the proof)
- No automated outbound WhatsApp messaging (see Risks)

## Phases

Each phase is independently verifiable and reversible. Do not start a phase until
the previous one's gate passes.

### Phase 0 — Preconditions (half day, no code)

Resolve the unknowns that would invalidate the design.

- [ ] Confirm which instance owns WhatsApp **today**, and confirm the new LUMA
      number will be paired to the **LUMA instance** (not root) — the locale
      scoping in Phase 4 depends on it
- [ ] Pair the dedicated number to the LUMA instance (`hermes -p … whatsapp`),
      which also clears the recurring `no profile provided a bot credential`
      warning
- [ ] Confirm `hermes pairing approve whatsapp <code>` works against **LUMA's**
      store — it may need `HERMES_HOME` or `-p` to target that profile rather than
      the default home
- [ ] Confirm a `locales/en.yaml` overlay under LUMA's home actually changes the
      pairing reply the adapter sends (place the override, message from a spare
      number, read the reply)
- [ ] Confirm the `.env` allowlist hot-reload: Hermes caches `.env` by mtime
      (`invalidate_env_file_cache()`), so an allowlist append should take effect
      without a restart — verify, because it changes the write cost
- [ ] Verify the new number does **not** disturb the root gateway's personal
      routes (lippie, celsi, gerald-res-dm) — two sessions, two bridge ports

**Gate:** a manual pairing completed end-to-end with the overridden reply, by hand,
before any AP-Lab code exists — and Gerald's personal WhatsApp reply unchanged.

### Phase 1 — Schema (half day)

- [ ] `ap_whatsapp_links`: `id`, `userId` (unique), `phone` (nullable until
      resolved), `status` (`PENDING|VERIFIED|FAILED|EXPIRED`), `requestId`,
      `createdAt`, `verifiedAt`, `lastError`
- [ ] Migration, applied to `ap_lab_db`
- [ ] Regenerate Prisma client

Decision: store the **resolved** phone, not a claimed one. `phone` stays null
until Hermes tells us what it is.

**Gate:** migration applies cleanly on a fresh boot; existing rows untouched.

### Phase 2 — Web (1 day)

- [ ] `/profile` card: one button, renders the `wa.me` deep link
- [ ] `/whatsapp/confirm` — authenticated, takes `?c=`, resolves the pending
      request, shows the number for confirmation, one button
- [ ] Server action / route to hand the code to the provisioner
- [ ] Honest copy for the rate limits: link expires in 60 minutes; a new one can
      be requested in 10; nothing is approved until Confirm is pressed
- [ ] States: not started, awaiting message, code submitted, verified, expired,
      rate-limited, failed

**Gate:** the page renders correctly signed-in and signed-out; signed-out
redirects to `/login` rather than erroring (this is an existing `/profile`
weakness worth not repeating).

### Phase 3 — Provisioner (1 day)

- [ ] Read pending `ap_whatsapp_links` rows
- [ ] Call `hermes pairing approve whatsapp <code>` against the correct instance
- [ ] Resolve the approved phone from the pairing store
- [ ] Write the `profile_routes` entry — **and the allowlist entry together**
- [ ] Stop the gateway around the write, per `PROVISIONER.md`
- [ ] Back up `config.yaml` before every write; atomic `tmp` + `os.replace`
- [ ] Stamp `verifiedAt` / `lastError` back to Postgres
- [ ] `plan` mode stays read-only and prints the diff

**Gate:** a full link completes with no window in which the number is allowlisted
but unrouted.

### Phase 4 — Locale override (half day)

- [ ] `<home>/locales/en.yaml` with only `gateway.pairing.code_reply` overridden
- [ ] Message contains the confirm URL with `{code}` inside it
- [ ] Keep `{validity}` in the text so the hour is visible

**Gate:** a spare number receives the link, taps it, and lands on the confirm page
with the code populated.

### Phase 5 — Verification and rollout (half day)

- [ ] End-to-end on a real second number
- [ ] Memory isolation: the member's WhatsApp conversation writes to
      `res-<handle>`-bank, not `res-gerald-bank`
- [ ] Fallback check: an unknown number still cannot reach an agent before linking
- [ ] Revocation: suspend in `/admin/users` → route removed, number no longer
      admitted, memory retained
- [ ] Rollback: revert config from the timestamped backup; timer disabled

## Risks and open questions

1. **The dedicated number must land on the LUMA instance, not root.** This is not
   only tidiness: the locale override is scoped to the serving process, so pairing
   it to root would put an AP-Lab link in front of strangers messaging Gerald's
   personal line. It also keeps member routing off the instance that carries
   Lippie and Celsi.

2. **Allowlisted-but-unrouted is the dangerous window, and it is a routing
   failure — not a memory one.** Banks stay isolated at the storage layer; what
   fails is the *profile selection* that happens before memory loads. Proven on
   this host: `6287749293396` was allowlisted with no route and was served under
   `agent:main` — Gerald's own agent, his tools, his `main-memory`. Any write that
   admits a number without a route hands that member to the default profile.

3. **Two WhatsApp sessions mean two bridge ports.** A secondary session takes a
   free port in 3001–3999 unless pinned. Pin it explicitly in
   `platforms.whatsapp.extra.bridge_port` rather than letting allocation drift,
   and confirm the root gateway's session is untouched by the new one.

4. **Rate limits are user-visible.** 10 minutes between requests, 3 pending max,
   5 failures locks out an hour. Copy must state this, not hide it.

5. **WhatsApp bridge is unofficial.** Baileys carries small ban risk; the bot
   number must not automate outbound messages to people who have not messaged
   first. Everything here is reply-only, which is the safe shape.

## Out of scope

- Provisioning member profiles onto disk (separate, already tracked)
- Giving web LUMA a shell or PlotSmith (capability unification was rejected:
  web keeps 6 tools, no skills)
- Group chats — DM-only by standing decision

*(A dedicated LUMA number was previously out of scope; Gerald holds one, so it is
now the target and Phase 0 pairs it.)*

## Success criteria

A member who has never used LUMA: signs in, taps one button, taps send in
WhatsApp, taps the returned link, confirms. Under 60 seconds, no typing, and
their next WhatsApp message is answered by their own agent with their own memory.
