const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env");
const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/environmentgpt?schema=public";

function parseEnvFile(contents) {
  const parsed = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    parsed[line.slice(0, separatorIndex).trim()] = line.slice(separatorIndex + 1).trim();
  }

  return parsed;
}

function ensureDotEnv() {
  const exists = fs.existsSync(envPath);
  const contents = exists ? fs.readFileSync(envPath, "utf8") : "";
  const env = parseEnvFile(contents);

  if (Object.prototype.hasOwnProperty.call(env, "DATABASE_URL")) {
    return env.DATABASE_URL;
  }

  const header = "# Auto-generated local development defaults for Prisma.\n";
  const prefix = exists ? `${contents}${contents.endsWith("\n") ? "" : "\n"}` : header;
  fs.writeFileSync(envPath, `${prefix}DATABASE_URL=${defaultDatabaseUrl}\n`, "utf8");

  return defaultDatabaseUrl;
}

function assertPostgresDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (databaseUrl.startsWith("file:")) {
    throw new Error(
      "SQLite DATABASE_URL detected. Update DATABASE_URL to PostgreSQL, for example postgresql://postgres:postgres@127.0.0.1:5432/environmentgpt?schema=public.",
    );
  }
}

function main() {
  const databaseUrl = process.env.DATABASE_URL || ensureDotEnv();
  assertPostgresDatabaseUrl(databaseUrl);
  console.log(`Using PostgreSQL DATABASE_URL=${databaseUrl}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
