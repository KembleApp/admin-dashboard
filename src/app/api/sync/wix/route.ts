import { syncWix } from "@/lib/sync/wix";
import { runSyncRoute } from "@/lib/sync/runSyncRoute";

export const maxDuration = 300;

export async function POST() {
  return runSyncRoute("wix", syncWix);
}
