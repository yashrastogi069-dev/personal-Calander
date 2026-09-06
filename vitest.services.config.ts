import "dotenv/config";
import { defineConfig } from "vitest/config";

// Explicitly opt into real service access; these tests never belong to the offline suite.
export default defineConfig({
  test: {
    environment: "node",
    include: ["server/supabase.credentials.test.ts", "server/supabase.database.test.ts"],
    testTimeout: 20_000,
  },
});
