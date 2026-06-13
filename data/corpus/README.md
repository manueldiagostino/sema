# Corpus Encoding Reference

The XML files in this directory encode medieval charters using **TEI P5** with the **CEI2TEI** standard (Charter Encoding Initiative → TEI). This is the de facto encoding standard for medieval charters, used by Monasterium.net and the VID (Vocabulaire International de la Diplomatique).

## Element Types

| Element | Purpose |
|---|---|
| `<div type="...">` | Structural container (groups diplomatic sections) |
| `<diploPart type="...">` | Individual diplomatic section |
| `<p>` | Transcribed text content within a diplomatic section |
| `<term type="...">` | Formulary analysis keyword in the TEI header |

## `diploPart[@type]` Values (CEI2TEI)

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

## `@subtype` Values

Subtypes distinguish sub-parts within a shared CEI2TEI type. All values are underscore-joined single tokens (valid `teidata.enumerated`).

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
    <diploPart type="invocatio" subtype="symbolico_verbalis">
      <p>In nomine sancte et individue Trinitatis.</p>
    </diploPart>
    <diploPart type="datatio" subtype="chronica">
      <p>Anno Domini millesimo centesimo trigesimo sexto...</p>
    </diploPart>
  </div>

  <!-- Contextus: main body of the charter -->
  <div type="contextus">
    <diploPart type="intitulatio">
      <p>Constat me quidem Iohannesbonus...</p>
    </diploPart>
    <diploPart type="dispositio">
      <p>presenti die vendo et huius rei gratia trado tibi</p>
    </diploPart>
    <diploPart type="inscriptio">
      <p>Bonofantino, accipienti in honore Dei...</p>
    </diploPart>
    <diploPart type="clausulae" subtype="perpetuitatis">
      <p>in perpetuum,</p>
    </diploPart>
    <diploPart type="dispositio" subtype="descriptio_rei">
      <p>peciam unam terræ aratorie...</p>
    </diploPart>
    <diploPart type="clausulae" subtype="confinium">
      <p>Confines vero eius a totis quattuor lateribus...</p>
    </diploPart>
    <diploPart type="sanctio" subtype="dupli_pena">
      <p>Et si ego vel mei heredes...</p>
    </diploPart>
  </div>

  <!-- Eschatocol: closing diplomatic parts -->
  <div type="eschatocol">
    <diploPart type="datatio" subtype="topica">
      <p>Actum in burgo Sancti Donati...</p>
    </diploPart>
    <div type="subscriptio">
      <diploPart type="subscriptio" subtype="emittens" />
      <listWitness>
        <witness ana="#investitor"><name>Petrus de Teutio</name></witness>
        <witness><name>Ambrosius filius Dominice</name></witness>
      </listWitness>
      <diploPart type="subscriptio" subtype="completio">
        <p>Ego Gerardus tabellio hoc venditionis instrumentum... scripsi et conplevi.</p>
      </diploPart>
    </div>
  </div>
</body>
```

## Header Keywords (`term[@type]`)

Formulary analysis values are stored in `<teiHeader>/<profileDesc>/<textClass>/<keywords>`:

| `@type` Value | Content |
|---|---|
| `object` | Charter type label (e.g. "Instrumentum venditionis") |
| `object_subtype` | Charter subtype (e.g. "Venditio") |
| `intitulatio_analysis` | Normalized author name |
| `inscriptio_analysis` | Normalized recipient name |
| `datatio_topica_analysis` | Place of redaction |
| `subscriptio_emittentis_analysis` | Emittens role (auctor/destinatarius) |
| `property_location` | Property location |
| `price` | Price paid |

## Project Extensions

- **Split `datatio`**: CEI2TEI uses a single `datatio` type. This project splits it into `@subtype="chronica"` (protocol section) and `@subtype="topica"` (eschatocol section) because they appear in different parts of the document.

- **`diploPart` without CEI2TEI ODD**: Standard TEI validators won't recognize `<diploPart>` unless the CEI2TEI ODD is loaded. XPath and DOM parsing work fine. If schema validation is added later, include the CEI2TEI ODD.

## Related Files

| File | Purpose |
|---|---|
| `config/form-sections.yaml` | Admin form field definitions and TEI element mappings |
| `config/columns.yaml` | Corpus table column definitions with XPath selectors |
| `src/lib/xmlBuilder.ts` | TEI XML generation from form data |
| `.opencode/knowledge/cei2tei-reference.md` | Full reference with field ID mappings |
