import { Metadata } from "next";
import AddUserChemicalClient from "./add-chemical-client";

export const metadata: Metadata = {
    title: "Add Personal Chemical | AP Lab",
    description: "Add a semi-private chemical to the laboratory inventory",
};

export default function AddUserChemicalPage() {
    return <AddUserChemicalClient />;
}
