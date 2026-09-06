export default function reminder(_req: unknown, res: { status: (code: number) => { json: (body: unknown) => void } }) {
  res.status(503).json({
    error: "scheduled-reminders-not-configured",
    message: "Configure a user-owned scheduler before enabling reminder delivery.",
  });
}
