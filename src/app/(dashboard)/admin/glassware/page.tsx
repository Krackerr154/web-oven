import { getAllGlassware } from "@/app/actions/glassware";
import AdminGlasswareClient from "./glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Lab Glassware | G-Labs",
    description: "Manage laboratory glassware inventory",
};

export default async function AdminGlasswarePage() {
    // Fetch all glassware directly from the database
    const initialGlassware = await getAllGlassware();

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-400 to-amber-500 bg-clip-text text-transparent">
                        Lab Glassware
                    </h1>
                    <p className="text-slate-400 mt-2 text-sm leading-relaxed max-w-2xl">
                        Manage lab-owned glassware. Use the intuitive search to filter by name, type, and size to quickly find and verify stock counts.
                    </p>
                </div>
            </div>

            <AdminGlasswareClient initialData={initialGlassware} />
        </div>
    );
}
