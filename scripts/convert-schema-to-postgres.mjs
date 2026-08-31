import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../drizzle/schema.ts", import.meta.url);
let source = await readFile(path, "utf8");

source = source
  .replace('  mysqlEnum,\n  mysqlTable,', '  pgTable,')
  .replace('  int,', '  integer,')
  .replace('  json,', '  jsonb,')
  .replace('} from "drizzle-orm/mysql-core";', '} from "drizzle-orm/pg-core";')
  .replaceAll("mysqlTable", "pgTable")
  .replaceAll("int(", "integer(")
  .replaceAll("json(", "jsonb(")
  .replaceAll(".autoincrement().primaryKey()", ".primaryKey()")
  .replaceAll(".defaultNow().onUpdateNow()", ".defaultNow()")
  .replaceAll("mysqlEnum(", "enumText(");

source = source.replace(
  'import {\n  index,\n  integer,',
  'import {\n  index,\n  integer,'
);

const marker = '} from "drizzle-orm/pg-core";\n';
const helper = `\n// PostgreSQL text-backed enums preserve the existing TypeScript contracts while\n// keeping this first migration additive. Runtime validation remains in the\n// planner procedures; database CHECK constraints can be added after the\n// generated schema has passed the full regression suite.\nconst enumText = (name: string, _values: readonly string[]) => text(name);\n`;
if (!source.includes("const enumText")) source = source.replace(marker, marker + helper);

await writeFile(path, source);
console.log("Converted drizzle/schema.ts to PostgreSQL primitives while preserving table and column names.");
