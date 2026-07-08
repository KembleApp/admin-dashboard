import { syncAmplitude } from "@/lib/sync/amplitude";
import { runSyncRoute } from "@/lib/sync/runSyncRoute";

export const maxDuration = 300;

export async function POST() {
  return runSyncRoute("amplitude", syncAmplitude);
}
