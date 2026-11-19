import { Invite } from "./Invite";

export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <Invite tripId={tripId} />;
}
