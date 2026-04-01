"use client";

import {
    Document,
    Page,
    Text,
    View,
    Image,
    StyleSheet,
    Font,
} from "@react-pdf/renderer";

// ─── Types ──────────────────────────────────────────────────────────────
export type XrdFormData = {
    // Identity
    namaAlat: string;
    nomorRegistrasi: string;
    jenisRegistrasi: string;
    nama: string;
    nim: string;
    alamat: string;
    universitas: string;
    email: string;
    noKontak: string;

    // Samples
    kodeSampel: string[];

    // Parameter Umum
    rangeStart: string;
    rangeEnd: string;
    lajuPindai: string;
    step: string;

    // Parameter Khusus
    standarDifraksi: boolean;
    matchIcdd: boolean;

    // Jenis Sampel
    jenisSampel: string; // "Bubuk" | "Membran" | "Pellet" | "Padatan"

    // ICDD Table (page 2)
    icddRows: Array<{
        namaSampel: string;
        unsurUnsur: string;
        fasaStruktur: string;
    }>;

    // Signature
    tanggal: string;
    pembimbing: string;
    nipPembimbing: string;
    namaPemohon: string;
    nimPemohon: string;
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    page: {
        paddingTop: 18,
        paddingBottom: 28,
        paddingHorizontal: 38,
        fontSize: 10,
        fontFamily: "Helvetica",
        color: "#1a1a1a",
    },
    headerImage: {
        width: "100%",
        marginBottom: 8,
    },

    // Form rows
    formRow: {
        flexDirection: "row",
        marginBottom: 3,
        alignItems: "flex-start",
    },
    formLabel: {
        width: 125,
        fontSize: 10,
    },
    formColon: {
        width: 10,
        fontSize: 10,
    },
    formValue: {
        flex: 1,
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
    },
    formValueNormal: {
        flex: 1,
        fontSize: 10,
    },

    // Section titles
    sectionTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        marginTop: 8,
        marginBottom: 3,
    },

    // Checkbox
    checkRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 2,
    },
    checkbox: {
        width: 11,
        height: 11,
        borderWidth: 1,
        borderColor: "#333",
        marginRight: 6,
        justifyContent: "center",
        alignItems: "center",
    },
    checkMark: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
    },

    // Horizontal rule
    hr: {
        borderBottomWidth: 0.5,
        borderBottomColor: "#aaa",
        marginVertical: 6,
    },

    // Notes
    noteTitle: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        marginTop: 6,
        marginBottom: 3,
    },
    noteItem: {
        fontSize: 8,
        marginBottom: 1.5,
        paddingLeft: 14,
    },
    noteLabel: {
        fontSize: 8,
        fontFamily: "Helvetica-Bold",
    },

    // Signature section
    signatureSection: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 20,
        paddingHorizontal: 10,
    },
    signatureBlock: {
        width: "45%",
        alignItems: "center",
    },
    signatureLine: {
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        width: "80%",
        marginTop: 40,
        marginBottom: 3,
    },

    // Declaration
    declaration: {
        fontSize: 8.5,
        marginTop: 12,
        lineHeight: 1.4,
        fontFamily: "Helvetica-Oblique",
    },

    // ─── Page 2: ICDD Table ──────────────────────────────────────────
    tableTitle: {
        fontSize: 14,
        fontFamily: "Helvetica-Bold",
        textAlign: "center",
        marginTop: 8,
        marginBottom: 12,
    },
    table: {
        borderWidth: 1,
        borderColor: "#333",
    },
    tableHeaderRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        backgroundColor: "#f0f0f0",
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#ddd",
        minHeight: 22,
    },
    tableColNo: {
        width: "8%",
        borderRightWidth: 1,
        borderRightColor: "#333",
        padding: 4,
        justifyContent: "center",
    },
    tableColName: {
        width: "30%",
        borderRightWidth: 1,
        borderRightColor: "#333",
        padding: 4,
        justifyContent: "center",
    },
    tableColUnsur: {
        width: "32%",
        borderRightWidth: 1,
        borderRightColor: "#333",
        padding: 4,
        justifyContent: "center",
    },
    tableColFasa: {
        width: "30%",
        padding: 4,
        justifyContent: "center",
    },
    tableCellHeader: {
        fontSize: 10,
        fontFamily: "Helvetica-Bold",
        textAlign: "center",
    },
    tableCell: {
        fontSize: 9,
    },

    // Footer
    footerNote: {
        fontSize: 8,
        color: "red",
        fontFamily: "Helvetica-BoldOblique",
        marginTop: 16,
    },

    // Page number
    pageNumber: {
        position: "absolute",
        bottom: 15,
        right: 40,
        fontSize: 8,
        color: "#666",
    },
});

