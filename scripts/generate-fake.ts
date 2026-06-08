#!/usr/bin/env tsx
/**
 * generate-fake.ts
 *
 * CLI script that generates fake TEI XML medieval charter documents.
 *
 * Usage: tsx scripts/generate-fake.ts [--count N] [--seed N] [--sparse F] [--clean]
 *
 * Options:
 *   --count N    Number of documents to generate (default: 100)
 *   --seed N     Random seed for reproducibility
 *   --sparse F   Probability (0-1) of skipping optional fields (default: 0)
 *   --clean      Delete existing data/fake/ contents before generating
 */

import { faker } from "@faker-js/faker";
import * as fs from "fs";
import * as path from "path";

import {
  AUTHOR_NAMES,
  PLACE_NAMES,
  NOTARY_NAMES,
  WITNESS_NAMES,
  REPOSITORIES,
  PROTOCOL_TEMPLATES,
  TEXTUS_TEMPLATES,
  ESCHATOCOL_TEMPLATES,
  fillTemplate,
} from "@/lib/fake/pools";

import { generateTeiXml, buildFilename } from "@/lib/xmlBuilder";
import { loadFormConfig } from "@/lib/formConfig";
import { buildCorpus } from "./build-corpus";
import { buildEntityGraph } from "./build-entity-graph";

import type {
  FormSubmissionData,
  DateFieldValue,
  WitnessEntry,
} from "@/types/form";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SAINTS: readonly string[] = [
  "Petri",
  "Stephani",
  "Iohannis",
  "Benedicti",
  "Marie",
  "Pauli",
  "Laurentii",
  "Georgii",
  "Michaelis",
  "Dominici",
];

const MONTH_NAMES: readonly string[] = [
  "ianuarii",
  "februarii",
  "martii",
  "aprilis",
  "madii",
  "iunii",
  "iulii",
  "augusti",
  "septembris",
  "octobris",
  "novembris",
  "decembris",
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface Args {
  count: number;
  seed?: number;
  sparse: number;
  clean: boolean;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let count = 100;
  let seed: number | undefined;
  let sparse = 0;
  let clean = false;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--count":
        count = parseInt(args[++i], 10);
        break;
      case "--seed":
        seed = parseInt(args[++i], 10);
        break;
      case "--sparse":
        sparse = parseFloat(args[++i]);
        break;
      case "--clean":
        clean = true;
        break;
    }
  }

  return { count, seed, sparse, clean };
}

// ---------------------------------------------------------------------------
// Fake document generator
// ---------------------------------------------------------------------------

