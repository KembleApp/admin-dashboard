import { syncTypeform } from "@/lib/sync/typeform";
import { runSyncRoute } from "@/lib/sync/runSyncRoute";

export const maxDuration = 300;

export async function POST() {
  return runSyncRoute("typeform", syncTypeform);
}
