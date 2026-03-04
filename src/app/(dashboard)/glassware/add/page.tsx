import AddUserGlasswareClient from "./add-glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Add Private Glassware | G-Labs",
    description: "Add personal glassware to the laboratory inventory",
};

export default function AddUserGlasswarePage() {
    return (
        <div className="space-y-6">
            <AddUserGlasswareClient />
        </div>
    );
}
