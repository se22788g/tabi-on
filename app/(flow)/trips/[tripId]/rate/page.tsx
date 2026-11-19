import { Rate } from "./Rate";

export default async function Page({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <Rate tripId={tripId} />;
}
