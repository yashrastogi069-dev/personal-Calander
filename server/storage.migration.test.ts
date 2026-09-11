import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("creates private storage retry-safely and limits authenticated object access to the owner folder", async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'SELECT current_setting(''request.jwt.claim.sub'', true)::uuid';
      CREATE TABLE public.users (id integer PRIMARY KEY);
      CREATE TABLE public.workspaces (id varchar(64) PRIMARY KEY);
      CREATE SCHEMA storage;
      CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      CREATE TABLE storage.objects (id serial PRIMARY KEY, bucket_id text, name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA storage, auth TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
      GRANT USAGE ON SEQUENCE storage.objects_id_seq TO authenticated;`);
    const sql = readFileSync(new URL("../supabase/migrations/0002_private_planner_files.sql", import.meta.url), "utf8");
    await db.exec(sql); await db.exec(sql);
    expect((await db.query("SELECT public, file_size_limit FROM storage.buckets")).rows).toEqual([{ public: false, file_size_limit: 20971520 }]);
    expect((await db.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname = 'storage'")).rows).toEqual([{ count: 4 }]);
    expect((await db.query("SELECT relrowsecurity FROM pg_class WHERE relname = 'plannerFiles'")).rows).toEqual([{ relrowsecurity: true }]);
    await db.exec(`INSERT INTO storage.objects (bucket_id, name) VALUES
      ('planner-files', '11111111-1111-4111-8111-111111111111/workspace/file.pdf'),
      ('planner-files', '22222222-2222-4222-8222-222222222222/workspace/file.pdf'),
      ('another-bucket', '11111111-1111-4111-8111-111111111111/file.pdf');
      SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', false);`);
    expect((await db.query("SELECT count(*)::int AS count FROM storage.objects")).rows).toEqual([{ count: 1 }]);
    await expect(db.exec("INSERT INTO storage.objects (bucket_id, name) VALUES ('planner-files', '22222222-2222-4222-8222-222222222222/stolen.pdf')")).rejects.toThrow(/row-level security/);
    await expect(db.exec("UPDATE storage.objects SET name = '22222222-2222-4222-8222-222222222222/stolen.pdf' WHERE id = 1")).rejects.toThrow(/row-level security/);
    await db.exec("DELETE FROM storage.objects WHERE id = 2");
    await db.exec("RESET ROLE");
    expect((await db.query("SELECT count(*)::int AS count FROM storage.objects")).rows).toEqual([{ count: 3 }]);
  } finally { await db.close(); }
}, 30_000);
