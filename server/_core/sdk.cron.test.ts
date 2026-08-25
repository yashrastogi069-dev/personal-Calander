import { afterEach, describe, expect, it, vi } from "vitest";
import { sdk } from "./sdk";

describe("scheduled callback authentication", () => {
  afterEach(() => vi.restoreAllMocks());

  it("resolves a platform-issued raw cron cookie before local browser-session verification", async () => {
    vi.spyOn(sdk, "verifySession").mockResolvedValue(null);
    const lookup = vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue({
      openId: "cron_project_reminder_sweep",
      projectId: "project-1",
      name: "Personal Calander reminder sweep",
      taskUid: "task-uid-1",
    });

    await expect(sdk.authenticateRequest({ headers: { cookie: "app_session_id=platform-issued-raw-cron-token" } })).resolves.toMatchObject({
      isCron: true,
      taskUid: "task-uid-1",
      openId: "cron_project_reminder_sweep",
    });
    expect(lookup).toHaveBeenCalledWith("platform-issued-raw-cron-token");
  });
});
