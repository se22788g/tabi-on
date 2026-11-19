import { Question } from "./Question";

export default async function Page({ params }: { params: Promise<{ tripId: string; step: string }> }) {
  const { tripId, step } = await params;
  return <Question tripId={tripId} step={Number(step)} />;
}
