import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SUPERVISORS } from "@/lib/supervisors";

/**
 * Supervisor picker feed for authenticated users.
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
    if (!session?.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    try {
        const rows = await prisma.supervisor.findMany({
            where: { active: true, nip: { not: null } },
            orderBy: { name: "asc" },
            select: {
                id: true,
                name: true,
                nip: true,
                researchGroup: true,
                researchTopic: true,
            },
        });
        if (rows.length > 0) {
            return NextResponse.json({ source: "db", supervisors: rows });
        }
    } catch {
        // fall through to the bundled copy
    }

    const fallback = SUPERVISORS.filter((s) => s.nip).map((s, i) => ({
        id: `seed-${i}`,
        name: s.name,
        nip: s.nip,
        researchGroup: s.researchGroup,
        researchTopic: s.researchTopic,
    }));
    return NextResponse.json({ source: "bundled", supervisors: fallback });
}
