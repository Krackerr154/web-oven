import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WhatsappConfirm } from "@/components/whatsapp-confirm";
import {
    isValidPairingCode,
    lumaWhatsappNumber,
    normalizePairingCode,
    resolveWhatsappLink,
} from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * /whatsapp/confirm?c=CODE
 *
 * The landing point for the link LUMA sends over WhatsApp. Requires a session:
 * an unauthenticated visitor is sent to /login and comes back here afterwards,
 * so the code in the URL is never lost to a sign-in detour.
 */
export default async function WhatsappConfirmPage({
    searchParams,
}: {
    searchParams: Promise<{ c?: string }>;
}) {
    const { c } = await searchParams;
    const code = normalizePairingCode(c);

    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        const target = `/whatsapp/confirm${code ? `?c=${encodeURIComponent(code)}` : ""}`;
        redirect(`/login?callbackUrl=${encodeURIComponent(target)}`);
    }

    const link = await prisma.whatsappLink.findUnique({
        where: { userId: session.user.id },
        select: {
            status: true,
            phone: true,
            requestId: true,
            createdAt: true,
            verifiedAt: true,
            lastError: true,
        },
    });

    const state = resolveWhatsappLink({
        configured: lumaWhatsappNumber() !== null,
        status: link?.status ?? null,
        phone: link?.phone ?? null,
        requestId: link?.requestId ?? null,
        createdAt: link?.createdAt ?? null,
        verifiedAt: link?.verifiedAt ?? null,
        lastError: link?.lastError ?? null,
    });

    if (!isValidPairingCode(code)) {
        return (
            <div className="max-w-lg">
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-3">
                    <h1 className="text-lg font-semibold text-white">That link is incomplete</h1>
                    <p className="text-sm text-slate-400">
                        The confirmation code is missing or malformed. Message LUMA on
                        WhatsApp again and tap the link it replies with.
                    </p>
                </div>
            </div>
        );
    }

    return <WhatsappConfirm code={code} initial={state} />;
}
