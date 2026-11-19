import { NewTrip } from "./NewTrip";
import { spotById } from "@/lib/mock/data";

export default async function Page({ searchParams }: { searchParams: Promise<{ seed?: string }> }) {
  const { seed } = await searchParams;
  const spot = seed ? spotById(seed) : undefined;
  return <NewTrip seed={spot ? { id: spot.id, label: `${spot.prefecture.replace(/[県府都]$/, "")}・${spot.area}` } : null} />;
}