// ─── Checkbox Component ─────────────────────────────────────────────────
function Checkbox({ checked, label }: { checked: boolean; label: string }) {
    return (
        <View style={styles.checkRow}>
            <View style={styles.checkbox}>
                {checked && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={{ fontSize: 9 }}>{label}</Text>
        </View>
    );
}

// ─── Form Row Component ─────────────────────────────────────────────────
function FormRow({
    label,
    value,
    bold = true,
}: {
    label: string;
    value: string;
    bold?: boolean;
}) {
    return (
        <View style={styles.formRow}>
            <Text style={styles.formLabel}>{label}</Text>
            <Text style={styles.formColon}>:</Text>
            <Text style={bold ? styles.formValue : styles.formValueNormal}>
                {value || ""}
            </Text>
        </View>
    );
}

// ─── Empty Table Row ────────────────────────────────────────────────────
function EmptyTableRow({ index }: { index: number }) {
    return (
        <View style={styles.tableRow}>
            <View style={styles.tableColNo}>
                <Text style={styles.tableCell}>{index}</Text>
            </View>
            <View style={styles.tableColName}>
                <Text style={styles.tableCell}></Text>
            </View>
            <View style={styles.tableColUnsur}>
                <Text style={styles.tableCell}></Text>
            </View>
            <View style={styles.tableColFasa}>
                <Text style={styles.tableCell}></Text>
            </View>
        </View>
    );
}

function FilledTableRow({
    index,
    row,
}: {
    index: number;
    row: { namaSampel: string; unsurUnsur: string; fasaStruktur: string };
}) {
    return (
        <View style={styles.tableRow}>
            <View style={styles.tableColNo}>
                <Text style={styles.tableCell}>{index}</Text>
            </View>
            <View style={styles.tableColName}>
                <Text style={styles.tableCell}>{row.namaSampel}</Text>
            </View>
            <View style={styles.tableColUnsur}>
                <Text style={styles.tableCell}>{row.unsurUnsur}</Text>
            </View>
            <View style={styles.tableColFasa}>
                <Text style={styles.tableCell}>{row.fasaStruktur}</Text>
            </View>
        </View>
    );
}

// ─── Main Document ──────────────────────────────────────────────────────
export function XrdFormDocument({ data }: { data: XrdFormData }) {
    const totalTableRows = 8;

    return (
        <Document>
            {/* ═══ PAGE 1: Registration Form ═══ */}
            <Page size="A4" style={styles.page}>
                {/* Header Image */}
                <Image style={styles.headerImage} src="/header_xrd.png" />

                {/* Instrument Info */}
                <FormRow label="Nama Alat" value={data.namaAlat || "ALAT XRD"} />
                <FormRow label="Nomor Registrasi" value={data.nomorRegistrasi} />
                <FormRow label="Jenis registrasi" value={data.jenisRegistrasi} />

                <View style={styles.hr} />

                {/* Personal Info */}
                <FormRow label="Nama" value={data.nama} />
                <FormRow label="NIM" value={data.nim} />
                <FormRow label="Alamat" value={data.alamat} />
                <FormRow label="Universitas-Prodi" value={data.universitas} />
                <FormRow label="Email" value={data.email} />
                <FormRow label="No Kontak" value={data.noKontak} />

                <View style={styles.hr} />

                {/* Sample Info */}
                <FormRow label="Kode sampel" value={data.kodeSampel.filter(Boolean).join("; ")} />
                <FormRow label="Jumlah sampel" value={`${data.kodeSampel.filter(Boolean).length} Sampel`} />

                {/* Parameter Umum */}
                <Text style={styles.sectionTitle}>Parameter Umum</Text>
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>  Rentang 2θ (max 5-90°)</Text>
                    <Text style={styles.formColon}>:</Text>
                    <Text style={styles.formValueNormal}>
                        {data.rangeStart || "___"}° sampai {data.rangeEnd || "___"}°
                    </Text>
                </View>
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>  Laju pindai (max 10-5)</Text>
                    <Text style={styles.formColon}>:</Text>
                    <Text style={styles.formValueNormal}>
                        {data.lajuPindai || "___"} °/min
                    </Text>
                </View>
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>  Step (max 0.02-0.008)</Text>
                    <Text style={styles.formColon}>:</Text>
                    <Text style={styles.formValueNormal}>
                        {data.step || "___"}°
                    </Text>
                </View>

                {/* Parameter Khusus */}
                <Text style={styles.sectionTitle}>Parameter Khusus</Text>
                <Checkbox
                    checked={data.standarDifraksi}
                    label="Pengukuran Standar difraksi sinar-X Rp. 200.000,-"
                />
                <Checkbox
                    checked={data.matchIcdd}
                    label="Match ICDD: Ya (+ Rp 50.000), Tidak"
                />
                <View style={styles.formRow}>
                    <Text style={styles.formLabel}>  Jenis sampel</Text>
                    <Text style={styles.formColon}>:</Text>
                    <Text style={styles.formValueNormal}>
                        {data.jenisSampel || "Bubuk, Membran, Pellet, Padatan"}
                    </Text>
                </View>

                <View style={styles.hr} />

                {/* Catatan */}
                <Text style={styles.noteTitle}>Catatan:</Text>
                <Text style={styles.noteItem}>
                    a)  Biaya pengukuran standar difraksi sinar-X adalah Rp 200.000
                </Text>
                <Text style={styles.noteItem}>
                    b)  Parameter standar pengukuran: rentang 20 5°-80°, laju pindai 10°/min step 0.01°, silakan
                </Text>
                <Text style={{ ...styles.noteItem, paddingLeft: 24 }}>
                    mengosongkan parameter umum bila ingin menggunakan parameter umum standar pengukuran.
                </Text>
                <Text style={styles.noteItem}>
                    c)  Jika memilih &quot;Match ICDD&quot; <Text style={styles.noteLabel}>wajib</Text> menyertakan unsur senyawa dan/atau fasa struktur dari sampel.
                </Text>
                <Text style={styles.noteItem}>
                    d)  Untuk sampel bubuk, mohon menghaluskan bubuknya sebelum diserahkan untuk pengukuran
                </Text>
                <Text style={styles.noteItem}>
                    e)  Khusus sampel membran, luas membran minimal 2x2 cm.
                </Text>
                <Text style={styles.noteItem}>
                    f)   Khusus sampel padatan, luas minimal 1x1 cm.
                </Text>

                <View style={styles.hr} />

                {/* Declaration */}
                <Text style={styles.declaration}>
                    Dengan ini saya menyatakan bahwa sampel yang dikirimkan bukan sampel berbahaya* dan hanya
                    dipergunakan untuk keperluan penelitian.
                </Text>

                {/* Signature Block */}
                <View style={styles.signatureSection}>
                    <View style={styles.signatureBlock}>
                        <Text style={{ fontSize: 8.5 }}>
                            Bandung, {data.tanggal || "...................................."}
                        </Text>
                        <Text style={{ fontSize: 8.5, marginTop: 1 }}>Pembimbing,</Text>
                        <View style={styles.signatureLine} />
                        <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
                            {data.pembimbing || ""}
                        </Text>
                        <Text style={{ fontSize: 7.5, color: "#555" }}>
                            {data.nipPembimbing ? `NIP. ${data.nipPembimbing}` : "NIP. "}
                        </Text>
                    </View>
                    <View style={styles.signatureBlock}>
                        <Text style={{ fontSize: 8.5 }}>{"\u00A0"}</Text>
                        <Text style={{ fontSize: 8.5, marginTop: 1 }}>Pemohon,</Text>
                        <View style={styles.signatureLine} />
                        <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold" }}>
                            {data.namaPemohon || ""}
                        </Text>
                        <Text style={{ fontSize: 7.5, color: "#555" }}>
                            {data.nimPemohon ? `NIM. ${data.nimPemohon}` : "NIM. "}
                        </Text>
                    </View>
                </View>

                {/* Page number */}
                <Text
                    style={styles.pageNumber}
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                    fixed
                />
            </Page>

            {/* ═══ PAGE 2: ICDD Matching Table ═══ */}
            <Page size="A4" style={styles.page}>
                {/* Header Image */}
                <Image style={styles.headerImage} src="/header_xrd.png" />

                {/* Title */}
                <Text style={styles.tableTitle}>
                    Informasi Unsur dan Fasa Sampel untuk <Text style={{ fontFamily: "Helvetica-Oblique" }}>Matching ICDD</Text>
                </Text>

                {/* Table */}
                <View style={styles.table}>
                    {/* Header Row */}
                    <View style={styles.tableHeaderRow}>
                        <View style={styles.tableColNo}>
                            <Text style={styles.tableCellHeader}>No</Text>
                        </View>
                        <View style={styles.tableColName}>
                            <Text style={styles.tableCellHeader}>Nama Sampel</Text>
                        </View>
                        <View style={styles.tableColUnsur}>
                            <Text style={styles.tableCellHeader}>Unsur-Unsur</Text>
                        </View>
                        <View style={styles.tableColFasa}>
                            <Text style={styles.tableCellHeader}>Fasa struktur</Text>
                        </View>
                    </View>

                    {/* Data Rows */}
                    {Array.from({ length: totalTableRows }).map((_, i) => {
                        const row = data.icddRows[i];
                        if (row) {
                            return <FilledTableRow key={i} index={i + 1} row={row} />;
                        }
                        return <EmptyTableRow key={i} index={i + 1} />;
                    })}
                </View>

                {/* Footer Warning */}
                <Text style={styles.footerNote}>
                    *Lampirkan peringatan/MSDS untuk bahan-bahan berbahaya dan beracun
                </Text>

                {/* Page number */}
                <Text
                    style={styles.pageNumber}
                    render={({ pageNumber, totalPages }) =>
                        `Halaman ${pageNumber} dari ${totalPages}`
                    }
                    fixed
                />
            </Page>
        </Document>
    );
}

// ─── Default empty form data ────────────────────────────────────────────
export const emptyXrdFormData: XrdFormData = {
    namaAlat: "ALAT XRD",
    nomorRegistrasi: "",
    jenisRegistrasi: "Registrasi Akademik",
    nama: "",
    nim: "",
    alamat: "",
    universitas: "",
    email: "",
    noKontak: "",
    kodeSampel: [""],
    rangeStart: "",
    rangeEnd: "",
    lajuPindai: "",
    step: "",
    standarDifraksi: false,
    matchIcdd: false,
    jenisSampel: "",
    icddRows: [],
    tanggal: "",
    pembimbing: "",
    nipPembimbing: "",
    namaPemohon: "",
    nimPemohon: "",
};
