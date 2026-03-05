import prisma from "@/lib/prisma";
import ActiveLoansClient from "./active-loans-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Active Glassware Loans | Admin",
    description: "Manage and force-return active glassware loans",
};

export default async function AdminActiveLoansPage() {
    const activeLoans = await prisma.glasswareLoan.findMany({
        where: { status: "BORROWED" },
        include: {
            glassware: true,
            user: { select: { name: true, email: true } }
        },
        orderBy: { borrowedAt: "desc" }
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                        Active Loans
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Monitor all currently borrowed glassware. Administrators can use the Force Return feature if items are not returned on time.
                    </p>
                </div>
            </div>

            <ActiveLoansClient loans={activeLoans as any} />
        </div>
    );
}
