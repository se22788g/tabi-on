import { notFound } from "next/navigation";
import { SpotDetail } from "./SpotDetail";
import { spotById } from "@/lib/mock/data";

export default async function Page({ params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  const spot = spotById(spotId);
  if (!spot) notFound();
  return <SpotDetail spot={spot} />;
}
