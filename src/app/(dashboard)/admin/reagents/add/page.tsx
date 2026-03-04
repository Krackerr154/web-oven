import { Metadata } from "next";
import AddAdminChemicalClient from "./add-chemical-client";

export const metadata: Metadata = {
    title: "Add Lab Chemical | Admin",
    description: "Add a new chemical to the central laboratory inventory",
};

export default function AddAdminChemicalPage() {
    return <AddAdminChemicalClient />;
}
