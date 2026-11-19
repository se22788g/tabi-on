import { Plan } from "./Plan";

export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <Plan tripId={tripId} />;
}
