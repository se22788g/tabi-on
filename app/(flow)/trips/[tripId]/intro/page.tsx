import { Intro } from "./Intro";

export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <Intro tripId={tripId} />;
}
