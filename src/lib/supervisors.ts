/**
 * Supervisor registry seed data.
 *
 * Scraped from https://chem.itb.ac.id/dosen/ and the individual profile pages
 * that page links to, on 2 November 2026.
 *
 * Data-integrity rules applied while building this file:
 *
 *  - A NIP is recorded only when the source page states 18 digits, the ITB
 *    format. Two lecturers (zulfikar@itb.ac.id, puspasari@itb.ac.id) publish a
 *    17-digit NIP on their own profile pages. Those values are deliberately
 *    stored as null with nipMissing = true. Guessing the missing digit would
 *    put an invented number on a signed institutional document.
 *  - 21 of the 54 lecturers have no NIP on their profile at all. They are kept
 *    so the directory is complete, but marked nipMissing and filtered out of
 *    the signer dropdown until an admin supplies the NIP.
 *  - amran@itb.ac.id links to zulfikar's profile page on the source site, so
 *    its profileUrl is null rather than recording a URL that shows the
 *    wrong person.
 *  - researchGroup comes from an explicit "KK Kimia ..." line when the profile
 *    states one, otherwise from the section of the listing page the lecturer
 *    appears under.
 */
export type SupervisorSeed = {
    name: string;
    nip: string | null;
    email: string;
    researchGroup: string | null;
    researchTopic: string | null;
    profileUrl: string | null;
    nipMissing: boolean;
};

