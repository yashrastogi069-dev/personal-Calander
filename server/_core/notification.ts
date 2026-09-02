import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

function validatePayload(input: NotificationPayload): NotificationPayload {
  const title = input.title.trim();
  const content = input.content.trim();
  if (!title) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification title is required." });
  }
  if (!content) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Notification content is required." });
  }
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.` });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.` });
  }
  return { title, content };
}

/**
 * Retains the legacy admin procedure contract without a hidden provider call.
 * Planner reminders use the authenticated, user-owned VAPID device path instead.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  validatePayload(payload);
  return false;
}
