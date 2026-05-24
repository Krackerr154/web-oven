"use client";

import { useParams } from "next/navigation";
import { DscAnalysisClient } from "@/components/dsc/DscAnalysisClient";

export default function DscExperimentPage() {
  const params = useParams<{ experimentId: string }>();
  return <DscAnalysisClient experimentId={params.experimentId} />;
}
