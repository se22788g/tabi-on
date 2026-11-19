import { Plus } from "lucide-react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { TripList } from "./TripList";

export default function Page() {
  return (
    <>
      <Header
        title="旅"
        right={
          <Link href="/trips/new" className="icon-btn" aria-label="新しい旅">
            <Plus size={22} strokeWidth={2} />
          </Link>
        }
      />
      <TripList />
    </>
  );
}
