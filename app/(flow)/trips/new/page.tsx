import { NewTrip } from "./NewTrip";

export default async function Page({ searchParams }: { searchParams: Promise<{ seed?: string }> }) {
  const { seed } = await searchParams;
  return <NewTrip seedId={seed ?? null} />;
}
