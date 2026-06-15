# Corpus Encoding Reference

The XML files in this directory encode medieval charters using **standard TEI P5** elements. The encoding uses `<ab>` (anonymous block) for diplomatic clauses instead of the non-standard CEI2TEI `<diploPart>`, and `<listPerson>/<person>` for witness lists instead of the text-critical `<listWitness>/<witness>`.

## Element Types

| Element | Purpose |
|---|---|
| `<div type="...">` | Structural container (groups diplomatic sections) |
| `<ab type="...">` | Individual diplomatic clause (anonymous block) |
| `<persName>` | Personal name (testimoni, notaio, issuer) |
| `<placeName type="...">` | Place name in `<creation>` |
| `<term type="...">` | Keyword in `<textClass>/<keywords>` (topic classification only) |

## `ab[@type]` Values

| Type | VID | Description |
|---|---|---|
| `invocatio` | VID 185 | Opening invocation |
| `datatio` | VID 561 | Dating formula (split by `@subtype`) |
| `intitulatio` | VID 187 | Author/seller context |
| `inscriptio` | VID 192 | Recipient/buyer context |
| `dispositio` | VID 198 | Dispositive content (verba dispositiva + descriptio rei) |
| `clausulae` | — | Generic clause container (distinguished by `@subtype`) |
| `sanctio` | VID 237 | Sanction/penalty clause |
| `subscriptio` | VID 254 | Subscriptions (emittens, testium, completio) |
| `full_text` | — | Complete diplomatic text (single block) |

## `@subtype` Values

Subtypes distinguish sub-parts within a shared type. All values are underscore-joined single tokens (valid `teidata.word`).

### Under `datatio`

| Subtype | Meaning |
|---|---|
| `chronica` | Chronological dating (protocol section) |
| `topica` | Topical dating (eschatocol section) |

### Under `dispositio`

| Subtype | Meaning |
|---|---|
| `descriptio_rei` | Property description (sub-part of dispositive content) |

### Under `clausulae`

| Subtype | Description |
|---|---|
| `perpetuitatis` | Clausula perpetuitatis (perpetuity clause) |
| `de_servitute_itineris` | Clausula de servitute itineris (right of way) |
| `integritatis_rei` | Clausula integritatis rei (integrity of property) |
| `quietantiae_pretii` | Clausula quietantiae pretii (receipt of price) |
| `confinium` | Formula confinium (boundary description) |
| `mensurarum` | Formula mensurarum (measurements) |
| `translationis_iuris` | Formula translationis iuris (transfer of rights) |
| `liberi_gaudii` | Formula liberi gaudii (free enjoyment) |
| `legitimae_defensionis` | Formula legitimae defensionis (legitimate defense) |

### Under `subscriptio`

