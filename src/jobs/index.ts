import { startExpiryJob } from "./expiry.job";
import { startInactiveUsersJob } from "./inactiveUsers.job";

/**
 * Starts all background jobs.
 */
export function startAllJobs(): void {
    startExpiryJob();
    startInactiveUsersJob();
}
