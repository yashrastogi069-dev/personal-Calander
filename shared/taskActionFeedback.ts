export function taskActionRecoveryMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "This task could not be moved. The board was restored; try again.";
}
