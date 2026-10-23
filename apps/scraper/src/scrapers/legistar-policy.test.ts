import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import test from "node:test";

import type {
  LegistarAgendaItem,
  LegistarAttachment,
  LegistarMatter,
} from "@acme/api/integrations/legistar";

import {
  bodyPolicy,
  classifyDocument,
  classifyTopic,
  inferGeographicScope,
} from "./legistar-policy.js";
import {
  extractPdf,
  nativeTextQuality,
  needsOcr,
  parseLegistarMeetingStart,
} from "./legistar.js";

const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/legistar/san-jose-sample.json", import.meta.url),
    "utf8",
  ),
) as {
  item: LegistarAgendaItem;
  matter: LegistarMatter;
  staffDocument: LegistarAttachment;
  publicCommentDocument: LegistarAttachment;
};

test("curates resident-facing bodies and excludes closed-session buckets", () => {
  assert.deepEqual(bodyPolicy(138), { included: true, relevanceTier: 1 });
  assert.deepEqual(bodyPolicy(212), { included: true, relevanceTier: 2 });
  assert.equal(bodyPolicy(269).included, false);
  assert.equal(bodyPolicy(244).included, false);
});

test("classifies topic and conservative geographic scope", () => {
  assert.equal(classifyTopic(fixture.matter), "housing-land-use");
  assert.deepEqual(inferGeographicScope(fixture.matter, fixture.item), {
    kind: "district",
    districtNumbers: [3],
    text: "Council District 3",
  });
});

test("keeps public comments link-only while extracting staff evidence", () => {
  assert.deepEqual(classifyDocument(fixture.publicCommentDocument), {
    category: "public_comment",
    processingPolicy: "link_only",
    isPublicComment: true,
  });
  assert.deepEqual(classifyDocument(fixture.staffDocument), {
    category: "staff_report",
    processingPolicy: "extract_text",
    isPublicComment: false,
  });
});

test("marks image-only PDFs for OCR and accepts dense native text", () => {
  assert.equal(needsOcr("", 1), true);
  assert.equal(needsOcr("A".repeat(79), 1), true);
  assert.equal(needsOcr("A".repeat(80), 1), false);
  assert.ok(nativeTextQuality("City budget report. ".repeat(50), 1) > 0.9);
});

test("interprets Legistar local meeting times in San José's timezone", () => {
  assert.equal(
    parseLegistarMeetingStart(
      "2026-06-23T00:00:00",
      "1:30 PM",
      "America/Los_Angeles",
    ).toISOString(),
    "2026-06-23T20:30:00.000Z",
  );
  assert.equal(
    parseLegistarMeetingStart(
      "2026-12-15T00:00:00",
      "1:30 PM",
      "America/Los_Angeles",
    ).toISOString(),
    "2026-12-15T21:30:00.000Z",
  );
});

test("Santa Clara policy does not inherit San José body IDs", () => {
  for (const id of [138, 180]) {
    assert.deepEqual(bodyPolicy(id, "santaclara"), {
      included: true,
      relevanceTier: 1,
    });
  }
  for (const id of [182, 184, 197, 199, 201, 232, 236]) {
    assert.deepEqual(bodyPolicy(id, "santaclara"), {
      included: true,
      relevanceTier: 2,
    });
  }
  for (const id of [194, 202, 203]) {
    assert.deepEqual(bodyPolicy(id, "santaclara"), {
      included: true,
      relevanceTier: 3,
    });
  }
  for (const [id, name] of [
    [246, "Closed Session"],
    [211, "Video Stream"],
    [239, "Deferred Compensation Committee"],
    [250, "Charter Review Committee 2023 - DO NOT USE"],
    [999, "Unrecognized body"],
  ] as const) {
    assert.equal(bodyPolicy(id, "santaclara").included, false, name);
  }
  assert.equal(bodyPolicy(211, "sanjose").included, true);
  assert.equal(bodyPolicy(246, "sanjose").included, true);
  assert.equal(bodyPolicy(180, "sanjose").included, false);
});

test("Santa Clara correspondence remains link-only even when labeled as a report", () => {
  for (const name of [
    "Written Correspondence",
    "Email Correspondence",
    "Public Correspondence",
    "Correspondence received - staff report",
    "Comments from residents",
  ]) {
    assert.deepEqual(
      classifyDocument({
        ...fixture.staffDocument,
        MatterAttachmentName: name,
      }),
      {
        category: "public_comment",
        processingPolicy: "link_only",
        isPublicComment: true,
      },
    );
  }
});

test("PDF extraction keeps blank page positions and hashes the original bytes", async () => {
  const texts = [
    "Council staff report supports the recommended city budget. ".repeat(5),
    "",
    "The recommended appropriation funds city services. ".repeat(5),
  ];
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R 7 0 R] /Count 3 >>",
    ...texts.flatMap((text, index) => {
      const stream = `BT /F1 3 Tf 50 700 Td (${text}) Tj ET`;
      return [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 9 0 R >> >> /Contents ${4 + index * 2} 0 R >>`,
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
      ];
    }),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const bytes = Buffer.from(pdf);
  const server = createServer((_request, response) => {
    response.writeHead(200, {
      "content-type": "application/pdf",
      "content-length": bytes.length,
    });
    response.end(bytes);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const result = await extractPdf(
      `http://127.0.0.1:${address.port}/report.pdf`,
      100_000,
    );
    assert.equal(result.status, "native");
    assert.equal(result.byteSize, bytes.length);
    assert.equal(
      result.contentHash,
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(result.pageCount, 3);
    assert.equal(result.pages?.length, 3);
    assert.equal(result.pages?.[1], "");
    assert.match(result.pages?.[0] ?? "", /Council staff report/);
    assert.match(result.pages?.[2] ?? "", /recommended appropriation/);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("unidentified resident letters stay out of extraction", () => {
  for (const name of [
    "Correspondence",
    "Written comments",
    "Letters",
    "2. Letters received",
  ]) {
    assert.equal(
      classifyDocument({ ...fixture.staffDocument, MatterAttachmentName: name })
        .processingPolicy,
      "link_only",
    );
  }
});
