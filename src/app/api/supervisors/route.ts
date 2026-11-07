import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPERVISORS } from "@/lib/supervisors";

/**
 * Supervisor directory feed.
 *
 * Two audiences:
 *  - Signed-in users (XRD form): full row including research group/topic.
 *  - Anonymous visitors (registration page): public subset only.
 *
 * Registration has to list supervisors before the user has an account, so an
 * auth wall here would make the picker unusable at exactly the moment it
 * matters. The public payload is deliberately narrowed to name and NIP — both
 * already published on the department website — and nothing else.
 *
 * Signers only: a row without an 18-digit NIP is excluded, because the form
 * stamps the NIP onto a signed institutional PDF. A lecturer with no published
 * NIP can still be shown in the admin directory, but never offered as a signer.
 *
 * Falls back to the bundled directory when the table is empty or unreachable,
 * so the form still works before an admin has seeded it.
 */
export async function GET() {
    const session = await getServerSession(authOptions);
    const authed = Boolean(session?.user);

    try {
        const rows = await prisma.supervisor.findMany({
            where: { active: true, nip: { not: null } },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                nip: true,
                researchGroup: authed,
                researchTopic: authed,
            },
        });
        if (rows.length > 0) {
            return NextResponse.json(
                { source: "db", supervisors: rows },
                { headers: { "Cache-Control": "no-store" } },
            );
        }
    } catch {
        // fall through to the bundled copy
    }

    const fallback = SUPERVISORS.filter((s) => s.nip).map((s, i) => ({
        id: `seed-${i}`,
        name: s.name,
        nip: s.nip,
        researchGroup: authed ? s.researchGroup : null,
        researchTopic: authed ? s.researchTopic : null,
    }));
    return NextResponse.json(
        { source: "bundled", supervisors: fallback },
        { headers: { "Cache-Control": "no-store" } },
    );
}
