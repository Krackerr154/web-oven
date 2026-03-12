import { getAllGlassware } from "@/app/actions/glassware";
import UserGlasswareClient from "./glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Glassware Inventory | G-Labs",
    description: "Search and borrow laboratory glassware",
};

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function UserGlasswarePage() {
    // Fetch all glassware directly from the database
    const initialGlassware = await getAllGlassware();
    const session = await getServerSession(authOptions);
    const currentUserId = session?.user?.id;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                        Glassware Inventory
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Search for lab-owned glassware to borrow, or contact owners of user-owned glassware.
                    </p>
                </div>
            </div>

            <UserGlasswareClient initialData={initialGlassware} currentUserId={currentUserId} />
        </div>
    );
}
