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
      status: "This exact device is connected. Test or disconnect it here; Scheduled rhythm is managed separately below.",
      actionLabel: "Disconnect this device",
      action: "disconnect",
      isBlocked: false,
    };
  }

  if (permission === "denied") {
    return {
      status: "Notification permission is blocked for this app. Re-enable it in iPhone Settings before reconnecting this device.",
      actionLabel: "Permission blocked",
      action: "connect",
      isBlocked: true,
    };
  }

  if (permission === "unsupported") {
    return {
      status: "This browser cannot manage the installed-app reminder connection. Open Personal Calander from its iPhone Home Screen icon.",
      actionLabel: "Open the Home Screen app",
      action: "connect",
      isBlocked: true,
    };
  }

  return {
    status: "This exact device is not connected. Connect or reconnect it here before using scheduled reminders.",
    actionLabel: "Connect this device",
    action: "connect",
    isBlocked: false,
  };
}
