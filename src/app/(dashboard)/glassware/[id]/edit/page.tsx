import EditUserGlasswareClient from "./edit-user-glassware-client";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import prisma from "@/lib/prisma";

export const metadata: Metadata = {
    title: "Edit Private Glassware | G-Labs",
    description: "Edit your personal laboratory glassware",
};

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function EditUserGlasswarePage({ params }: PageProps) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        redirect("/signin");
    }

    const { id } = await params;

    const glassware = await prisma.glassware.findUnique({
        where: { id }
    });

    if (!glassware) {
        notFound();
    }

    if (glassware.ownerId !== session.user.id) {
        redirect("/glassware"); // Unauthorized
    }

    return (
        <div className="space-y-6">
            <EditUserGlasswareClient initialData={glassware} />
        </div>
    );
}
