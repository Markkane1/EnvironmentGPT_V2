-- Extend LLM provider registry with runtime controls used by the admin-managed
-- provider router and seed the default vLLM fallback chain when no providers exist.

ALTER TABLE "LLMProvider"
ADD COLUMN "timeoutSeconds" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN "maxTokens" INTEGER NOT NULL DEFAULT 1024,
ADD COLUMN "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
ADD COLUMN "notes" TEXT;

UPDATE "LLMProvider"
SET "baseUrl" = regexp_replace("baseUrl", '/v1/?$', '')
WHERE "baseUrl" ~ '/v1/?$';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'LLMProvider_addedBy_fkey'
      AND table_name = 'LLMProvider'
  ) THEN
    ALTER TABLE "LLMProvider"
    ADD CONSTRAINT "LLMProvider_addedBy_fkey"
    FOREIGN KEY ("addedBy") REFERENCES "User"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "LLMProvider" (
  "id",
  "name",
  "displayName",
  "providerType",
  "baseUrl",
  "apiKeyEnvVar",
  "modelId",
  "defaultParams",
  "role",
  "priority",
  "isActive",
  "timeoutSeconds",
  "maxTokens",
  "temperature",
  "healthStatus",
  "createdAt",
  "updatedAt"
)
SELECT
  md5(random()::text || clock_timestamp()::text),
  seeded."name",
  seeded."displayName",
  seeded."providerType",
  seeded."baseUrl",
  seeded."apiKeyEnvVar",
  seeded."modelId",
  '{}'::text,
  seeded."role",
  seeded."priority",
  true,
  120,
  1024,
  0.1,
  'unknown',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('vLLM — Qwen3-30B-A3B', 'vLLM — Qwen3-30B-A3B', 'openai_compat', 'http://vllm:8000', NULL, 'qwen3-30b-a3b', 'primary', 1),
    ('vLLM — Mistral Small 3.1', 'vLLM — Mistral Small 3.1', 'openai_compat', 'http://vllm:8000', NULL, 'mistral-small-3.1-22b', 'fallback_1', 2),
    ('vLLM — Qwen3-8B', 'vLLM — Qwen3-8B', 'openai_compat', 'http://vllm:8000', NULL, 'qwen3-8b', 'fallback_2', 3)
) AS seeded("name", "displayName", "providerType", "baseUrl", "apiKeyEnvVar", "modelId", "role", "priority")
WHERE NOT EXISTS (
  SELECT 1 FROM "LLMProvider"
);