export const SUPERVISORS: SupervisorSeed[] = [
  { name: "Prof. Dr. Muhammad Bachri Amran, DEA", nip: null, email: "amran@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Trace Analysis and Speciation", profileUrl: null, nipMissing: true },
  { name: "Prof. Ir. Muhammad Ali Zulfikar, Ph.D.", nip: null, email: "zulfikar@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Functional Materials for Analytical Separation", profileUrl: "https://www.chem.itb.ac.id/dosen/muhammad-ali-zulfikar", nipMissing: true },
  { name: "Prof. Dr. Henry Setiyanto, M.T.", nip: "197301242008121002", email: "setiyanto@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Development of Modified Electrodes and Their Applications", profileUrl: "https://www.chem.itb.ac.id/henry-setiyanto/", nipMissing: false },
  { name: "Dr. Muhammad Yudhistira Azis, M. Si.", nip: null, email: "yudhistira@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Analysis and Remediation of Pollutants Speciation", profileUrl: "https://www.chem.itb.ac.id/dosen/dr-muhammad-yudhistira-azis%e2%80%8b/", nipMissing: true },
  { name: "Dr. Untung Triadhi, M. Si.", nip: "198811262015041001", email: "untung@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Functional Materials for Analytical Separation", profileUrl: "https://www.chem.itb.ac.id/dr-untung-triadhi", nipMissing: false },
  { name: "Dr. Indra Noviandri, M. Si", nip: "196611111990021001", email: "innov@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Voltammetric Sensors", profileUrl: "https://www.chem.itb.ac.id/indra-noviandri/", nipMissing: false },
  { name: "Dr. Ria Sri Rahayu, M. Si.", nip: "198509142010122005", email: "ria@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Development of Modified Electrodes and Their Applications", profileUrl: "https://www.chem.itb.ac.id/dosen/dr-ria-sri-rahayu-s-si-m-si/", nipMissing: false },
  { name: "Dr. Rusnadi, M. Si.", nip: "198202082008121002", email: "rusnadi@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Non-Chromatographic Separation", profileUrl: "https://www.chem.itb.ac.id/rusnadi/", nipMissing: false },
  { name: "Dr. Handajaya Rusli, M.Si.", nip: "198708042014041001", email: "handajaya@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Development of Chromatography-based Analytical Methods", profileUrl: "https://www.chem.itb.ac.id/handajaya-rusli/", nipMissing: false },
  { name: "Dr. Muhammad Iqbal, M. Si.", nip: "198312182015041001", email: "m.iqbal@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Non-Chromatographic Separation", profileUrl: "https://www.chem.itb.ac.id/muhammad-iqbal-2/", nipMissing: false },
  { name: "Dra. Samitha Dewi Djajanti", nip: "196009031989032001", email: "samitha@itb.ac.id", researchGroup: "KK Kimia Analitik", researchTopic: "Functional Materials for Analytical Separation", profileUrl: "https://www.chem.itb.ac.id/samitha-dewi-djajanti/", nipMissing: false },
  { name: "Prof. Djulia Onggo, Ph.D.", nip: "195509301976032001", email: "djulia@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Coordination Chemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/djulia-onggo/", nipMissing: false },
  { name: "Prof. Dr. Veinardi Suendo", nip: null, email: "vsuendo@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Nanostructured Materials for Optoelectronics and Photoelectrochemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/veinardi-suendo", nipMissing: true },
  { name: "M Abdulkadir Martoprawiro, Ph. D", nip: null, email: "muhamad@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Computational Chemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/muhamad-abdulkadir-martoprawiro/", nipMissing: true },
  { name: "Dr. Bambang Prijamboedi, M.Eng.", nip: "196812182006041010", email: "prijamboedi@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Application of Oxide Materials", profileUrl: "https://www.chem.itb.ac.id/dosen/bambang-prijamboedi/", nipMissing: false },
  { name: "Dr. Irma Mulyani", nip: "197108061998022001", email: "irma@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Bio-inorganics", profileUrl: "https://www.chem.itb.ac.id/dosen/irma-mulyani/", nipMissing: false },
  { name: "Dr. rer. nat. Rino Rakhmata Mukti", nip: "197704252009121001", email: "rino.mukti@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Porous Nanomaterials", profileUrl: "https://www.chem.itb.ac.id/dosen/rino-rakhmata-mukti/", nipMissing: false },
  { name: "Dr. Dewi Agustiningsih, S.Si.", nip: null, email: "dewi.agustiningsih@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Synthesis, characterization, and utilization of inorganic materials-based catalysts for pollutant remediation", profileUrl: "https://www.chem.itb.ac.id/dosen/dewi-agustiningsih", nipMissing: true },
  { name: "Ainul Maghfirah S.Si., M.Si., Ph.D. Eng.", nip: null, email: "ainulmaghfirah@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Material design for metal recovery", profileUrl: "https://www.chem.itb.ac.id/dosen/ainul-maghfirah", nipMissing: true },
  { name: "Prof. Dr. I Made Arcana", nip: null, email: "arcana@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Biodegradable Polymers", profileUrl: "https://www.chem.itb.ac.id/dosen/i-made-arcana", nipMissing: true },
  { name: "Dr. Eng. Yessi Permana", nip: "197511292008121002", email: "yessi@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Catalysis, Heterogeneous, and Homogeneous Catalysts", profileUrl: "https://www.chem.itb.ac.id/dosen/yessi-permana/", nipMissing: false },
  { name: "Aep Patah, Ph.D.", nip: "197912142008121002", email: "aep@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Coordination Polymer Materials and Electrochemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/aep-patah-ph-d", nipMissing: false },
  { name: "Fainan Failamani, Ph.D.", nip: null, email: "fainan.failamani@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Phase Equilibria, Crystal Structure, and Physical Properties of Solids", profileUrl: "https://www.chem.itb.ac.id/dosen/fainan-failamani", nipMissing: true },
  { name: "Abdul Rohman S., M.Si., M.Eng., Ph.D.", nip: "199002132024061002", email: "abdulrohman.s@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Nanostructured metal oxide-based materials for catalysis, electrochemical energy systems, and sensor", profileUrl: "https://chem.itb.ac.id/dosen/abdul-rohman-supandi/", nipMissing: false },
  { name: "Achmad Rocliadi, M. S, Ph.D.", nip: null, email: "achmad@chem.itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Electrochemistry and Corrosion", profileUrl: "https://www.chem.itb.ac.id/dosen/achmad-rochliadi/", nipMissing: true },
  { name: "Mia Ledyastuti, S.Si., M. Si., Ph.D.", nip: null, email: "mia.ledyastuti@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Molecular Dynamics and Polymer Chemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/mia-ledyastuti", nipMissing: true },
  { name: "Dr. Grandprix Thomryes Marth Kadja", nip: "199303312018031001", email: "grandprix.thomryes@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Nanomaterials for Catalysis, Adsorption, and Molecular Separation", profileUrl: "https://www.chem.itb.ac.id/dosen/dr-grandprix-thomryes-m", nipMissing: false },
  { name: "Dr. Rachmawati", nip: null, email: "rachmawati@itb.ac.id", researchGroup: "KK Kimia Fisik", researchTopic: "Polymer Chemistry", profileUrl: "https://www.chem.itb.ac.id/dosen/rachmawati", nipMissing: true },
  { name: "Dr. Erna Febriyanti", nip: null, email: "efebriyanti122@itb.ac.id", researchGroup: "KK Kimia Anorganik", researchTopic: "Nanomaterials", profileUrl: "https://www.chem.itb.ac.id/dosen/erna-febriyanti", nipMissing: true },
  { name: "Prof. Dr. Deana Wahyuningrum", nip: "197509121999032002", email: "deana@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Organic Synthesis", profileUrl: "https://www.chem.itb.ac.id/dosen/dr-deana-wahyuningrum-s-si-m-si/", nipMissing: false },
  { name: "Dr. Robby Roswanda", nip: "198406122014041001", email: "r.roswanda@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Organic Chemistry and Materials", profileUrl: "https://www.chem.itb.ac.id/dosen/robby-roswanda/", nipMissing: false },
  { name: "Dr.Rizki Fitriani, M. Si", nip: "199205022024062001", email: "rizkif@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Chemistry of Natural Products", profileUrl: "https://www.chem.itb.ac.id/dosen/rizki-fitriani-2/", nipMissing: false },
  { name: "Ade Danova, Ph.D.", nip: null, email: "adedanova@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Molecular Editing of Bioactive Compounds", profileUrl: "https://www.chem.itb.ac.id/dosen/ade-danova", nipMissing: true },
  { name: "Prof. Dr. Lia Dewi Djuliawaty", nip: "196707011992032002", email: "liadewi@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Chemistry of Natural Products", profileUrl: "https://www.chem.itb.ac.id/dosen/lia-dewi-juliawaty/", nipMissing: false },
  { name: "Anita Alni, Ph.D.", nip: "198301052012122003", email: "alni@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Organic Synthesis", profileUrl: "https://www.chem.itb.ac.id/dosen/anita-alni/", nipMissing: false },
  { name: "Dr. Dikhi Firmansyah", nip: "198605042019031011", email: "dikhfi@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Chemistry of Functional Dyes", profileUrl: "https://www.chem.itb.ac.id/dosen/dikhi-firmansyah/", nipMissing: false },
  { name: "Edwin Risky Sukandar, Ph.D.", nip: null, email: "esukandar@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Natural Product Chemsitry and Organic Spectroscopy", profileUrl: "https://www.chem.itb.ac.id/dosen/edwin-risky-sukandar", nipMissing: true },
  { name: "Dr. rer. nat. Didin Mujahidin", nip: "197207091998031003", email: "d.mujahidin@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Organic Synthesis", profileUrl: "https://www.chem.itb.ac.id/dosen/didin-mujahidin/", nipMissing: false },
  { name: "Dr. rer. nat. Nizar Happyana", nip: "198401012010121006", email: "nizar105@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Metabolomics", profileUrl: "https://www.chem.itb.ac.id/dosen/nizar-happyana/", nipMissing: false },
  { name: "Dr. Elvira Hermawati, M. Si.", nip: "198703082015042003", email: "elvira.hermawati@itb.ac.id", researchGroup: "KK Kimia Organik", researchTopic: "Chemistry of Natural Products", profileUrl: "https://www.chem.itb.ac.id/dosen/elvira-hermawati/", nipMissing: false },
  { name: "Prof. Dr. Enny Ratnaningsih", nip: "195809011984032003", email: "enny@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Molecular Biotechnology", profileUrl: "https://www.chem.itb.ac.id/enny-ratnaningsih/", nipMissing: false },
  { name: "Prof. Fida Madayanti Warganegara", nip: null, email: "fida@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Food Chemistry and Enzymology", profileUrl: "https://www.chem.itb.ac.id/dosen/fida-madayanti-warganegara", nipMissing: true },
  { name: "Prof. Akhmaloka, Ph.D.", nip: null, email: "loka@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Biochemistry of Thermophilic Bacteria and Enzymology", profileUrl: "https://www.chem.itb.ac.id/dosen/akhmaloka", nipMissing: true },
  { name: "Dr. Ihsanawati", nip: "197106122010122001", email: "ihsanawati@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Protein Structure and Engineering", profileUrl: "https://www.chem.itb.ac.id/ihsanawati/", nipMissing: false },
  { name: "Dr. Made Puspasari Widhiastuti", nip: null, email: "puspasari@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Enzymology", profileUrl: "https://www.chem.itb.ac.id/dosen/made-puspasari", nipMissing: true },
  { name: "Rindia Maharani Putri, Ph.D", nip: "199105282020122002", email: "rindia.m.putri@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Biomaterials and Bionanotechnology", profileUrl: "https://www.chem.itb.ac.id/rindia-maharani-putri/", nipMissing: false },
  { name: "Prof. Zeily Nurachman, D.Sc.", nip: null, email: "zeily@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Biochemistry of Microalgae", profileUrl: "https://www.chem.itb.ac.id/dosen/zeily-nurachman", nipMissing: true },
  { name: "Prof. Dr. Rukman Hertadi", nip: "197305231997021001", email: "rhertadi@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Biophysics and Computational Biochemistry", profileUrl: "https://www.chem.itb.ac.id/rukman-hertadi/", nipMissing: false },
  { name: "Dr.rer.nat. Fifi Fitriyah Masduki", nip: "197709091010122001", email: "fifimasduki@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Medical Biotechnology", profileUrl: "https://www.chem.itb.ac.id/fifi-fitriyah-masduki/", nipMissing: false },
  { name: "Alfredo Kono, Ph.D", nip: null, email: "akono@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Bioengineering of Microalage", profileUrl: "https://www.chem.itb.ac.id/dosen/alfredo-kono", nipMissing: true },
  { name: "Prof. Dessy Natalia, Ph.D.", nip: "196708191990092001", email: "dessynatalia@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Enzymology and Molecular Biotechnology", profileUrl: "https://www.chem.itb.ac.id/dessy-natalia/", nipMissing: false },
  { name: "Dr. Yanti Rachmayanti", nip: null, email: "rachmayanti@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Plant Transcriptomics and Genetic Engineering", profileUrl: "https://www.chem.itb.ac.id/dosen/yanti-rachmayanti", nipMissing: true },
  { name: "Dr. Reza Aditama", nip: "198607172015041002", email: "rzaditama@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Computational Biochemistry", profileUrl: "https://www.chem.itb.ac.id/reza-aditama/", nipMissing: false },
  { name: "Dr. Wiwit Nurhidayah", nip: "199804022024062001", email: "wiwit.nurhidayah@itb.ac.id", researchGroup: "KK Kimia Biokimia", researchTopic: "Biomedicine", profileUrl: "https://www.chem.itb.ac.id/wiwit-nurhidayah/", nipMissing: false },
];

/** Rows whose NIP is published and therefore safe to sign a document. */
export const SUPERVISORS_WITH_NIP = SUPERVISORS.filter((s) => s.nip !== null);

/** Rows the source page carries without a NIP. Require an admin to fill in. */
export const SUPERVISORS_MISSING_NIP = SUPERVISORS.filter((s) => s.nip === null);
