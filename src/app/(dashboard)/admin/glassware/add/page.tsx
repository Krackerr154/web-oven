import AddAdminGlasswareClient from "./add-glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Add Lab Glassware | AP-Lab",
    description: "Add new glassware to the communal lab inventory",
};

export default function AddAdminGlasswarePage() {
    return (
        <div className="space-y-6">
            <AddAdminGlasswareClient />
        </div>
    );
}
