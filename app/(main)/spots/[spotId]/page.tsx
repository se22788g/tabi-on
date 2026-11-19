import { SpotDetail } from "./SpotDetail";

// ログインしていなくても開ける（友だちに送ったリンクの行き先）。場所の情報は公開データ。
export default async function Page({ params }: { params: Promise<{ spotId: string }> }) {
  const { spotId } = await params;
  return <SpotDetail spotId={spotId} />;
}
