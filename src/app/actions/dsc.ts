"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { DscExperimentSummary, DscExperimentWithPeaks } from "@/components/dsc/types";

export const dscPeakSchema = z.object({
  cycleIndex: z.number(),
  peakType: z.enum(["exothermic", "endothermic"]),
  onsetTempC: z.number(),
  onsetTimeH: z.number(),
  offsetTempC: z.number(),
  offsetTimeH: z.number(),
  peakMaxTempC: z.number(),
  peakMaxTimeH: z.number(),
  peakHeightMw: z.number(),
  heatJPerG: z.number(),
  label: z.string().optional(),
  isManual: z.boolean().default(false),
});

export const saveDscExperimentSchema = z.object({
  filename: z.string(),
  sampleName: z.string(),
  massMg: z.number(),
  molarMass: z.number().nullable().optional(),
  atmosphere: z.string().nullable().optional(),
  operatorName: z.string().nullable().optional(),
  procedureName: z.string().nullable().optional(),
  recordedAt: z.union([z.string(), z.date()]).nullable().optional(),
  peaks: z.array(dscPeakSchema),
});

export type DscActionResult<T = undefined> =
  | { success: true; message: string; data: T }
  | { success: false; message: string; data?: never };

export type SaveExperimentResult = {
  experimentId: string;
};

export type DscPeakInput = z.infer<typeof dscPeakSchema>;
export type SaveDscExperimentInput = z.infer<typeof saveDscExperimentSchema>;

export async function saveExperiment(data: SaveDscExperimentInput): Promise<DscActionResult<SaveExperimentResult>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };

    const parsed = saveDscExperimentSchema.safeParse(data);
    if (!parsed.success) return { success: false, message: "Invalid data format" };

    const exp = await prisma.dscExperiment.create({
      data: {
        userId: session.user.id,
        filename: parsed.data.filename,
        sampleName: parsed.data.sampleName,
        massMg: parsed.data.massMg,
        molarMass: parsed.data.molarMass ?? null,
        atmosphere: parsed.data.atmosphere ?? null,
        operatorName: parsed.data.operatorName ?? null,
        procedureName: parsed.data.procedureName ?? null,
        recordedAt: parsed.data.recordedAt ? new Date(parsed.data.recordedAt) : null,
        peaks: {
          create: parsed.data.peaks.map((p) => ({
            cycleIndex: p.cycleIndex,
            peakType: p.peakType,
            onsetTempC: p.onsetTempC,
            onsetTimeH: p.onsetTimeH,
            offsetTempC: p.offsetTempC,
            offsetTimeH: p.offsetTimeH,
            peakMaxTempC: p.peakMaxTempC,
            peakMaxTimeH: p.peakMaxTimeH,
            peakHeightMw: p.peakHeightMw,
            heatJPerG: p.heatJPerG,
            label: p.label,
            isManual: p.isManual,
          })),
        },
      },
    });

    revalidatePath("/dsc");

    return { success: true, message: "Experiment saved successfully", data: { experimentId: exp.id } };
  } catch (error) {
    console.error("Save experiment error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function listExperiments(): Promise<DscActionResult<DscExperimentSummary[]>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };

    const experiments = await prisma.dscExperiment.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { peaks: true }
        }
      }
    });

    return { success: true, message: "Fetched experiments", data: experiments };
  } catch (error) {
    console.error("List experiments error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function getExperiment(id: string): Promise<DscActionResult<DscExperimentWithPeaks>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };

    const experiment = await prisma.dscExperiment.findUnique({
      where: { id },
      include: { peaks: true },
    });

    if (!experiment) return { success: false, message: "Experiment not found" };

    // Users can only view their own experiments, admins can view all
    if (experiment.userId !== session.user.id && !session.user.roles.includes("ADMIN")) {
      return { success: false, message: "Unauthorized access" };
    }

    return { success: true, message: "Fetched experiment", data: experiment };
  } catch (error) {
    console.error("Get experiment error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function deleteExperiment(id: string): Promise<DscActionResult<undefined>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };

    const experiment = await prisma.dscExperiment.findUnique({
      where: { id },
    });

    if (!experiment) return { success: false, message: "Experiment not found" };

    if (experiment.userId !== session.user.id && !session.user.roles.includes("ADMIN")) {
      return { success: false, message: "Unauthorized access" };
    }

    await prisma.dscExperiment.delete({
      where: { id },
    });

    revalidatePath("/dsc");

    return { success: true, message: "Experiment deleted successfully", data: undefined };
  } catch (error) {
    console.error("Delete experiment error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}

export async function updatePeaks(experimentId: string, peaks: DscPeakInput[]): Promise<DscActionResult<undefined>> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, message: "You must be logged in" };

    const experiment = await prisma.dscExperiment.findUnique({
      where: { id: experimentId },
    });

    if (!experiment) return { success: false, message: "Experiment not found" };

    if (experiment.userId !== session.user.id && !session.user.roles.includes("ADMIN")) {
      return { success: false, message: "Unauthorized access" };
    }

    const parsedPeaks = z.array(dscPeakSchema).safeParse(peaks);
    if (!parsedPeaks.success) return { success: false, message: "Invalid peak data" };

    // Transaction to replace all peaks
    await prisma.$transaction([
      prisma.dscPeak.deleteMany({
        where: { experimentId },
      }),
      prisma.dscPeak.createMany({
        data: parsedPeaks.data.map((p) => ({
          experimentId,
          cycleIndex: p.cycleIndex,
          peakType: p.peakType,
          onsetTempC: p.onsetTempC,
          onsetTimeH: p.onsetTimeH,
          offsetTempC: p.offsetTempC,
          offsetTimeH: p.offsetTimeH,
          peakMaxTempC: p.peakMaxTempC,
          peakMaxTimeH: p.peakMaxTimeH,
          peakHeightMw: p.peakHeightMw,
          heatJPerG: p.heatJPerG,
          label: p.label,
          isManual: p.isManual,
        })),
      }),
    ]);

    revalidatePath("/dsc");
    revalidatePath(`/dsc/${experimentId}`);

    return { success: true, message: "Peaks updated successfully", data: undefined };
  } catch (error) {
    console.error("Update peaks error:", error);
    return { success: false, message: "An unexpected error occurred" };
  }
}
