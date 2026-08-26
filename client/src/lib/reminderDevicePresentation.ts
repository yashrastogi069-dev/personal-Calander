export type ReminderPermissionState = "granted" | "denied" | "default" | "unsupported";

export type ReminderDevicePresentation = {
  status: string;
  actionLabel: string;
  action: "connect" | "disconnect";
  isBlocked: boolean;
};

export function getReminderDevicePresentation(
  permission: ReminderPermissionState,
  hasCurrentDevice: boolean
): ReminderDevicePresentation {
  if (hasCurrentDevice) {
    return {
      status: "Connected to this iPhone.",
      actionLabel: "Disconnect this iPhone",
      action: "disconnect",
      isBlocked: false,
    };
  }

  if (permission === "denied") {
    return {
      status: "Notifications are blocked in iPhone Settings.",
      actionLabel: "Permission blocked",
      action: "connect",
      isBlocked: true,
    };
  }

  if (permission === "unsupported") {
    return {
      status: "Open Personal Calendar from its Home Screen icon.",
      actionLabel: "Open the Home Screen app",
      action: "connect",
      isBlocked: true,
    };
  }

  return {
    status: "Not connected to this iPhone.",
    actionLabel: "Connect this iPhone",
    action: "connect",
    isBlocked: false,
  };
}
