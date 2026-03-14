import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";

export const metadata = {
  title: "Forms Hub - AP Lab",
  description: "Download and generate submission forms.",
};

const forms = [
  {
    id: "xrd",
    title: "XRD Sample Submission",
    description: "Generate a submission form for XRD (X-Ray Diffraction) characterization.",
    icon: FileText,
    href: "/forms/xrd",
  },
];

export default function FormsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Laboratory Forms</h1>
        <p className="text-slate-400">
          Select a form below to automatically fill in your details and generate a PDF ready for submission.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {forms.map((form) => (
          <Link
            key={form.id}
            href={form.href}
            className="group block p-6 bg-slate-800 rounded-xl border border-slate-700/50 hover:bg-slate-700/50 transition-all hover:border-orange-500/50"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-orange-500/10 text-orange-400 rounded-lg group-hover:bg-orange-500 group-hover:text-white transition-colors">
                <form.icon className="h-6 w-6" />
              </div>
              <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
            </div>
            
            <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-orange-400 transition-colors">
              {form.title}
            </h3>
            <p className="text-sm text-slate-400 line-clamp-2">
              {form.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
