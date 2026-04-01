"use client";

import { useState, useEffect } from "react";
import { Download, Loader2, FileText, ArrowLeft, Plus, X, Eye } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { pdf } from "@react-pdf/renderer";
import { XrdFormDocument, emptyXrdFormData } from "@/components/xrd-form-pdf";
import type { XrdFormData } from "@/components/xrd-form-pdf";

export default function XrdFormPage() {
  const { data: session } = useSession();
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [formData, setFormData] = useState<XrdFormData>({
    ...emptyXrdFormData,
  });

  // Auto-fill from session & current date
  useEffect(() => {
    if (session?.user) {
      const today = new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      const firstSupervisor = ((session.user as any).supervisors as string[])?.[0] || "";

      setFormData(prev => ({
        ...prev,
        nama: (session.user as any).name || prev.nama,
        nim: (session.user as any).nim || prev.nim,
        email: (session.user as any).email || prev.email,
        noKontak: (session.user as any).phone || prev.noKontak,
        namaPemohon: (session.user as any).name || prev.namaPemohon,
        nimPemohon: (session.user as any).nim || prev.nimPemohon,
        pembimbing: firstSupervisor || prev.pembimbing,
        tanggal: today,
      }));
    }
  }, [session]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // ICDD table management
  const addIcddRow = () => {
    if (formData.icddRows.length < 8) {
      setFormData(prev => ({
        ...prev,
        icddRows: [...prev.icddRows, { namaSampel: "", unsurUnsur: "", fasaStruktur: "" }],
      }));
    }
  };

  const removeIcddRow = (index: number) => {
    setFormData(prev => ({
      ...prev,
      icddRows: prev.icddRows.filter((_, i) => i !== index),
    }));
  };

  const updateIcddRow = (index: number, field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      icddRows: prev.icddRows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    }));
  };

  // Sample code management
  const addSampleCode = () => {
    setFormData(prev => ({ ...prev, kodeSampel: [...prev.kodeSampel, ""] }));
  };

  const removeSampleCode = (index: number) => {
    setFormData(prev => ({
      ...prev,
      kodeSampel: prev.kodeSampel.length > 1 ? prev.kodeSampel.filter((_, i) => i !== index) : [""],
    }));
  };

  const updateSampleCode = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      kodeSampel: prev.kodeSampel.map((code, i) => (i === index ? value : code)),
    }));
  };

  const sampleCount = formData.kodeSampel.filter(Boolean).length;

  async function generatePdfBlob() {
    const blob = await pdf(<XrdFormDocument data={formData} />).toBlob();
    return blob;
  }

  async function handlePreview() {
    setIsPreviewing(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      // Revoke old URL
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(url);
    } catch (err) {
      console.error("Preview error:", err);
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const blob = await generatePdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = formData.nama.replace(/[^a-zA-Z0-9]/g, "_") || "XRD";
      a.download = `XRD_Submission_${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
    } finally {
      setIsGenerating(false);
    }
  }

  const inputClass = "w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 placeholder-slate-500";

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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
          Fill in the details below to generate a ready-to-print registration form (PDF).
          Fields are auto-populated from your profile where possible.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* ── Form Column ── */}
        <form onSubmit={handleDownload} className="flex-1 space-y-6">

          {/* Identity Section */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5 border-b border-slate-700 pb-3">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Full Name</label>
                <input required name="nama" value={formData.nama} onChange={handleChange} className={inputClass} placeholder="Full Name" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">NIM / Student ID</label>
                <input required name="nim" value={formData.nim} onChange={handleChange} className={inputClass} placeholder="Student ID" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Address</label>
                <input name="alamat" value={formData.alamat} onChange={handleChange} className={inputClass} placeholder="e.g. Cisitu Lama gang 7, 31/154B" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">University / Department</label>
                <input required name="universitas" value={formData.universitas} onChange={handleChange} className={inputClass} placeholder="e.g. ITB-Kimia" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Email</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="email@example.com" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Phone / WhatsApp</label>
                <input required name="noKontak" value={formData.noKontak} onChange={handleChange} className={inputClass} placeholder="08xxxx" />
              </div>
            </div>
          </div>

          {/* Instrument & Samples */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5 border-b border-slate-700 pb-3">Instrument & Samples</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Instrument Name</label>
                <input name="namaAlat" value={formData.namaAlat} onChange={handleChange} className={inputClass} readOnly />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Registration Type</label>
                <select name="jenisRegistrasi" value={formData.jenisRegistrasi} onChange={handleChange} className={inputClass}>
                  <option value="Registrasi Akademik">Registrasi Akademik</option>
                  <option value="Registrasi Umum">Registrasi Umum</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Sample Type</label>
                <select name="jenisSampel" value={formData.jenisSampel} onChange={handleChange} className={inputClass}>
                  <option value="">Select...</option>
                  <option value="Bubuk">Bubuk (Powder)</option>
                  <option value="Membran">Membran</option>
                  <option value="Pellet">Pellet</option>
                  <option value="Padatan">Padatan (Solid)</option>
                </select>
              </div>
            </div>

            {/* Dynamic Sample Codes */}
            <div className="mt-5 pt-5 border-t border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-medium text-slate-400">
                  Sample Codes <span className="text-orange-400 ml-1">({sampleCount} sample{sampleCount !== 1 ? "s" : ""})</span>
                </label>
                <button type="button" onClick={addSampleCode}
                  className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Sample
                </button>
              </div>
              <div className="space-y-2">
                {formData.kodeSampel.map((code, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-mono w-5 text-right shrink-0">{idx + 1}.</span>
                    <input
                      value={code}
                      onChange={(e) => updateSampleCode(idx, e.target.value)}
                      className={inputClass}
                      placeholder={`Sample code ${idx + 1} (e.g. Ni_F-1:1(${idx + 1}))`}
                    />
                    <button type="button" onClick={() => removeSampleCode(idx)}
                      className="p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                      title="Remove sample">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5 border-b border-slate-700 pb-3">Measurement Parameters</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Range 2θ Start (°)</label>
                <input type="number" min="5" max="90" step="any" name="rangeStart" value={formData.rangeStart} onChange={handleChange} className={inputClass} placeholder="5" />
                {formData.rangeStart && (Number(formData.rangeStart) < 5 || Number(formData.rangeStart) > 90) && (
                  <p className="text-[10px] text-red-400">Must be between 5 and 90</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Range 2θ End (°)</label>
                <input type="number" min="5" max="90" step="any" name="rangeEnd" value={formData.rangeEnd} onChange={handleChange} className={inputClass} placeholder="80" />
                {formData.rangeEnd && (Number(formData.rangeEnd) < 5 || Number(formData.rangeEnd) > 90) && (
                  <p className="text-[10px] text-red-400">Must be between 5 and 90</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Scan Speed (°/min)</label>
                <input type="number" min="5" max="10" step="any" name="lajuPindai" value={formData.lajuPindai} onChange={handleChange} className={inputClass} placeholder="10" />
                {formData.lajuPindai && (Number(formData.lajuPindai) < 5 || Number(formData.lajuPindai) > 10) && (
                  <p className="text-[10px] text-red-400">Must be between 5 and 10</p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-400">Step Size (°)</label>
                <input type="number" min="0.008" max="0.02" step="0.001" name="step" value={formData.step} onChange={handleChange} className={inputClass} placeholder="0.01" />
                {formData.step && (Number(formData.step) < 0.008 || Number(formData.step) > 0.02) && (
                  <p className="text-[10px] text-red-400">Must be between 0.008 and 0.02</p>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-4">Leave blank to use standard parameters (20° 5°–80°, 10°/min, 0.01° step).</p>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" name="standarDifraksi" checked={formData.standarDifraksi} onChange={handleChange}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500" />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Pengukuran Standar difraksi sinar-X (Rp 200.000)
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" name="matchIcdd" checked={formData.matchIcdd} onChange={handleChange}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-orange-500 focus:ring-orange-500" />
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                  Match ICDD (+ Rp 50.000)
                </span>
              </label>
            </div>
          </div>

          {/* ICDD Table — shown only when matchIcdd is checked */}
          {formData.matchIcdd && (
            <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-5 border-b border-slate-700 pb-3">ICDD Matching Data</h2>
              <p className="text-xs text-slate-400 mb-4">Add sample element and phase data for ICDD matching (max 8 rows).</p>

              <div className="space-y-3">
                {formData.icddRows.map((row, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <span className="text-xs text-slate-500 mt-3 w-6 shrink-0">{idx + 1}.</span>
                    <input value={row.namaSampel} onChange={(e) => updateIcddRow(idx, "namaSampel", e.target.value)}
                      className={inputClass + " flex-1"} placeholder="Sample name" />
                    <input value={row.unsurUnsur} onChange={(e) => updateIcddRow(idx, "unsurUnsur", e.target.value)}
                      className={inputClass + " flex-1"} placeholder="Elements" />
                    <input value={row.fasaStruktur} onChange={(e) => updateIcddRow(idx, "fasaStruktur", e.target.value)}
                      className={inputClass + " flex-1"} placeholder="Phase" />
                    <button type="button" onClick={() => removeIcddRow(idx)}
                      className="mt-2 p-1.5 text-slate-500 hover:text-red-400 transition-colors shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {formData.icddRows.length < 8 && (
                  <button type="button" onClick={addIcddRow}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1.5 font-medium px-1 py-1 transition-colors">
                    <Plus className="h-3.5 w-3.5" /> Add Row
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Supervisor Details */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-5 border-b border-slate-700 pb-3">Supervisor Details</h2>
            <div className="space-y-1.5 max-w-md">
              <label className="text-xs font-medium text-slate-400">Main Supervisor NIP</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                name="nipPembimbing"
                value={formData.nipPembimbing}
                onChange={(e) => {
                  // Strictly enforce numbers only
                  const numericValue = e.target.value.replace(/[^0-9]/g, '');
                  setFormData(prev => ({ ...prev, nipPembimbing: numericValue }));
                }}
                className={inputClass}
                placeholder="e.g. 197912142008121002"
              />
              <p className="text-[10px] text-slate-500">Numeric characters only. Signature name and date are automatically generated.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-700 pt-6">
            <button type="button" onClick={handlePreview} disabled={isPreviewing}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {isPreviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Preview
            </button>
            <button type="submit" disabled={isGenerating}
              className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </button>
          </div>
        </form>

        {/* ── Preview Column ── */}
        {previewUrl && (
          <div className="lg:w-[420px] shrink-0">
            <div className="sticky top-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-300">PDF Preview</h3>
                <button onClick={() => { URL.revokeObjectURL(previewUrl); setPreviewUrl(null); }}
                  className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Close</button>
              </div>
              <div className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                <iframe src={previewUrl} className="w-full h-[600px]" title="PDF Preview" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
