import AddUserGlasswareClient from "./add-glassware-client";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Add Private Glassware | AP-Lab",
    description: "Register glassware strictly owned by you",
};

export default function AddUserGlasswarePage() {
    return (
        <div className="space-y-6">
            <AddUserGlasswareClient />
        </div>
    );
}
