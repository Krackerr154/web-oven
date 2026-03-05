import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import BorrowedGlasswareClient from "./borrowed-glassware-client";
import { redirect } from "next/navigation";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Borrowed Glassware | G-Labs",
    description: "Manage and return your borrowed laboratory glassware",
};

export default async function BorrowedGlasswarePage() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
        redirect("/login");
    }

    // Fetch the user's active (unreturned) loans
    const activeLoans = await prisma.glasswareLoan.findMany({
        where: {
            userId: session.user.id,
            status: { in: ["PENDING_BORROW", "BORROWED", "PENDING_RETURN", "REJECTED"] }
        },
        include: {
            glassware: true
        },
        orderBy: [
            { status: "asc" },
            { borrowedAt: "desc" }
        ]
    });

    // Map to a format suitable for the client component
    const mappedLoans = activeLoans.map(loan => ({
        id: loan.id,
        quantity: loan.quantity,
        purpose: loan.purpose,
        borrowedAt: loan.borrowedAt,
        status: loan.status,
        glassware: {
            name: loan.glassware.name,
            type: loan.glassware.type,
            size: loan.glassware.size,
            unit: loan.glassware.unit,
            customId: loan.glassware.customId,
        }
    }));

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-emerald-500 bg-clip-text text-transparent">
                        My Active Loans
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Review the Lab glassware you have currently borrowed. Please return items promptly when finished to keep inventory accurate.
                    </p>
                </div>
            </div>

            <BorrowedGlasswareClient loans={mappedLoans} />
        </div>
    );
}
