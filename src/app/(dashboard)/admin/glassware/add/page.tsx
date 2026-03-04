import AddAdminGlasswareClient from "./add-glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Add Lab Glassware | G-Labs",
    description: "Add new glassware to the laboratory inventory",
};

export default function AddAdminGlasswarePage() {
    return (
        <div className="space-y-6">
            <AddAdminGlasswareClient />
        </div>
    );
}
