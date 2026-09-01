import { generateText, Output } from "ai";
import pg from "pg";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { z } from "zod";

import { databaseTarget, databaseTargetMessage } from "./env.js";
import { getStructuredLlm } from "./utils/ai/provider.js";
import { createLogger } from "./utils/log.js";

const logger = createLogger("normalize-lens-framing");

interface LensSide {
  stance: string;
  points: { text: string }[];
}

interface LegacyLens {
  framing?: string;
  left: LensSide;
  right: LensSide;
  [key: string]: unknown;
}

interface LegacyLensRow {
  id: string;
  title: string;
  lens_data: LegacyLens;
}

const ClassificationSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().uuid(),
      supportingSide: z.enum(["left", "right"]),
      confidence: z.enum(["high", "medium", "low"]),
      reason: z.string().trim().min(8).max(180),
    }),
  ),
});

type Classification = z.infer<typeof ClassificationSchema>["items"][number];

const argv = await yargs(hideBin(process.argv))
  .option("apply", {
    type: "boolean",
    default: false,
    description: "Write the classified framing changes",
  })
  .option("yes", {
    type: "boolean",
    default: false,
    description: "Acknowledge production writes",
  })
  .option("batch-size", {
    type: "number",
    default: 15,
    description: "Legacy lenses to classify in one model call",
  })
  .check((args) => {
    const batchSize = args.batchSize;
    return typeof batchSize === "number" &&
      Number.isInteger(batchSize) &&
      batchSize >= 1 &&
      batchSize <= 25
      ? true
      : "--batch-size must be an integer from 1 to 25";
  })
  .strict()
  .help()
  .parse();

function classificationPrompt(rows: LegacyLensRow[]): string {
  const inputs = rows.map((row) => ({
    id: row.id,
    title: row.title,
    left: row.lens_data.left.points.map((point) => point.text),
    right: row.lens_data.right.points.map((point) => point.text),
  }));

  return `Classify the two argument sides for each government document below.

Choose the side that is more supportive of the document or policy itself. A
supporting side defends, favors, praises, or justifies the action. The opposing
side criticizes, rejects, warns against, or argues that the action is
insufficient. Ignore progressive and conservative ideology. Use the overall
meaning of all points, not a single positive or negative word.

Return every id exactly once and do not add ids. Use low confidence only when
the points genuinely do not reveal which side supports the action. Keep each
reason to one short sentence.

Documents:
${JSON.stringify(inputs)}`;
}

async function classifyBatch(rows: LegacyLensRow[]): Promise<Classification[]> {
  const { output } = await generateText({
    model: getStructuredLlm(),
    output: Output.object({ schema: ClassificationSchema }),
    temperature: 0,
    prompt: classificationPrompt(rows),
  });

  const expected = new Set(rows.map((row) => row.id));
  const returned = new Set(output.items.map((item) => item.id));
  if (
    returned.size !== output.items.length ||
    returned.size !== expected.size ||
    [...expected].some((id) => !returned.has(id))
  ) {
    throw new Error(
      "Classifier did not return every requested lens exactly once",
    );
  }
  return output.items;
}

function normalizedLens(
  lens: LegacyLens,
  supportingSide: "left" | "right",
): LegacyLens {
  const supporting = lens[supportingSide];
  const opposing = lens[supportingSide === "left" ? "right" : "left"];
  return {
    ...lens,
    framing: "proponent_opponent",
    left: { ...supporting, stance: "Proponents argue" },
    right: { ...opposing, stance: "Opponents counter" },
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) throw new Error("POSTGRES_URL is required");

  const target = databaseTarget(databaseUrl);
  if (argv.apply && target.target === "production" && !argv.yes) {
    throw new Error("Production writes require both --apply and --yes");
  }
  logger[target.target === "production" ? "warn" : "info"](
    databaseTargetMessage(databaseUrl),
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<LegacyLensRow>(`
      SELECT
        cl.id,
        COALESCE(gc.title, '[No title available]') AS title,
        cl.lens_data
      FROM content_lens cl
      LEFT JOIN government_content gc
        ON cl.content_type = 'government_content'
       AND gc.id = cl.content_id
      WHERE cl.content_type = 'government_content'
        AND cl.lens_data->>'framing' = 'left_right'
      ORDER BY cl.id
    `);
    const rows = result.rows;
    logger.info(`Found ${rows.length} legacy government-content lens row(s)`);
    if (rows.length === 0) return;

    const classifications: Classification[] = [];
    for (let start = 0; start < rows.length; start += argv.batchSize) {
      const batch = rows.slice(start, start + argv.batchSize);
      classifications.push(...(await classifyBatch(batch)));
      logger.info(
        `Classified ${Math.min(start + batch.length, rows.length)}/${rows.length}`,
      );
    }

    const uncertain = classifications.filter(
      (classification) => classification.confidence === "low",
    );
    if (uncertain.length > 0) {
      for (const item of uncertain) {
        logger.error(`Low confidence for ${item.id}: ${item.reason}`);
      }
      throw new Error("Refusing to write low-confidence classifications");
    }

    const byId = new Map(classifications.map((item) => [item.id, item]));
    const swaps = classifications.filter(
      (classification) => classification.supportingSide === "right",
    ).length;
    logger.info(`${swaps} row(s) need their left and right arguments swapped`);
    if (!argv.apply) {
      logger.info("Dry run complete; pass --apply to write changes");
      return;
    }

    await client.query("BEGIN");
    try {
      let updated = 0;
      for (const row of rows) {
        const classification = byId.get(row.id);
        if (!classification)
          throw new Error(`Missing classification for ${row.id}`);
        const update = await client.query(
          `UPDATE content_lens
              SET lens_data = $2::jsonb,
                  updated_at = now()
            WHERE id = $1
              AND lens_data->>'framing' = 'left_right'`,
          [
            row.id,
            JSON.stringify(
              normalizedLens(row.lens_data, classification.supportingSide),
            ),
          ],
        );
        updated += update.rowCount ?? 0;
      }
      if (updated !== rows.length) {
        throw new Error(
          `Expected to update ${rows.length} rows, updated ${updated}`,
        );
      }
      await client.query("COMMIT");
      logger.success(`Normalized ${updated} dual-lens row(s)`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const verification = await client.query<{ count: number }>(`
      SELECT count(*)::int AS count
      FROM content_lens
      WHERE content_type = 'government_content'
        AND lens_data->>'framing' <> 'proponent_opponent'
    `);
    if (verification.rows[0]?.count !== 0) {
      throw new Error("Verification failed: legacy framing remains");
    }
    logger.success(
      "Verified all government-content lenses use neutral framing",
    );
  } finally {
    await client.end();
  }
}

await main();
