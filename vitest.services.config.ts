import "dotenv/config";
import { defineConfig } from "vitest/config";

// Live cases are skipped by the normal offline configuration and enabled here only.
export default defineConfig({
  test: {
    environment: "node",
    include: ["server/supabase.credentials.test.ts", "server/supabase.database.test.ts"],
    testTimeout: 20_000,
    env: { RUN_SUPABASE_SERVICE_TESTS: "1" },
  },
});
