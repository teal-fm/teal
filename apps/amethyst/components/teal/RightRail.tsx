import { HeatingRail } from "@/components/today/HeatingUp";
import { useTodayQuery } from "@/lib/teal/queries";

/** The wide-screen rail on pages that have one: what's heating up in your circle today. */
export default function RightRail() {
  const today = useTodayQuery();
  return <HeatingRail moments={today.data?.heatingUp ?? []} />;
}
