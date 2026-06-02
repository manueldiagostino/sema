import type {
  FormSubmissionData,
  FormSectionsConfig,
  DateFieldValue,
  WitnessEntry,
} from "@/types/form";

/** Escape special XML characters in text content. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Build an XML attribute string from a record. */
function attr(a?: Record<string, string>): string {
  if (!a) return "";
  return Object.entries(a)
    .map(([k, v]) => ` ${k}="${esc(v)}"`)
    .join("");
}

/** Check if a value is empty / null / blank string. */
function isEmpty(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Shorthand to read a field value from submission data. */
function getVal(data: FormSubmissionData, id: string) {
  return data.fields[id];
}

/** Get a field value as string, or empty string if missing. */
function getStr(data: FormSubmissionData, id: string): string {
  const v = getVal(data, id);
  return typeof v === "string" ? v : "";
}

/** Get WitnessEntry[] value, or empty array. */
function getWitnesses(data: FormSubmissionData, id: string): WitnessEntry[] {
  const v = getVal(data, id);
  if (Array.isArray(v) && v.length > 0 && v[0] && typeof v[0] === "object" && "name" in v[0]) {
    return v as WitnessEntry[];
  }
  return [];
}

/**
 * Build a div with optional @subtype and a <p> child.
 * Returns empty string if textContent is empty.
 */
function makeDiv(
  type: string,
  textContent: string,
  subtype?: string,
  indent = "        ",
): string {
  if (isEmpty(textContent)) return "";
  const subtypeAttr = subtype ? ` subtype="${esc(subtype)}"` : "";
  return (
    `${indent}<div type="${esc(type)}"${subtypeAttr}>\n` +
    `${indent}  <p>${esc(textContent)}</p>\n` +
    `${indent}</div>`
  );
}

/**
 * Build a div with optional @subtype but without <p> child (container only).
 */
function makeDivContainer(
  type: string,
  children: string[],
  subtype?: string,
  indent = "      ",
): string {
  const subtypeAttr = subtype ? ` subtype="${esc(subtype)}"` : "";
  const childLines = children.filter((c) => c).map((c) => c);
  if (childLines.length === 0) return "";
  return (
    `${indent}<div type="${esc(type)}"${subtypeAttr}>\n` +
    childLines.join("\n") +
    `\n${indent}</div>`
  );
}

/**
 * Generate the complete TEI P5 XML document from form submission data.
 * Builds a three-part diplomatic formulary: Protocol, Text, Eschatocol.
 * @param docId Optional document ID (filename stem) for xml:id on <TEI> root.
 */
export function generateTeiXml(
  data: FormSubmissionData,
  _config: FormSectionsConfig,
  docId?: string,
): string {
  const I = (n: number) => "  ".repeat(n); // indentation helper

  // ── teiHeader lines ──

  // titleStmt
  const authorName = getStr(data, "author_name");
  const titleStmt: string[] = [];
  titleStmt.push(`${I(4)}<title>Instrumentum venditionis</title>`);
  if (authorName) {
    titleStmt.push(`${I(4)}<author>${esc(authorName)}</author>`);
  }

  // msIdentifier
  const repository = getStr(data, "repository");
  const shelfmark = getStr(data, "shelfmark");
  const msId: string[] = [];
  if (repository) msId.push(`${I(6)}<repository>${esc(repository)}</repository>`);
  if (shelfmark) msId.push(`${I(6)}<idno>${esc(shelfmark)}</idno>`);

  // msItem
  const recipientName = getStr(data, "recipient_name");
  const notaryName = getStr(data, "notarius");
  const msItem: string[] = [];
  if (recipientName) {
    msItem.push(`${I(7)}<recipient>${esc(recipientName)}</recipient>`);
  }
  if (notaryName) {
    msItem.push(
      `${I(7)}<respStmt>\n` +
        `${I(8)}<resp>notary</resp>\n` +
        `${I(8)}<name>${esc(notaryName)}</name>\n` +
        `${I(7)}</respStmt>`,
    );
  }

  // creation
  const dateVal = getVal(data, "date_modern");
  const locusRedactionis = getStr(data, "locus_redactionis");
  const creation: string[] = [];
  if (dateVal && typeof dateVal === "object" && "iso" in dateVal) {
    const dv = dateVal as DateFieldValue;
    const text = dv.text || dv.iso;
    if (!isEmpty(dv.iso) || !isEmpty(text)) {
      creation.push(
        `${I(4)}<date when="${esc(dv.iso)}">${esc(text)}</date>`,
      );
    }
  }
  if (locusRedactionis) {
    creation.push(`${I(4)}<origPlace>${esc(locusRedactionis)}</origPlace>`);
  }

  // keywords
  const kwFields: [string, string][] = [
    ["author_name", "author_name"],
    ["recipient_name", "recipient_name"],
    ["pretium", "price"],
    ["property_location", "property_location"],
    ["locus_redactionis", "locus_redactionis"],
    ["emittens_type", "emittens"],
  ];
  const kwTerms: string[] = [
    `${I(5)}<term type="object">Instrumentum venditionis</term>`,
    `${I(5)}<term type="object_subtype">Venditio</term>`,
  ];
  for (const [fieldId, termType] of kwFields) {
    const v = getStr(data, fieldId);
    if (v) kwTerms.push(`${I(5)}<term type="${esc(termType)}">${esc(v)}</term>`);
  }
  // ad-hoc
  for (const ah of data.ad_hoc || []) {
    if (!isEmpty(ah.key) && !isEmpty(ah.value)) {
      kwTerms.push(`${I(5)}<term type="${esc(ah.key)}">${esc(ah.value)}</term>`);
    }
  }

  // ── body: nested diplomatic structure ──

  // Protocol
  const protocolChildren: string[] = [];
  const invocatioText = getStr(data, "invocatio_text");
  const invocatioTypeVal = getVal(data, "invocatio_type");
  const invocatioType = Array.isArray(invocatioTypeVal)
    ? (invocatioTypeVal as string[]).join(" ")
    : typeof invocatioTypeVal === "string" ? invocatioTypeVal : "";
  if (invocatioText) {
    protocolChildren.push(
      invocatioType
        ? `        <div type="invocatio" subtype="${esc(invocatioType)}">\n          <p>${esc(invocatioText)}</p>\n        </div>`
        : `        <div type="invocatio">\n          <p>${esc(invocatioText)}</p>\n        </div>`,
    );
  }
  const dcDiv = makeDiv("datatio_chronica", getStr(data, "datatio_chronica"));
  if (dcDiv) protocolChildren.push(dcDiv);

  const protocolDiv = makeDivContainer("protocol", protocolChildren);
  const protocolContent = protocolDiv ? [protocolDiv] : [];

  // Textus
  const textusChildren: string[] = [];
  const textusDivs: [string, string, string?][] = [
    ["author_context", "author_text"],
    ["verba_dispositiva", "verba_dispositiva"],
    ["recipient_context", "recipient_text"],
    ["clausula_perpetuitatis", "clausula_perpetuitatis"],
    ["property_description", "property_description", "property_type"],
    ["clausula_servitutis_passagii", "clausula_servitutis_passagii"],
    ["clausula_integritatis", "clausula_integritatis"],
    ["clausula_quietantiae_pretii", "clausula_quietantiae_pretii"],
    ["formula_confinium", "formula_confinium"],
    ["formula_mensurationum", "formula_mensurationum"],
    ["formula_transmissionis", "formula_transmissionis"],
    ["formula_libere_fruitionis", "formula_libere_fruitionis"],
    ["formula_legitimae_defensionis", "formula_legitimae_defensionis"],
    ["sanctio", "sanctio_text", "sanctio_type"],
  ];
  for (const [divType, fieldId, subtypeField] of textusDivs) {
    const text = getStr(data, fieldId);
    const subtype = subtypeField ? getStr(data, subtypeField) : undefined;
    const div = makeDiv(divType, text, subtype);
    if (div) textusChildren.push(div);
  }
  const textusDiv = makeDivContainer("textus", textusChildren, undefined, "      ");
  const textusContent = textusDiv ? [textusDiv] : [];

  // Eschatocol
  const eschatocolChildren: string[] = [];
  const dtDiv = makeDiv("datatio_topica", getStr(data, "datatio_topica"));
  if (dtDiv) eschatocolChildren.push(dtDiv);

  // Subscriptions
  const subscriptionsChildren: string[] = [];
  const emittensType = getStr(data, "emittens_type");
  if (emittensType) {
    subscriptionsChildren.push(
      `          <div type="emittens" subtype="${esc(emittensType)}" />`,
    );
  }
  const testesDiv = makeDiv("testes", getStr(data, "testes_text"), undefined, "          ");
  if (testesDiv) subscriptionsChildren.push(testesDiv);

  // Witness list
  const witnesses = getWitnesses(data, "testes_names");
  const witnessLines: string[] = [];
  for (const w of witnesses) {
    if (isEmpty(w.name)) continue;
    const anaAttr = w.is_investitor ? ' ana="#investitor"' : "";
    witnessLines.push(
      `          <witness${anaAttr}><name>${esc(w.name)}</name></witness>`,
    );
  }
  if (witnessLines.length > 0) {
    subscriptionsChildren.push(
      `          <listWitness>\n` +
        witnessLines.join("\n") +
        `\n          </listWitness>`,
    );
  }

  const completioDiv = makeDiv("completio", getStr(data, "completio"), undefined, "          ");
  if (completioDiv) subscriptionsChildren.push(completioDiv);

  const subscriptionsDiv = makeDivContainer("subscriptiones", subscriptionsChildren, undefined, "        ");
  if (subscriptionsDiv) eschatocolChildren.push(subscriptionsDiv);

  const eschatocolDiv = makeDivContainer("eschatocol", eschatocolChildren, undefined, "      ");
  const eschatocolContent = eschatocolDiv ? [eschatocolDiv] : [];

  const bodyContent = [...protocolContent, ...textusContent, ...eschatocolContent];

  // ── Assemble document ──
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml-model href="http://www.tei-c.org/release/xml/tei/custom/schema/relaxng/tei_all.rng" type="application/xml" schematypens="http://relaxng.org/ns/structure/1.0"?>',
    `<TEI xmlns="http://www.tei-c.org/ns/1.0"${docId ? ` xml:id="${esc(docId)}"` : ""}>`,
    "  <teiHeader>",
    "    <fileDesc>",
    "      <titleStmt>",
  ];
  lines.push(...titleStmt);
  lines.push(
    "      </titleStmt>",
    "      <publicationStmt>",
    "        <p>Sample CEI2TEI P5 document for testing corpus table configuration</p>",
    "      </publicationStmt>",
    "      <sourceDesc>",
    "        <msDesc>",
    "          <msIdentifier>",
  );
  if (msId.length > 0) lines.push(...msId);
  lines.push("          </msIdentifier>");
  if (msItem.length > 0) {
    lines.push(
      "          <msContents>",
      "            <msItem>",
      ...msItem,
      "            </msItem>",
      "          </msContents>",
    );
  }
  lines.push(
    "          <physDesc>",
    "            <objectDesc>",
    "              <supportDesc>",
    "                <support>parchment</support>",
    "              </supportDesc>",
    "            </objectDesc>",
    "          </physDesc>",
    "        </msDesc>",
    "      </sourceDesc>",
    "    </fileDesc>",
    "    <profileDesc>",
    "      <creation>",
  );
  if (creation.length > 0) lines.push(...creation);
  lines.push(
    "      </creation>",
    "      <langUsage>",
    '        <language ident="la">Latin</language>',
    "      </langUsage>",
    "      <textClass>",
    "        <keywords>",
  );
  lines.push(...kwTerms);
  lines.push(
    "        </keywords>",
    "      </textClass>",
    "    </profileDesc>",
    "  </teiHeader>",
    "  <text>",
    "    <body>",
  );
  if (bodyContent.length > 0) lines.push(...bodyContent);
  lines.push(
    "    </body>",
    "  </text>",
    "</TEI>",
  );

  return lines.join("\n");
}

/**
 * Generates a filename base like `instrumentum_venditionis_1318` from charter type and date.
 * The progressive number and .xml extension are appended by the API route.
 * Format: <type_id>_<year>
 */
export function buildFilename(data: FormSubmissionData): string {
  const charterType = data.charter_type || "unknown";
  const dateVal = data.fields["date_modern"];

  let year = "unknown";
  if (
    dateVal &&
    typeof dateVal === "object" &&
    "iso" in dateVal &&
    typeof (dateVal as DateFieldValue).iso === "string"
  ) {
    const iso = (dateVal as DateFieldValue).iso;
    const match = iso.match(/^(\d{4})/);
    if (match) year = match[1];
  }

  return `${charterType}_${year}`;
}
