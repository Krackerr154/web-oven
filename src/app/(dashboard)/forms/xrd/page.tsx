"use client";

import { useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import { Download, Loader2, FileText, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function XrdFormPage() {
  const { data: session } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);

  // Initial Form State
  const [formData, setFormData] = useState({
    namaLengkap: session?.user?.name || "",
    nim: "",
    instansi: "",
    noHp: "",
    email: session?.user?.email || "",
    pembimbing: "",
    kodeSampel: "",
    wujudSampel: "Serbuk",
    jumlahSampel: "",
    preparasi: "",
    // Notice: Nama Alat, Nomor Registrasi, and Jenis Registrasi are INTENTIONALLY omitted from the user input.
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleGeneratePdf = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);

    try {
      // Fetch the generated/blank template from public forms
      const response = await fetch('/templates/xrd-submission.pdf');
      if (!response.ok) throw new Error("Could not find the template document");
      const templateBytes = await response.arrayBuffer();

      // Load the PDF Document
      const pdfDoc = await PDFDocument.load(templateBytes);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];

      // Configuration of where to place text on the PDF.
      // NOTE: You will likely need to adjust these raw (x,y) coordinates to perfectly align with lines on your specific PDF.
      // (X=0, Y=0) is the bottom-left corner of the page for pdf-lib. Standard A4 is roughly 595 x 842 points.
      
      const textSize = 10;
      const color = rgb(0.1, 0.1, 0.1); 
      
      const drawText = (text: string, x: number, y: number) => {
        if (!text) return;
        firstPage.drawText(text, { x, y, size: textSize, color });
      };

      // == ESTIMATED COORDINATES ==
      // Adjust these based on visually checking the downloaded PDF against the original
      drawText(formData.namaLengkap, 200, 680);
      drawText(formData.nim, 200, 660);
      drawText(formData.instansi, 200, 640);
      drawText(formData.noHp, 200, 620);
      drawText(formData.email, 200, 600);
      drawText(formData.pembimbing, 200, 580);
      
      drawText(formData.kodeSampel, 200, 500);
      drawText(formData.wujudSampel, 200, 480);
      drawText(formData.jumlahSampel, 200, 460);
      drawText(formData.preparasi, 200, 440);

      // Save PDF
      const pdfBytes = await pdfDoc.save();
      
      // Trigger Download
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `XRD_Submission_${formData.namaLengkap.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF. Make sure the template exists in public/templates/xrd-submission.pdf");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <Link href="/forms" className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Forms
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <div className="p-2 bg-orange-500/20 text-orange-400 rounded-lg">
            <FileText className="h-6 w-6" />
          </div>
          XRD Sample Submission
        </h1>
        <p className="text-slate-400 mt-2">
          Fill in the details below to generate your ready-to-print XRD form. 
          "Nama Alat", "Nomor Registrasi", and "Jenis Registrasi" will deliberately be left blank for the admin to fill.
        </p>
      </div>

      <form onSubmit={handleGeneratePdf} className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-white mb-6 border-b border-slate-700 pb-4">Personal Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Full Name</label>
            <input 
              required
              name="namaLengkap"
              value={formData.namaLengkap}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="e.g. John Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">NIM / NIP / NIDN</label>
            <input 
              required
              name="nim"
              value={formData.nim}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="Your ID Number"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Institution / Faculty</label>
            <input 
              required
              name="instansi"
              value={formData.instansi}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="e.g. Universitas Indonesia"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Supervisor / Evaluator</label>
            <input 
              required
              name="pembimbing"
              value={formData.pembimbing}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="e.g. Dr. Jane Doe"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Phone (WhatsApp)</label>
            <input 
              required
              name="noHp"
              value={formData.noHp}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="08123456789"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Email Address</label>
            <input 
              required
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="john@example.com"
            />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white mb-6 border-b border-slate-700 pb-4">Sample Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sample Code</label>
            <input 
              required
              name="kodeSampel"
              value={formData.kodeSampel}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="e.g. SPL-001"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sample Form</label>
            <select 
              name="wujudSampel"
              value={formData.wujudSampel}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
            >
              <option value="Serbuk">Serbuk (Powder)</option>
              <option value="Padatan">Padatan (Solid/Pellet)</option>
              <option value="Film">Film</option>
              <option value="Lainnya">Lainnya...</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Sample Amount</label>
            <input 
              required
              name="jumlahSampel"
              value={formData.jumlahSampel}
              onChange={handleChange}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500" 
              placeholder="e.g. 5 Gram"
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium text-slate-300">Special Preparation / Comments</label>
            <textarea 
              name="preparasi"
              value={formData.preparasi}
              onChange={handleChange}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 resize-none" 
              placeholder="e.g. Toxicity warnings, preferred angles, etc."
            />
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-700 pt-6">
          <button
            type="submit"
            disabled={isGenerating}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Download className="h-5 w-5" />
            )}
            Download PDF Validation Form
          </button>
        </div>
      </form>
    </div>
  );
}
