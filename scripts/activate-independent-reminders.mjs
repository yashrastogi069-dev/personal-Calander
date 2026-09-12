import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const expectedProjectRef = "dwiudauuuxzstbavkkqa";
const appOrigin = "https://personal-calander.vercel.app";
const endpoint = `${appOrigin}/api/scheduled/reminder`;
const activateScheduler = process.argv.includes("--activate");
const npxCli = process.platform === "win32"
  ? join(dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js")
  : null;

function runVercel(args, input) {
  const command = npxCli ? process.execPath : "npx";
  const commandArgs = npxCli ? [npxCli, "--yes", "vercel", ...args] : ["--yes", "vercel", ...args];
  const result = spawnSync(command, commandArgs, {
    cwd: process.cwd(),
    encoding: "utf8",
    input: input === undefined ? undefined : `${input}\n`,
    stdio: input === undefined ? ["ignore", "pipe", "pipe"] : ["pipe", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Vercel ${args.slice(0, 3).join(" ")} failed: ${result.stderr || result.stdout}`);
  return result.stdout;
}

function updateEnvironment(name, environment, value) {
  if (!/^[A-Z][A-Z0-9_]+$/.test(name) || !["production", "preview"].includes(environment)) {
    throw new Error("Refusing an unexpected Vercel environment target.");
  }
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", `$input | & npx --yes vercel env update '${name}' '${environment}' --yes`],
    { cwd: process.cwd(), encoding: "utf8", input: `${value}\n`, stdio: ["pipe", "pipe", "pipe"] },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Vercel env update ${name} failed: ${result.stderr || result.stdout}`);
}

function requireValue(environment, name) {
  const value = environment[name];
  if (!value) throw new Error(`${name} is missing after Vercel configuration.`);
  return value;
}

function plannerCounts(row) {
  return {
    workspaces: Number(row.workspaces),
    tasks: Number(row.tasks),
    goals: Number(row.goals),
    projects: Number(row.projects),
    habits: Number(row.habits),
  };
}

async function main() {
  const localEnvironment = dotenv.parse(readFileSync(".env"));
  const databaseUrl = requireValue(localEnvironment, "SUPABASE_DB_URL");
  const parsedUrl = new URL(databaseUrl);
  const directProject = parsedUrl.hostname === `db.${expectedProjectRef}.supabase.co`;
  const approvedPooler = parsedUrl.hostname.endsWith(".pooler.supabase.com")
    && decodeURIComponent(parsedUrl.username) === `postgres.${expectedProjectRef}`;
  if (!directProject && !approvedPooler) {
    throw new Error(`Refusing unexpected database host ${parsedUrl.hostname}.`);
  }
  for (const name of ["VITE_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"]) requireValue(localEnvironment, name);

  const client = new pg.Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    const countSql = `select
      (select count(*) from "workspaces") as workspaces,
      (select count(*) from "tasks") as tasks,
      (select count(*) from "goals") as goals,
      (select count(*) from "projects") as projects,
      (select count(*) from "habits") as habits`;
    const before = plannerCounts((await client.query(countSql)).rows[0]);
    const existingSecrets = await client.query(
      "select id, name, decrypted_secret from vault.decrypted_secrets where name = any($1::text[])",
      [["personal_calendar_reminder_url", "personal_calendar_reminder_secret"]],
    );
    const byName = new Map(existingSecrets.rows.map(row => [row.name, row]));
    const existingUrl = byName.get("personal_calendar_reminder_url")?.decrypted_secret;
    if (existingUrl && existingUrl !== endpoint) throw new Error("Vault reminder URL targets a different endpoint; refusing to overwrite it.");
    const exactSecret = byName.get("personal_calendar_reminder_secret")?.decrypted_secret || randomBytes(48).toString("base64url");

    updateEnvironment("APP_ORIGIN", "production", appOrigin);
    updateEnvironment("APP_ORIGIN", "preview", appOrigin);
    updateEnvironment("REMINDER_CRON_SECRET", "production", exactSecret);

    await client.query("begin");
    await client.query("create extension if not exists pg_cron with schema pg_catalog");
    await client.query("create extension if not exists pg_net with schema extensions");

    const expected = new Map([
      ["personal_calendar_reminder_url", endpoint],
      ["personal_calendar_reminder_secret", exactSecret],
    ]);
    for (const [name, value] of expected) {
      const current = byName.get(name);
      if (current && current.decrypted_secret !== value) throw new Error(`Vault ${name} exists with a different value; refusing to overwrite it.`);
      if (!current) await client.query("select vault.create_secret($1, $2, $3)", [value, name, "Personal Calendar scheduled reminder configuration"]);
    }

    const oldJobs = await client.query("select jobid from cron.job where jobname = 'personal-calendar-reminder-sweep'");
    for (const row of oldJobs.rows) await client.query("select cron.unschedule($1::bigint)", [row.jobid]);
    const scheduled = await client.query(`select cron.schedule('personal-calendar-reminder-sweep', '*/5 * * * *', $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'personal_calendar_reminder_url'),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
          'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'personal_calendar_reminder_secret')),
        body := '{}'::jsonb,
        timeout_milliseconds := 55000
      );
    $job$)`);
    if (!activateScheduler) {
      await client.query("select cron.alter_job(job_id := $1::bigint, active := false)", [scheduled.rows[0].schedule]);
    }
    await client.query("commit");

    const after = plannerCounts((await client.query(countSql)).rows[0]);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("Planner row counts changed during reminder activation.");
    const postflight = (await client.query(`select
      exists(select 1 from pg_extension where extname='pg_cron') as pg_cron,
      exists(select 1 from pg_extension where extname='pg_net') as pg_net,
      (select count(*)::int from vault.secrets where name in ('personal_calendar_reminder_url','personal_calendar_reminder_secret')) as vault_names,
      (select count(*)::int from cron.job where jobname='personal-calendar-reminder-sweep') as cron_jobs,
      (select bool_and(active) from cron.job where jobname='personal-calendar-reminder-sweep') as scheduler_active`)).rows[0];
    console.log(JSON.stringify({ configured: true, activateScheduler, projectRef: expectedProjectRef, plannerCounts: after, postflight }));
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

await main();
