import type {
  FormSubmissionData,
  FormSectionsConfig,
  WitnessEntry,
  PlaceEntry,
  DateFieldValue,
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

/** Get PlaceEntry[] value, or empty array. */
function getPlaceEntries(
  data: FormSubmissionData,
  fieldName: string,
): PlaceEntry[] {
  const val = data.fields[fieldName];
  if (Array.isArray(val) && val.length > 0 && typeof val[0] === "object" && "name" in val[0]) {
    return val as PlaceEntry[];
  }
  return [];
}

/**
 * Build a diploPart with optional @subtype and a <p> child.
 * Returns empty string if textContent is empty.
 */
function makeDiploPart(
  type: string,
  textContent: string,
  subtype?: string,
  indent = "        ",
): string {
  if (isEmpty(textContent)) return "";
  const subtypeAttr = subtype ? ` subtype="${esc(subtype)}"` : "";
  return (
    `${indent}<diploPart type="${esc(type)}"${subtypeAttr}>\n` +
    `${indent}  <p>${esc(textContent)}</p>\n` +
    `${indent}</diploPart>`
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
 * Derive a short charter code from a charter type ID.
 * Multi-word IDs (underscore-separated): first letter of each word.
 * Single-word IDs: first two letters.
 */
export function deriveCharterCode(typeId: string): string {
  const parts = typeId.split("_");
  if (parts.length >= 2) {
    return parts.map((p) => p[0]).join("").toLowerCase();
  }
  return typeId.slice(0, 2).toLowerCase();
}

/**
 * Generate the complete TEI P5 XML document from form submission data.
 * Builds a diplomatic formulary with optional full text div.
 * @param docId Optional document ID (filename stem) for xml:id on <TEI> root.
 */
export function generateTeiXml(
  data: FormSubmissionData,
  config: FormSectionsConfig,
  docId?: string,
): string {
  const I = (n: number) => "  ".repeat(n); // indentation helper

  // Look up charter type config
  const charterTypeConfig = config.types.find((t) => t.id === data.charter_type);

  // ── teiHeader lines ──

  // titleStmt
  const authorName = getStr(data, "intitulatio_analysis");
  const titleStmt: string[] = [];
  titleStmt.push(`${I(4)}<title>${esc(charterTypeConfig?.label || data.charter_type)}</title>`);
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
  const recipientName = getStr(data, "inscriptio_analysis");
  const notaryName = getStr(data, "completio_analysis");
  const msItem: string[] = [];
  if (recipientName) {
    msItem.push(`${I(7)}<recipient>${esc(recipientName)}</recipient>`);
  }
  if (notaryName) {
    msItem.push(
      `${I(7)}<respStmt>\n` +
        `${I(8)}<resp>notary</resp>\n` +
        `${I(8)}<name type="completio_analysis">${esc(notaryName)}</name>\n` +
        `${I(7)}</respStmt>`,
    );
  }

  // creation
  const dateVal = getVal(data, "datatio_chronica_analysis");
  const locusRedactionis = getPlaceEntries(data, "datatio_topica_analysis");
  const creation: string[] = [];
  if (dateVal && typeof dateVal === "object" && "iso" in dateVal) {
    const dv = dateVal as DateFieldValue;
    const text = dv.iso;
    if (!isEmpty(dv.iso) || !isEmpty(text)) {
      creation.push(
        `${I(4)}<date when="${esc(dv.iso)}">${esc(text)}</date>`,
      );
    }
  }
  for (const place of locusRedactionis) {
    if (isEmpty(place.name)) continue;
    creation.push(
      `${I(4)}<term type="datatio_topica_analysis">${esc(place.name)}</term>`,
    );
  }

  // keywords
  const kwFields: [string, string][] = [
    ["intitulatio_analysis", "intitulatio_analysis"],
    ["inscriptio_analysis", "inscriptio_analysis"],
    ["pretium", "price"],
    ["property_location", "property_location"],
    ["datatio_topica_analysis", "datatio_topica_analysis"],
    ["subscriptio_emittentis_analysis", "subscriptio_emittentis_analysis"],
  ];
  const kwTerms: string[] = [];
  if (charterTypeConfig?.object_value) {
    kwTerms.push(`${I(5)}<term type="object">${esc(charterTypeConfig.object_value)}</term>`);
  }
  if (charterTypeConfig?.object_subtype_value) {
    kwTerms.push(`${I(5)}<term type="object_subtype">${esc(charterTypeConfig.object_subtype_value)}</term>`);
  }
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
  const invocatioTypeVal = getVal(data, "invocatio_analysis");
  const invocatioType = Array.isArray(invocatioTypeVal)
    ? (invocatioTypeVal as string[]).join(" ")
    : typeof invocatioTypeVal === "string" ? invocatioTypeVal : "";
  if (invocatioText) {
    protocolChildren.push(
      invocatioType
        ? `        <diploPart type="invocatio" subtype="${esc(invocatioType)}">\n          <p>${esc(invocatioText)}</p>\n        </diploPart>`
        : `        <diploPart type="invocatio">\n          <p>${esc(invocatioText)}</p>\n        </diploPart>`,
    );
  }
  const dcDiv = makeDiploPart("datatio", getStr(data, "datatio_chronica_text"), "chronica");
  if (dcDiv) protocolChildren.push(dcDiv);

  const protocolDiv = makeDivContainer("protocol", protocolChildren);
  const protocolContent = protocolDiv ? [protocolDiv] : [];

  // Contextus
  const contextusChildren: string[] = [];
  // [divType, fieldId, subtypeField?, staticSubtype?]
  // staticSubtype provides a hardcoded subtype when no form field supplies one.
  const textusDivs: [string, string, string?, string?][] = [
    ["intitulatio", "intitulatio_text"],
    ["dispositio", "dispositio_text"],
    ["inscriptio", "inscriptio_text"],
    ["clausulae", "perpetuitatis_text", undefined, "perpetuitatis"],
    ["dispositio", "descriptio_rei_text", "descriptio_rei_analysis"],
    ["clausulae", "de_servitute_itineris_text", undefined, "de_servitute_itineris"],
    ["clausulae", "integritatis_rei_text", undefined, "integritatis_rei"],
    ["clausulae", "quietantiae_pretii_text", undefined, "quietantiae_pretii"],
    ["clausulae", "confinium_text", undefined, "confinium"],
    ["clausulae", "mensurarum_text", undefined, "mensurarum"],
    ["clausulae", "translationis_iuris_text", undefined, "translationis_iuris"],
    ["clausulae", "liberi_gaudii_text", undefined, "liberi_gaudii"],
    ["clausulae", "legitimae_defensionis_text", undefined, "legitimae_defensionis"],
    ["sanctio", "sanctio_text", "sanctio_analysis"],
  ];
  for (const [divType, fieldId, subtypeField, staticSubtype] of textusDivs) {
    const text = getStr(data, fieldId);
    const subtype = staticSubtype ?? (subtypeField ? getStr(data, subtypeField) : undefined);
    const div = makeDiploPart(divType, text, subtype);
    if (div) contextusChildren.push(div);
  }
  const contextusDiv = makeDivContainer("contextus", contextusChildren, undefined, "      ");
  const contextusContent = contextusDiv ? [contextusDiv] : [];

  // Full text (before protocol, but protocol may already be present)
  const fullTextContent = getStr(data, "full_text");
  let fullTextDiv = "";
  if (fullTextContent) {
    fullTextDiv = makeDiploPart("full_text", fullTextContent, undefined, "      ");
  }

  // Eschatocol
  const eschatocolChildren: string[] = [];
  const dtDiv = makeDiploPart("datatio", getStr(data, "datatio_topica_text"), "topica");
  if (dtDiv) eschatocolChildren.push(dtDiv);

  // Subscriptions
  const subscriptioChildren: string[] = [];
  const subTestiumDiv = makeDiploPart(
    "subscriptio",
    getStr(data, "subscriptiones_testium_text"),
    "testium",
    "          ",
  );
  if (subTestiumDiv) subscriptioChildren.push(subTestiumDiv);
  const emittensName = getStr(data, "subscriptio_emittentis_text");
  const emittensType = getStr(data, "subscriptio_emittentis_analysis");
  if (emittensName || emittensType) {
    const subtypeAttr = emittensType ? ` subtype="${esc(emittensType)}"` : "";
    if (emittensName) {
      subscriptioChildren.push(
        `          <diploPart type="subscriptio"${subtypeAttr}>\n` +
        `            <name>${esc(emittensName)}</name>\n` +
        `          </diploPart>`,
      );
    } else {
      subscriptioChildren.push(
        `          <diploPart type="subscriptio"${subtypeAttr} />`,
      );
    }
  }
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
    subscriptioChildren.push(
      `          <listWitness>\n` +
        witnessLines.join("\n") +
        `\n          </listWitness>`,
    );
  }

  const completioDiv = makeDiploPart("subscriptio", getStr(data, "completio_text"), "completio", "          ");
  if (completioDiv) subscriptioChildren.push(completioDiv);

  const subscriptioDiv = makeDivContainer("subscriptio", subscriptioChildren, undefined, "        ");
  if (subscriptioDiv) eschatocolChildren.push(subscriptioDiv);

  const eschatocolDiv = makeDivContainer("eschatocol", eschatocolChildren, undefined, "      ");
  const eschatocolContent = eschatocolDiv ? [eschatocolDiv] : [];

  const bodyContent = [
    ...(fullTextDiv ? [fullTextDiv] : []),
    ...protocolContent,
    ...contextusContent,
    ...eschatocolContent,
  ];

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
    "        <p></p>",
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
 * Derive the charter code from form submission data.
 * The API route handles progressive numbering.
 */
export function buildFilename(data: FormSubmissionData): string {
  return deriveCharterCode(data.charter_type || "unknown");
}