function generateFakeDocument(sparseRate: number): FormSubmissionData {
  // ── Date ──
  const year = faker.number.int({ min: 1100, max: 1350 });
  const day = faker.number.int({ min: 1, max: 28 });
  const dayPadded = day.toString().padStart(2, "0");
  const yearPadded = year.toString().padStart(4, "0");
  const dateFieldValue: DateFieldValue = {
    iso: `${yearPadded}-06-${dayPadded}`,
    text: `${day} Iunii ${year}`,
  };

  // ── Always-populated fields ──
  const authorName = faker.helpers.arrayElement(AUTHOR_NAMES);
  const repository = faker.helpers.arrayElement(REPOSITORIES);
  const shelfmark = `Dem. ${faker.number.int({ min: 1, max: 999 })}/${faker.number.int({ min: 1000, max: 2000 })}`;
  const locusRedactionis = faker.helpers.arrayElement(PLACE_NAMES);
  const recipientName = `Monasterium Sancti ${faker.helpers.arrayElement(SAINTS)}`;
  const notarius = faker.helpers.arrayElement(NOTARY_NAMES);
  const invocatioType = faker.helpers.arrayElement(["symbolica", "verbalis"]);
  const propertyType = faker.helpers.arrayElement(["immobile", "mobile"]);
  const emittensType = faker.helpers.arrayElement(["auctor", "destinatarius"]);
  const sanctioType = faker.helpers.arrayElement([
    "dupli_pena",
    "pecunia_numerata",
  ]);

  // Property location: 2nd element of PLACE_NAMES (different from locus_redactionis)
  const propertyLocation = PLACE_NAMES[1];

  // ── Template variables ──
  const yearStr = year.toString();
  const indiction = ((year - 313) % 15) + 1;
  const datatioDay = faker.number.int({ min: 1, max: 28 }).toString();
  const datatioMonth = faker.helpers.arrayElement(MONTH_NAMES);
  const neighbor = faker.helpers.arrayElement(WITNESS_NAMES);

  // ── Sparse mode: determine which optional fields to skip (uses Math.random, not faker) ──
  const skipPretium = Math.random() < sparseRate;
  const skipPropertyLocation = Math.random() < sparseRate;
  const skipNotarius = Math.random() < sparseRate;
  const skipTestes = Math.random() < sparseRate;

  // For template fills, fall back to locus_redactionis when property_location is skipped
  const placeForTemplates = skipPropertyLocation
    ? locusRedactionis
    : propertyLocation;

  // ── Template-filled text fields ──
  const invocatioText = fillTemplate(
    faker.helpers.arrayElement(PROTOCOL_TEMPLATES.invocatio),
    { YEAR: yearStr },
  );

  const datatioChronica = fillTemplate(
    faker.helpers.arrayElement(PROTOCOL_TEMPLATES.datatio_chronica),
    {
      YEAR: yearStr,
      INDICTIO: indiction.toString(),
      DAY: datatioDay,
      MONTH: datatioMonth,
    },
  );

  const authorText = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.author_context),
    { AUTHOR: authorName, RECIPIENT: recipientName },
  );

  const verbaDispositiva = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.verba_dispositiva),
    { PLACE: placeForTemplates, AUTHOR: authorName, RECIPIENT: recipientName },
  );

  const recipientText = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.recipient_context),
    { RECIPIENT: recipientName },
  );

  const clausulaPerpetuitatis =
    "Et hanc venditionem firma et rata permaneat in perpetuum.";
  const clausulaServitutisPassagii =
    "Cum accessibus et egressibus suis, viis et anditis.";
  const clausulaIntegritatis =
    "Integra et indemnis cum omnibus suis iuribus et pertinentiis.";

  const clausulaQuietantiaePretii = fillTemplate(
    "Confessus est $AUTHOR se recepisse pretium infrascriptum.",
    { AUTHOR: authorName },
  );

  const propertyDescription = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.property_description),
    {
      PLACE: placeForTemplates,
      SIZE: faker.number.int({ min: 1, max: 50 }).toString(),
    },
  );

  const formulaConfinium = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.formula_confinium),
    { AUTHOR: authorName, RECIPIENT: recipientName, NEIGHBOR: neighbor },
  );

  const formulaMensurationum =
    "Secundum mensuram et consuetudinem civitatis Bononie.";
  const formulaTransmissionis =
    "Cum plena potestate vendendi, donandi, alienandi et quicquid voluerit faciendi.";
  const formulaLibereFruitionis =
    "Habendi, tenendi et quicquid voluerit faciendi.";

  const formulaLegitimaeDefensionis = fillTemplate(
    "Et promisit $AUTHOR se defensurum ab omni homine et persona.",
    { AUTHOR: authorName },
  );

  const sanctioText = fillTemplate(
    faker.helpers.arrayElement(TEXTUS_TEMPLATES.sanctio),
    {
      PENALTY: faker.number.int({ min: 100, max: 500 }).toString(),
      AUTHOR: authorName,
    },
  );

  const datatioTopica = fillTemplate(
    faker.helpers.arrayElement(ESCHATOCOL_TEMPLATES.datatio_topica),
    { PLACE: locusRedactionis, AUTHOR: authorName },
  );

  const testesText = skipTestes
    ? ""
    : faker.helpers.arrayElement(ESCHATOCOL_TEMPLATES.testes_text);

  const completio = fillTemplate(
    faker.helpers.arrayElement(ESCHATOCOL_TEMPLATES.completio),
    { NOTARIUS: skipNotarius ? "" : notarius },
  );

  // ── Witnesses ──
  const witnessCount = faker.number.int({ min: 2, max: 5 });
  const witnesses: WitnessEntry[] = faker.helpers.multiple(
    () => ({
      name: faker.helpers.arrayElement(WITNESS_NAMES),
      is_investitor: false,
    }),
    { count: witnessCount },
  );
  if (witnesses.length > 0) {
    const investitorIdx = faker.number.int({
      min: 0,
      max: witnesses.length - 1,
    });
    witnesses[investitorIdx].is_investitor = true;
  }

  // ── Price ──
  const pretium = `${faker.number.int({ min: 10, max: 1000 })} librarum bononinorum`;

  // ── Build FormSubmissionData ──
  return {
    charter_type: "instrumentum_venditionis",
    fields: {
      date_modern: dateFieldValue,
      author_name: authorName,
      repository,
      shelfmark,
      locus_redactionis: locusRedactionis,
      recipient_name: recipientName,
      notarius: skipNotarius ? "" : notarius,
      invocatio_type: invocatioType,
      property_type: propertyType,
      emittens_type: emittensType,
      sanctio_type: sanctioType,
      invocatio_text: invocatioText,
      datatio_chronica: datatioChronica,
      author_text: authorText,
      verba_dispositiva: verbaDispositiva,
      recipient_text: recipientText,
      clausula_perpetuitatis: clausulaPerpetuitatis,
      clausula_servitutis_passagii: clausulaServitutisPassagii,
      clausula_integritatis: clausulaIntegritatis,
      clausula_quietantiae_pretii: clausulaQuietantiaePretii,
      property_description: propertyDescription,
      formula_confinium: formulaConfinium,
      formula_mensurationum: formulaMensurationum,
      formula_transmissionis: formulaTransmissionis,
      formula_libere_fruitionis: formulaLibereFruitionis,
      formula_legitimae_defensionis: formulaLegitimaeDefensionis,
      sanctio_text: sanctioText,
      datatio_topica: datatioTopica,
      testes_text: testesText,
      completio,
      property_location: skipPropertyLocation ? "" : propertyLocation,
      pretium: skipPretium ? "" : pretium,
      testes_names: skipTestes ? "" : witnesses,
    },
    ad_hoc: [],
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const startTime = Date.now();
  const args = parseArgs();

  // Seed faker if requested
  if (args.seed !== undefined) {
    faker.seed(args.seed);
  }

  const root = process.cwd();
  const fakeDir = path.join(root, "data", "fake");

  // Clean if requested
  if (args.clean) {
    if (fs.existsSync(fakeDir)) {
      fs.rmSync(fakeDir, { recursive: true, force: true });
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(fakeDir, { recursive: true });

  // Load form config for XML generation
  const formConfig = loadFormConfig();

  // Track filename counters per base name
  const filenameCounters = new Map<string, number>();

  for (let i = 0; i < args.count; i++) {
    const data = generateFakeDocument(args.sparse);
    const baseName = buildFilename(data);

    // Progressive numbering per base name
    const counter = (filenameCounters.get(baseName) || 0) + 1;
    filenameCounters.set(baseName, counter);

    const seqStr = counter.toString().padStart(2, "0");
    const docId = `${baseName}_${seqStr}`;
    const filename = `${docId}.xml`;
    const filePath = path.join(fakeDir, filename);

    const xml = generateTeiXml(data, formConfig, docId);
    fs.writeFileSync(filePath, xml, "utf-8");

    // Progress logging every 10 files
    if ((i + 1) % 10 === 0 || i + 1 === args.count) {
      console.log(`Generated ${i + 1}/${args.count} files...`);
    }
  }

  // Post-generation rebuild
  console.log("\nRebuilding corpus and entity graph...");
  const fakeDataDir = path.join(root, "data", "fake");
  await buildCorpus({ projectRoot: root, dataDirs: [fakeDataDir] });
  await buildEntityGraph({ projectRoot: root, dataDirs: [fakeDataDir] });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nGenerated ${args.count} files in data/fake/ (${elapsed}s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
