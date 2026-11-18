import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  CODE_REQUEST_COOLDOWN_MINUTES,
  isValidPairingCode,
  lumaWhatsappNumber,
  normalizePairingCode,
  resolveWhatsappLink,
} from "@/lib/whatsapp";

/**
 * WhatsApp linkage for the signed-in member.
 *
 * The code is the only thing the browser sends. That is the whole design: the
 * number is never submitted, so "this number is mine" is never a claim the
 * server has to believe. Hermes binds the code to the phone that received it,
 * and this session proves which AP-Lab account is confirming — two independent
 * proofs that cannot be substituted for one another.
 */

async function loadState(userId: string) {
  const link = await prisma.whatsappLink.findUnique({
    where: { userId },
    select: {
      status: true,
      phone: true,
      requestId: true,
      createdAt: true,
      verifiedAt: true,
      lastError: true,
    },
  });

  return resolveWhatsappLink({
    configured: lumaWhatsappNumber() !== null,
    status: link?.status ?? null,
    phone: link?.phone ?? null,
    requestId: link?.requestId ?? null,
    createdAt: link?.createdAt ?? null,
    verifiedAt: link?.verifiedAt ?? null,
    lastError: link?.lastError ?? null,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const link = await loadState(session.user.id);
  return NextResponse.json(
    { link, cooldownMinutes: CODE_REQUEST_COOLDOWN_MINUTES },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  let body: { code?: unknown };
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return NextResponse.json({ error: "Malformed request body." }, { status: 400 });
  }

  const code = normalizePairingCode(typeof body.code === "string" ? body.code : "");
  if (!isValidPairingCode(code)) {
    return NextResponse.json(
      { error: "That is not a valid pairing code. It has 8 letters and digits.", code: "bad_code" },
      { status: 400 }
    );
  }

  if (!lumaWhatsappNumber()) {
    return NextResponse.json(
      { error: "WhatsApp linking is not configured on this deployment.", code: "not_configured" },
      { status: 503 }
    );
  }

  // A code that another AP-Lab account already confirmed cannot be reused —
  // otherwise two accounts would race for one phone.
  const claimedByOther = await prisma.whatsappLink.findFirst({
    where: { requestId: code, NOT: { userId: session.user.id } },
    select: { id: true },
  });
  if (claimedByOther) {
    return NextResponse.json(
      { error: "That code is already being used by another account.", code: "code_taken" },
      { status: 409 }
    );
  }

  const existing = await prisma.whatsappLink.findUnique({
    where: { userId: session.user.id },
    select: { status: true },
  });
  if (existing?.status === "VERIFIED") {
    return NextResponse.json(
      {
        error: "Your account already has a linked WhatsApp number. Unlink it first.",
        code: "already_linked",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.whatsappLink.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        requestId: code,
        status: "PENDING",
      },
      update: {
        // A retry replaces the previous attempt: new code, cleared failure.
        requestId: code,
        status: "PENDING",
        lastError: null,
        verifiedAt: null,
        createdAt: new Date(),
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
      return NextResponse.json(
        { error: "That code is already being used by another account.", code: "code_taken" },
        { status: 409 }
      );
    }
    console.error("whatsapp link failed", error);
    return NextResponse.json({ error: "Could not save the link." }, { status: 500 });
  }

  const link = await loadState(session.user.id);
  return NextResponse.json({ ok: true, link });
}

/**
 * Unlink.
 *
 * Clears the claim locally; the host provisioner sees the row is no longer
 * VERIFIED and withdraws the route and allowlist entry on its next pass. That
 * ordering matters — clearing the route here would let a revoked number stay
 * admitted until the timer ran.
 */
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const existing = await prisma.whatsappLink.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (existing) {
    await prisma.whatsappLink.update({
      where: { userId: session.user.id },
      data: {
        status: "EXPIRED",
        requestId: null,
        phone: null,
        verifiedAt: null,
        lastError: null,
      },
    });
  }

  const link = await loadState(session.user.id);
  return NextResponse.json({ ok: true, link });
}
