import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SIM_URL = process.env.XRD_SIM_URL ?? "http://xrd-sim:8000";
const MAX_CIF_BYTES = 2_000_000;

type Body = { cif?: unknown; twoThetaMin?: unknown; twoThetaMax?: unknown };

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    let body: Body;
    try {
        body = (await req.json()) as Body;
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const cif = body.cif;
    if (typeof cif !== "string" || cif.trim().length < 20) {
        return NextResponse.json({ error: "CIF content is required" }, { status: 400 });
    }
    if (cif.length > MAX_CIF_BYTES) {
        return NextResponse.json({ error: "CIF file is too large" }, { status: 413 });
    }

    // Only pass numbers we actually trust through; the sidecar validates again.
    const toNumber = (v: unknown, fallback: number) =>
        typeof v === "number" && Number.isFinite(v) ? v : fallback;

    try {
        const res = await fetch(`${SIM_URL}/simulate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                cif,
                two_theta_min: toNumber(body.twoThetaMin, 5),
                two_theta_max: toNumber(body.twoThetaMax, 80),
            }),
            signal: AbortSignal.timeout(30_000),
            cache: "no-store",
        });

        const text = await res.text();
        let payload: { detail?: string } | null = null;
        try {
            payload = JSON.parse(text) as { detail?: string };
        } catch {
            payload = null;
        }

        if (!res.ok) {
            const status = res.status === 422 ? 422 : 502;
            return NextResponse.json(
                { error: payload?.detail ?? `Simulator returned ${res.status}` },
                { status },
            );
        }

        return NextResponse.json(payload);
    } catch (err) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        return NextResponse.json(
            {
                error: timedOut
                    ? "The simulator took too long — try a smaller 2θ window or a simpler cell"
                    : "The simulator service is unreachable",
            },
            { status: 503 },
        );
    }
}
