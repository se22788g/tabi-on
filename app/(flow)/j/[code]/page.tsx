import { Join } from "../Join";

export default async function Page({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <Join code={decodeURIComponent(code)} />;
}