| Subtype | Description |
|---|---|
| `emittens` | Subscriptio emittentis (issuer's signature) |
| `testium` | Subscriptiones testium (witness signatures) |
| `completio` | Completio (notary's completion statement) |

### Under `invocatio`

| Subtype | Meaning |
|---|---|
| `symbolica` | Symbolic invocation (e.g. cross, chrismon) |
| `verbalis` | Verbal invocation (e.g. "In nomine...") |
| `symbolico_verbalis` | Combined symbolic + verbal |

### Under `sanctio`

| Subtype | Meaning |
|---|---|
| `dupli_pena` | Penalty of double |
| `pecunia_numerata` | Numbered pecunia |

## Body Structure

```xml
<body>
  <!-- Protocol: opening diplomatic parts -->
  <div type="protocol">
    <ab type="invocatio" subtype="symbolico_verbalis">
      In nomine sancte et individue Trinitatis.
    </ab>
    <ab type="datatio" subtype="chronica">
      Anno Domini millesimo centesimo trigesimo sexto...
    </ab>
  </div>

  <!-- Contextus: main body of the charter -->
  <div type="contextus">
    <ab type="intitulatio">
      Constat me quidem Iohannesbonus...
    </ab>
    <ab type="dispositio">
      presenti die vendo et huius rei gratia trado tibi
    </ab>
    <ab type="inscriptio">
      Bonofantino, accipienti in honore Dei...
    </ab>
    <ab type="clausulae" subtype="perpetuitatis">
      in perpetuum,
    </ab>
    <ab type="dispositio" subtype="descriptio_rei">
      peciam unam terræ aratorie...
    </ab>
    <ab type="clausulae" subtype="confinium">
      Confines vero eius a totis quattuor lateribus...
    </ab>
    <ab type="sanctio" subtype="dupli_pena">
      Et si ego vel mei heredes...
    </ab>
  </div>

  <!-- Eschatocol: closing diplomatic parts -->
  <div type="eschatocol">
    <ab type="datatio" subtype="topica">
      Actum in burgo Sancti Donati...
    </ab>
    <div type="subscriptio">
      <ab type="subscriptio" subtype="testium">
        Taurellus de Villola, Petrus de Teutio... rogati sunt testes.
      </ab>
      <listPerson>
        <person role="witness"><persName>Taurellus de Villola</persName></person>
        <person role="issuer"><persName>Petrus de Teutio</persName></person>
        <person role="witness"><persName>Ambrosius filius Dominice</persName></person>
      </listPerson>
      <ab type="subscriptio" subtype="completio">
        Ego Gerardus tabellio hoc venditionis instrumentum... scripsi et conplevi.
      </ab>
    </div>
  </div>
</body>
```

## Header Structure

### titleStmt

The issuer (`intitulatio_analysis`) is encoded as `<author>` in `<titleStmt>`:

```xml
<titleStmt>
  <title>Instrumentum venditionis</title>
  <author role="issuer"><persName>Petrus Rex Castellae</persName></author>
</titleStmt>
```

### creation

Place of redaction uses `<placeName>` instead of `<term>`:

```xml
<creation>
  <date when="1205-04-01">1205-04-01</date>
  <placeName type="datatio_topica_analysis">Burgos</placeName>
</creation>
```

### keywords (topic classification only)

Only topic-classification values remain in `<keywords>`. Metadata about issuer/recipient lives in `<titleStmt>`, not `<keywords>`:

| `@type` Value | Content |
|---|---|
| `object` | Charter type label (e.g. "Instrumentum venditionis") |
| `object_subtype` | Charter subtype (e.g. "Venditio") |
| `datatio_topica_analysis` | Place of redaction |
| `subscriptio_emittentis_analysis` | Emittens role (auctor/destinatarius) |
| `property_location` | Property location |
| `price` | Price paid |

## Witness Encoding

Witness lists use `<listPerson>` with `<person>` elements and `@role` attributes. The `<persName>` element replaces the generic `<name>` for personal names:

| Element | Purpose |
|---|---|
| `<listPerson>` | Container for all persons in the document |
| `<person role="witness">` | A witness to the legal act |
| `<person role="issuer">` | The issuer (investitor) |
| `<persName>` | Personal name of the person |
| `<respStmt>` | Statement of responsibility (e.g. notary) |

## Migrated from CEI2TEI

This corpus was migrated from the CEI2TEI format. Key changes:

| Old (CEI2TEI) | New (TEI P5) |
|---|---|
| `<diploPart type="X"><p>T</p></diploPart>` | `<ab type="X">T</ab>` |
| `<listWitness>` | `<listPerson>` |
| `<witness ana="#investitor">` | `<person role="issuer">` |
| `<witness>` | `<person role="witness">` |
| `<name>` (in person context) | `<persName>` |
| `<term type="datatio_topica_analysis">` | `<placeName type="datatio_topica_analysis">` |
| `<recipient>` in msItem | Removed (element not in TEI P5) |
| `<term type="intitulatio_analysis">` in keywords | `<author role="issuer"><persName>` in titleStmt |
| `<p></p>` in publicationStmt | `<p>Encoded by Sema TEI Corpus Explorer</p>` |

## Related Files

| File | Purpose |
|---|---|
| `config/tei-schema/_base.yaml` | TEI element definitions, XPath mappings, and field types |
| `config/tei-schema/_patterns.yaml` | Dynamic pattern definitions for extensible elements |
| `config/views/table-home.yaml` | Corpus table column visibility, order, and render config |
| `config/views/card.yaml` | Document card header and tab layout |
| `config/views/form-base.yaml` | Admin form field layout and sections |
| `config/views/export.yaml` | PDF/TXT export section definitions |
| `src/lib/xmlBuilder.ts` | TEI XML generation from form data |
| `src/lib/xmlParser.ts` | TEI XML to form data extraction |
| `scripts/build-corpus.ts` | Corpus metadata JSON generation |
| `scripts/build-entity-graph.ts` | Knowledge graph generation from TEI XML |
| `scripts/migrate-to-p5.ts` | CEI2TEI → TEI P5 migration script |
