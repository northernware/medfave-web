import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db } from "./db";

/*
 * Loads the WHO ICD-11 MMS classification into `Icd11Code`, straight from
 * WHO's release files, so the list itself is never kept in this repository.
 *
 *   npm run icd11:import            the release named below
 *   npm run icd11:import -- 2027-01 another release
 *
 * ICD-11 is © World Health Organization, used under CC BY-ND 3.0 IGO: codes
 * and titles are stored exactly as published (the leading "- - " depth marks
 * in WHO's text file are layout, not title), each with its URI. Rerunning
 * updates titles and adds new codes; nothing is deleted, since visit notes
 * keep their own copies anyway. Needs `unzip` on the PATH.
 */

const RELEASE = process.argv[2] ?? "2026-01";
const URL = `https://icdcdn.who.int/static/releasefiles/${RELEASE}/SimpleTabulation-ICD-11-MMS-en.zip`;
const FILE = "SimpleTabulation-ICD-11-MMS-en.txt";
const BATCH = 2000;

type Row = {
  code: string;
  title: string;
  uri: string;
  chapter: string;
  leaf: boolean;
  release: string;
};

async function main() {
  const response = await fetch(URL);
  if (!response.ok)
    throw new Error(`WHO release ${RELEASE}: ${response.status} from ${URL}`);
  const dir = mkdtempSync(join(tmpdir(), "icd11-"));
  let text: string;
  try {
    const zip = join(dir, "icd11.zip");
    writeFileSync(zip, Buffer.from(await response.arrayBuffer()));
    text = execFileSync("unzip", ["-p", zip, FILE], {
      maxBuffer: 64 * 1024 * 1024,
    }).toString("utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const header = lines[0].split("\t");
  const at = (name: string) => {
    const i = header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`WHO file has no "${name}" column`);
    return i;
  };
  const [cCode, cTitle, cUri, cKind, cChapter, cLeaf] = [
    "Code",
    "Title",
    "Linearization URI",
    "ClassKind",
    "ChapterNo",
    "isLeaf",
  ].map(at);

  const rows: Row[] = [];
  for (const line of lines.slice(1)) {
    const f = line.split("\t");
    if (f[cKind] !== "category" || !f[cCode]) continue;
    rows.push({
      code: f[cCode],
      title: f[cTitle].replace(/^(- )+/, "").trim(),
      uri: f[cUri],
      chapter: f[cChapter],
      leaf: f[cLeaf].toLowerCase() === "true",
      release: RELEASE,
    });
  }
  if (rows.length < 10_000)
    throw new Error(
      `Only ${rows.length} codes read: the file's layout may have changed.`,
    );

  // One transaction: a failed load leaves the list as it was.
  await db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = JSON.stringify(rows.slice(i, i + BATCH));
      const plan = db.raw.sql`
      INSERT INTO "Icd11Code" ("code", "title", "uri", "chapter", "leaf", "release")
      SELECT "code", "title", "uri", "chapter", "leaf", "release"
        FROM jsonb_to_recordset(${batch}::jsonb)
          AS x("code" text, "title" text, "uri" text, "chapter" text, "leaf" bool, "release" text)
      ON CONFLICT ("code") DO UPDATE
         SET "title" = EXCLUDED."title", "uri" = EXCLUDED."uri", "chapter" = EXCLUDED."chapter",
             "leaf" = EXCLUDED."leaf", "release" = EXCLUDED."release"
    `
        .affectedCount()
        .build();
      await tx.execute(plan as never);
    }
  });
  console.log(`ICD-11 ${RELEASE}: ${rows.length} codes loaded.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
