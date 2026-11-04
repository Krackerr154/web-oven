"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { SUPERVISORS } from "@/lib/supervisors";

type ActionResult = { success: boolean; message: string };

/**
 * A NIP is only accepted in the exact ITB shape: 18 digits. The published
 * directory has two 17-digit NIPs and 21 lecturers with none, so the check is
 * strict here and the UI asks for a correction rather than storing a number
 * that would print on a signed document and look authoritative.
 */
const nipSchema = z
    .string()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 18, {
        message: "NIP must be exactly 18 digits",
    });

const upsertSchema = z.object({
    id: z.string().uuid().optional(),
    name: z.string().min(2, "Name must be at least 2 characters").max(160),
    nip: z.union([nipSchema, z.literal(""), z.null()]).optional(),
    email: z.union([z.string().email("Invalid email"), z.literal(""), z.null()]).optional(),
    researchGroup: z.string().max(120).optional().nullable(),
    researchTopic: z.string().max(240).optional().nullable(),
    active: z.boolean().optional(),
});

async function requireAdmin() {
    const session = await getServerSession(authOptions);
    const roles = ((session?.user as { roles?: string[] } | undefined)?.roles) ?? [];
    if (!session?.user || !roles.includes("ADMIN")) {
        throw new Error("Only an administrator can manage supervisors");
    }
    return session;
}

export async function listSupervisors(options?: { signersOnly?: boolean }) {
    await requireAdmin();
    const rows = await prisma.supervisor.findMany({
        orderBy: { name: "asc" },
    });
    return options?.signersOnly ? rows.filter((r) => r.nip) : rows;
}

export async function upsertSupervisor(formData: FormData): Promise<ActionResult> {
    try {
        await requireAdmin();
    } catch {
        return { success: false, message: "Only an administrator can manage supervisors" };
    }

    const parsed = upsertSchema.safeParse({
        id: formData.get("id") || undefined,
        name: formData.get("name"),
        nip: formData.get("nip"),
        email: formData.get("email"),
        researchGroup: formData.get("researchGroup"),
        researchTopic: formData.get("researchTopic"),
        active: formData.get("active") === "on" || formData.get("active") === "true",
    });

    if (!parsed.success) {
        return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    const d = parsed.data;
    const nip = d.nip && String(d.nip).length === 18 ? String(d.nip) : null;

    try {
        const data = {
            name: d.name,
            nip,
            email: d.email && d.email !== "" ? d.email : null,
            researchGroup: d.researchGroup || null,
            researchTopic: d.researchTopic || null,
            // nipMissing is derived, never hand-set: a row either has a valid
            // NIP or it is waiting for one.
            nipMissing: nip === null,
            active: d.active ?? true,
        };

        if (d.id) {
            await prisma.supervisor.update({ where: { id: d.id }, data });
        } else {
            await prisma.supervisor.create({ data });
        }
        revalidatePath("/admin/supervisors");
        revalidatePath("/forms/xrd");
        return { success: true, message: d.id ? "Supervisor updated" : "Supervisor added" };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (msg.includes("Unique constraint")) {
            return { success: false, message: "That NIP or email is already registered" };
        }
        return { success: false, message: msg };
    }
}

/**
 * Load the scraped directory into the table. Idempotent: matches on NIP when
 * present, otherwise on email, so re-running never duplicates a lecturer.
 * Never overwrites an existing non-null NIP with null.
 */
export async function seedSupervisorsFromDirectory(): Promise<ActionResult> {
    try {
        await requireAdmin();
    } catch {
        return { success: false, message: "Only an administrator can seed the directory" };
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const s of SUPERVISORS) {
        const existing = s.nip
            ? await prisma.supervisor.findFirst({ where: { OR: [{ nip: s.nip }, { email: s.email }] } })
            : await prisma.supervisor.findFirst({ where: { email: s.email } });

        if (existing) {
            // Never downgrade a known NIP to null.
            const nextNip = s.nip ?? existing.nip;
            await prisma.supervisor.update({
                where: { id: existing.id },
                data: {
                    name: s.name,
                    nip: nextNip,
                    nipMissing: nextNip === null,
                    researchGroup: s.researchGroup ?? existing.researchGroup,
                    researchTopic: s.researchTopic ?? existing.researchTopic,
                    profileUrl: s.profileUrl ?? existing.profileUrl,
                },
            });
            updated++;
        } else {
            await prisma.supervisor.create({
                data: {
                    name: s.name,
                    nip: s.nip,
                    email: s.email,
                    researchGroup: s.researchGroup,
                    researchTopic: s.researchTopic,
                    profileUrl: s.profileUrl,
                    nipMissing: s.nip === null,
                },
            });
            created++;
        }
    }

    revalidatePath("/admin/supervisors");
    revalidatePath("/forms/xrd");
    return {
        success: true,
        message: `Directory loaded: ${created} added, ${updated} updated, ${skipped} skipped`,
    };
}

export async function deactivateSupervisor(id: string): Promise<ActionResult> {
    try {
        await requireAdmin();
    } catch {
        return { success: false, message: "Only an administrator can manage supervisors" };
    }
    // Deactivation only, never deletion.
    await prisma.supervisor.update({ where: { id }, data: { active: false } });
    revalidatePath("/admin/supervisors");
    return { success: true, message: "Supervisor deactivated" };
}
