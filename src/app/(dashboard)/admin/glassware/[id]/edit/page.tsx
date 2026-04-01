import EditAdminGlasswareClient from "./edit-admin-glassware-client";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
    title: "Edit Lab Glassware | Admin | G-Labs",
    description: "Edit lab-owned glassware information",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditAdminGlasswarePage({ params }: PageProps) {
    const session = await getServerSession(authOptions);

    if (!session?.user || !session.user.roles.includes("ADMIN")) {
        redirect("/signin");
    }

    const { id } = await params;

    const glassware = await prisma.glassware.findUnique({
        where: { id }
    });

    if (!glassware) {
        notFound();
    }

    // Admins can only edit lab-owned items here. User-owned items have their own flow.
    if (glassware.ownerId !== null) {
        redirect("/admin/glassware"); // Unauthorized
    }

    return (
        <div className="space-y-6">
            <EditAdminGlasswareClient initialData={glassware} />
        </div>
    );
}
