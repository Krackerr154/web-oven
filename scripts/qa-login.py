#!/usr/bin/env python3
"""Log in as a QA account and cache the session cookie.

Passwords never reach argv or the terminal: they are read from the 0600 file
written by scripts/qa-users.mjs and posted directly from memory.

    python3 scripts/qa-login.py member|admin

Writes ~/.secrets/ap-lab-qa-<role>.cookie.json and prints a status line only.
"""
import http.cookiejar
import json
import os
import sys
import urllib.parse
import urllib.request

BASE = "https://ap-lab.g-labs.my.id"
HOME = os.path.expanduser("~")
SECRETS = os.path.join(HOME, ".secrets")


def main() -> int:
    role = sys.argv[1] if len(sys.argv) > 1 else "member"
    cred_path = os.path.join(SECRETS, f"ap-lab-qa-{role}.json")
    if not os.path.exists(cred_path):
        print(f"no credentials for {role}; run: node scripts/qa-users.mjs", file=sys.stderr)
        return 2

    with open(cred_path) as fh:
        cred = json.load(fh)

    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    opener.addheaders = [("User-Agent", "AP-Lab-QA/1.0")]

    with opener.open(f"{BASE}/api/auth/csrf", timeout=30) as resp:
        csrf = json.loads(resp.read().decode())["csrfToken"]

    form = urllib.parse.urlencode(
        {
            "csrfToken": csrf,
            "identifier": cred["email"],
            "password": cred["password"],
            "callbackUrl": f"{BASE}/",
            "json": "true",
        }
    ).encode()

    req = urllib.request.Request(
        f"{BASE}/api/auth/callback/credentials",
        data=form,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with opener.open(req, timeout=30) as resp:
            status = resp.status
    except urllib.error.HTTPError as exc:  # type: ignore[attr-defined]
        print(f"login failed: HTTP {exc.code}", file=sys.stderr)
        return 1

    cookies = [{"name": c.name, "value": c.value, "domain": c.domain, "path": c.path,
                "secure": c.secure, "expires": c.expires} for c in jar]
    session = [c for c in cookies if "session-token" in c["name"]]
    if not session:
        print(f"no session cookie issued (HTTP {status}) — check credentials/status", file=sys.stderr)
        return 1

    out = os.path.join(SECRETS, f"ap-lab-qa-{role}.cookie.json")
    with open(out, "w") as fh:
        json.dump(cookies, fh)
    os.chmod(out, 0o600)

    # Prove the session works without printing any secret.
    who = urllib.request.Request(f"{BASE}/api/auth/session")
    with opener.open(who, timeout=30) as resp:
        sess = json.loads(resp.read().decode())
    print(json.dumps({
        "role": role,
        "email": sess.get("user", {}).get("email"),
        "roles": sess.get("user", {}).get("roles"),
        "cookieName": session[0]["name"],
        "expiresInH": round((session[0]["expires"] or 0) / 3600, 1),
        "saved": out,
    }, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
