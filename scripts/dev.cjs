const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const backendDir = path.join(repoRoot, "backend");
const frontendDir = path.join(repoRoot, "frontend");
const nodeCommand = process.execPath;
const args = new Set(process.argv.slice(2));
const prismaCli = path.join(repoRoot, "node_modules", "prisma", "build", "index.js");
const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:5432/environmentgpt?schema=public";

const envFiles = [
  {
    path: path.join(repoRoot, ".env"),
    header: "# Auto-generated local development defaults for Prisma.\n",
    entries: {
      DATABASE_URL: defaultDatabaseUrl,
    },
  },
  {
    path: path.join(repoRoot, ".env.local"),
    header: "# Auto-generated local development defaults for Next.js.\n",
    entries: {
      NEXTAUTH_URL: "http://localhost:3000",
      NEXTAUTH_SECRET: "dev-secret-change-me",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
];

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

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function appendMissingEnvValues(fileConfig) {
  const exists = fs.existsSync(fileConfig.path);
  const currentContents = exists ? fs.readFileSync(fileConfig.path, "utf8") : "";
  const currentEnv = parseEnvFile(currentContents);
  const missingEntries = Object.entries(fileConfig.entries).filter(
    ([key]) => !Object.prototype.hasOwnProperty.call(currentEnv, key),
  );

  if (missingEntries.length === 0) {
    return parseEnvFile(currentContents);
  }

  let nextContents = currentContents;
  if (!exists) {
    nextContents = fileConfig.header;
  }

  if (nextContents.length > 0 && !nextContents.endsWith("\n")) {
    nextContents += "\n";
  }

  for (const [key, value] of missingEntries) {
    nextContents += `${key}=${value}\n`;
  }

  fs.writeFileSync(fileConfig.path, nextContents, "utf8");

  return {
    ...currentEnv,
    ...Object.fromEntries(missingEntries),
  };
}

function buildDevEnv() {
  const loadedByFile = envFiles.map((fileConfig) => ({
    config: fileConfig,
    env: appendMissingEnvValues(fileConfig),
  }));

  const envFromFiles = loadedByFile.reduce((acc, entry) => {
    return { ...acc, ...entry.env };
  }, {});

  const rootEnv = loadedByFile.find((entry) => entry.config.path.endsWith(".env"))?.env ?? {};
  const resolvedDatabaseUrl =
    typeof envFromFiles.DATABASE_URL === "string" && envFromFiles.DATABASE_URL.startsWith("file:")
      ? rootEnv.DATABASE_URL || envFromFiles.DATABASE_URL
      : envFromFiles.DATABASE_URL;
  const processDatabaseUrl = process.env.DATABASE_URL;
  const finalDatabaseUrl =
    typeof processDatabaseUrl === "string" && !processDatabaseUrl.startsWith("file:")
      ? processDatabaseUrl
      : resolvedDatabaseUrl;

  return {
    ...process.env,
    ...envFromFiles,
    DATABASE_URL: finalDatabaseUrl,
    NODE_ENV: "development",
  };
}

function assertPostgresDatabaseUrl(databaseUrl) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (databaseUrl.startsWith("file:")) {
    throw new Error(
      "SQLite DATABASE_URL detected. Set DATABASE_URL to PostgreSQL, for example postgresql://postgres:postgres@127.0.0.1:5432/environmentgpt?schema=public.",
    );
  }
}

function runStep(command, commandArgs, env, cwd = repoRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${commandArgs.join(" ")} exited with code ${code}`));
    });
  });
}

async function main() {
  const env = buildDevEnv();

  console.log("Local env ready.");
  console.log(`DATABASE_URL=${env.DATABASE_URL}`);
  console.log(`NEXTAUTH_URL=${env.NEXTAUTH_URL}`);

  if (!fs.existsSync(prismaCli) || !fs.existsSync(nextCli)) {
    throw new Error("Dependencies are missing. Run `npm install` before `npm run dev`.");
  }

  assertPostgresDatabaseUrl(env.DATABASE_URL);
  await runStep(nodeCommand, [prismaCli, "generate"], env, backendDir);
  try {
    await runStep(nodeCommand, [prismaCli, "db", "push", "--skip-generate"], env, backendDir);
  } catch (error) {
    throw new Error(
      "Failed to sync PostgreSQL schema. Start Postgres with `npm run db:up` or point DATABASE_URL at a running PostgreSQL instance.",
    );
  }

  if (args.has("--setup-only")) {
    console.log("PostgreSQL schema setup complete.");
    return;
  }

  console.log("Starting backend (port 3001) and frontend (port 3000)...");

  const backendEnv = { ...env };
  const frontendEnv = { ...env, BACKEND_URL: "http://localhost:3001" };

  const backendProcess = spawn(nodeCommand, [nextCli, "dev", "--webpack", "-p", "3001"], {
    cwd: backendDir,
    env: backendEnv,
    stdio: "inherit",
  });

  const frontendProcess = spawn(nodeCommand, [nextCli, "dev", "--webpack", "-p", "3000"], {
    cwd: frontendDir,
    env: frontendEnv,
    stdio: "inherit",
  });

  let exiting = false;

  function shutdown(signal) {
    if (exiting) return;
    exiting = true;
    console.log(`\nReceived ${signal}, shutting down...`);
    backendProcess.kill(signal);
    frontendProcess.kill(signal);
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  const backendExit = new Promise((resolve, reject) => {
    backendProcess.on("error", reject);
    backendProcess.on("exit", (code) => {
      if (code !== 0 && !exiting) {
        reject(new Error(`Backend process exited with code ${code}`));
      } else {
        resolve(code);
      }
    });
  });

  const frontendExit = new Promise((resolve, reject) => {
    frontendProcess.on("error", reject);
    frontendProcess.on("exit", (code) => {
      if (code !== 0 && !exiting) {
        reject(new Error(`Frontend process exited with code ${code}`));
      } else {
        resolve(code);
      }
    });
  });

  await Promise.all([backendExit, frontendExit]);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
