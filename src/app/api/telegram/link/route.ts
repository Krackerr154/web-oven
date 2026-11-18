import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveProvisioning } from "@/lib/telegram-provisioning";
import {
    telegramErrorText,
    verifyTelegramAuth,
    type TelegramAuthPayload,
} from "@/lib/telegram";

/**
 * POST /api/telegram/link
 *
 * Receives the payload the Login Widget produced in the browser and binds
 * that Telegram account to the signed-in AP-Lab user.
 *
 * Deliberately NOT a GET: the redirect variant of the widget puts the signed
 * payload in a shareable URL, so an attacker could hand a logged-in victim a
 * link carrying the *attacker's* valid payload and bind their Telegram to the
 * victim's account. A same-site POST from an authenticated session has no
 * such hand-off.
 *
 * The session comes from the cookie, never from the payload — that is what
 * makes "this Telegram belongs to this AP-Lab account" a fact rather than a
 * claim.
 */
export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    let payload: TelegramAuthPayload;
    try {
        payload = (await request.json()) as TelegramAuthPayload;
    } catch {
        return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }
    if (!payload || typeof payload !== "object") {
        return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
    }

    const verified = verifyTelegramAuth(payload);
    if (!verified.ok) {
        // TEMP DIAGNOSTIC — remove after the login payload is understood.
        try {
            const { buildDataCheckString } = await import("@/lib/telegram");
            const secret = Buffer.from(process.env.TELEGRAM_LOGIN_SECRET || "", "hex");
            const check = buildDataCheckString(payload);
            const crypto = await import("crypto");
            const computed = crypto.createHmac("sha256", secret).update(check).digest("hex");
            console.error("[TGLINK] verify failed", JSON.stringify({
                error: verified.error,
                fields: Object.fromEntries(
                    Object.entries(payload).map(([k, v]) => [k, k === "hash" ? String(v).slice(0, 10) : v])
                ),
                checkString: check,
                computedHash: computed,
                receivedHash: String(payload.hash).slice(0, 10),
                secretLen: secret.length,
            }));
        } catch (logError) {
            console.error("[TGLINK] diagnostic failed", logError);
        }
        return NextResponse.json(
            { error: telegramErrorText(verified.error), code: verified.error },
            { status: verified.error === "telegram_login_not_configured" ? 503 : 400 }
        );
    }

    const { userId, username } = verified;

    // One Telegram account, one AP-Lab account. Checked explicitly so the
    // caller gets a clear 409 instead of a raw unique-constraint error.
    const claimed = await prisma.user.findFirst({
        where: { telegramUserId: userId, NOT: { id: session.user.id } },
        select: { id: true },
    });
    if (claimed) {
        return NextResponse.json(
            {
                error: "That Telegram account is already linked to another AP-Lab account.",
                code: "already_linked",
            },
            { status: 409 }
        );
    }

    try {
        const updated = await prisma.user.update({
            where: { id: session.user.id },
            data: {
                telegramUserId: userId,
                telegramUsername: username,
                telegramLinkedAt: new Date(),
            },
            select: {
                telegramUserId: true,
                telegramUsername: true,
                telegramLinkedAt: true,
            },
        });

        return NextResponse.json({
            ok: true,
            // BigInt is not JSON-serialisable; the id goes out as a string.
            telegramUserId: updated.telegramUserId?.toString() ?? null,
            telegramUsername: updated.telegramUsername,
            telegramLinkedAt: updated.telegramLinkedAt?.toISOString() ?? null,
        });
    } catch (error) {
        // Losing the race against a concurrent link lands here as P2002.
        if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
            return NextResponse.json(
                {
                    error: "That Telegram account is already linked to another AP-Lab account.",
                    code: "already_linked",
                },
                { status: 409 }
            );
        }
        console.error("telegram link failed", error);
        return NextResponse.json({ error: "Could not save the link." }, { status: 500 });
    }
}

/**
 * DELETE /api/telegram/link
 *
 * Unlink. Revokes the stored id only; it does not remove any agent grant,
 * because routing and identity are separate decisions.
 */
export async function DELETE() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    await prisma.user.update({
        where: { id: session.user.id },
        data: {
            telegramUserId: null,
            telegramUsername: null,
            telegramLinkedAt: null,
        },
    });

    return NextResponse.json({ ok: true });
}

/** Current link state for the signed-in user (used on mount). */
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
            telegramUserId: true,
            telegramUsername: true,
            telegramLinkedAt: true,
            agentProfile: {
                select: {
                    status: true,
                    provisionedAt: true,
                    lastError: true,
                },
            },
        },
    });

    // The host provisioner writes routes on a 30 s timer; its outcome lives in
    // ap_agent_profiles. Surfacing it here is what turns "I clicked the button
    // and nothing happened" into a visible state.
    const provisioning = resolveProvisioning({
        linkedAt: user?.telegramLinkedAt ?? null,
        agentStatus: user?.agentProfile?.status ?? null,
        provisionedAt: user?.agentProfile?.provisionedAt ?? null,
        lastError: user?.agentProfile?.lastError ?? null,
    });

    return NextResponse.json(
        {
            telegramUserId: user?.telegramUserId?.toString() ?? null,
            telegramUsername: user?.telegramUsername ?? null,
            telegramLinkedAt: user?.telegramLinkedAt?.toISOString() ?? null,
            provisioning,
        },
        { headers: { "Cache-Control": "no-store" } }
    );
}
