import { describe, expect, it } from "vitest";
import { getReminderDevicePresentation } from "./reminderDevicePresentation";

describe("getReminderDevicePresentation", () => {
  it("keeps the exact-device disconnect action visible when a current subscription is active", () => {
    expect(getReminderDevicePresentation("granted", true)).toMatchObject({
      action: "disconnect",
      actionLabel: "Disconnect this iPhone",
      isBlocked: false,
    });
  });

  it("offers a visible reconnect action when no current subscription is found", () => {
    expect(getReminderDevicePresentation("granted", false)).toMatchObject({
      action: "connect",
      actionLabel: "Connect this iPhone",
      isBlocked: false,
    });
  });

  it("explains blocked and unsupported states without hiding the device-management context", () => {
    expect(getReminderDevicePresentation("denied", false)).toMatchObject({ actionLabel: "Permission blocked", isBlocked: true });
    expect(getReminderDevicePresentation("unsupported", false)).toMatchObject({ actionLabel: "Open the Home Screen app", isBlocked: true });
  });
});
