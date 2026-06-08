/**
 * Data pools for generating fake medieval charter data.
 * All names, places, and templates are based on historical Bologna-area sources.
 */

// --- Author names (given name, relationship patronymic toponymic) ---

export const AUTHOR_NAMES: readonly string[] = [
  "Albertus, filius quondam Guidonis de Açon",
  "Gerardus, nepos quondam Albertini de Crevalcore",
  "Iohannes, heres Ugonis de Sablono",
  "Bonacursus, filius quondam Iohannis de Crepacorio",
  "Martinus, germanus quondam Alberti de Padua",
  "Petrus, filius quondam Bonaventure de Sancto Iohanne",
  "Raynaldus, filius quondam Ubertini de Persiceto",
  "Uguicio, frater quondam Henrici de Monteveglio",
  "Iacobinus, nepos quondam Guizardi de Castrofranco",
  "Aldrevandinus, filius quondam Bonacursi de Flesso",
  "Nicholaus, filius quondam Gerardi de Savignano",
  "Guido, heres quondam Albertini de Montebello",
  "Lanfrancus, filius quondam Lanfranci de Rovigo",
  "Bonincontrus, germanus quondam Guidonis de Casalecchio",
  "Fredericus, filius quondam Petri de Meledulo",
  "Michael, nepos quondam Uberti de Sancto Petro",
  "Rolandinus, filius quondam Alberti de Solario",
  "Matheus, frater quondam Iohannis de Anzola",
  "Azo, heres quondam Guidonis de Lamola",
  "Simon, filius quondam Rainaldi de Zola",
  "Ubertinus, nepos quondam Federici de Calcaria",
  "Ventura, germanus quondam Petri de Vallibus",
] as const;

// --- Place names (Bologna-area medieval places) ---

export const PLACE_NAMES: readonly string[] = [
  "Bononie",
  "in capella Sancti Proculi",
  "in burgo Sancti Stephani",
  "in capella Sancte Marie Maioris",
  "in capella Sancti Donati",
  "in curia Casalecchii",
  "in curia Montisveglij",
  "in castro Sancti Iohannis in Persiceto",
  "in curia Crepacorii",
  "in civitate Bononie",
  "apud ecclesiam Sancti Petri",
  "in strata Sancti Donati",
  "in burgo Sancti Felicis",
  "in capella Sancte Cecilie",
] as const;

// --- Notary names (with "tabellio" suffix) ---

export const NOTARY_NAMES: readonly string[] = [
  "Albertinus quondam Iohannis tabellio",
  "Bonaventura quondam Guidonis tabellio",
  "Iohannes quondam Petri tabellio",
  "Gerardus quondam Alberti tabellio",
  "Rolandinus quondam Bonacursi tabellio",
  "Guizardus filius quondam Gerardi tabellio",
  "Uguicio quondam Iacobini tabellio",
  "Albertus quondam Nicholai tabellio",
  "Bartholomeus filius quondam Raynaldi tabellio",
  "Symon quondam Ubertini tabellio",
] as const;

// --- Witness names (shorter format) ---

export const WITNESS_NAMES: readonly string[] = [
  "Albertinus de Sancto Petro",
  "Iohannes de Lamola",
  "Petrus de Calcaria",
  "Guido de Anzola",
  "Bonacursus de Flesso",
  "Nicholaus de Sablono",
  "Michael de Rovigo",
  "Henricus de Crevalcore",
  "Ubertinus de Persiceto",
  "Iacobinus de Sancto Iohanne",
  "Gerardus de Casalecchio",
  "Aldrevandinus de Padua",
  "Raynaldus de Monteveglio",
  "Fredericus de Meledulo",
  "Lanfrancus de Castrofranco",
  "Simon de Solario",
  "Matheus de Zola",
  "Ventura de Bononie",
  "Rolandinus de Savignano",
  "Azo de Crepacorio",
  "Bonincontrus de Vallibus",
  "Bartholomeus de capella Sancti Proculi",
  "Albertus de burgo Sancti Stephani",
  "Uguicio de capella Sancti Donati",
  "Iohannes de burgo Sancti Felicis",
  "Petrus de strata Sancti Donati",
  "Guizardus de capella Sancte Marie Maioris",
  "Martinus de Montebello",
  "Thomas de Sancto Felice",
  "Dominicus de ecclesia Sancti Petri",
] as const;

// --- Repositories / Archives ---

export const REPOSITORIES: readonly string[] = [
  "Archivio di Stato di Bologna, Demaniale",
  "Archivio di Stato di Bologna, Corporazioni religiose soppresse",
  "Archivio Arcivescovile di Bologna",
  "Archivio Capitolare di San Pietro",
  "Collegio di Spagna, Archivio",
] as const;

// --- Protocol templates ---

export const PROTOCOL_TEMPLATES: {
  readonly invocatio: readonly string[];
  readonly datatio_chronica: readonly string[];
} = {
  invocatio: [
    "In nomine Domini nostri Iesu Christi, amen.",
    "In Christi nomine, amen. Anno Domini $YEAR.",
    "In nomine sancte et individue Trinitatis, amen.",
    "In nomine Patris et Filii et Spiritus Sancti, amen.",
  ],
  datatio_chronica: [
    "Anno Domini $YEAR, indictione $INDICTIO, die $DAY mensis $MONTH.",
    "Anno ab incarnatione Domini $YEAR, indictione $INDICTIO, $DAY $MONTH.",
    "In Christi nomine, anno eiusdem nativitatis $YEAR, indictione $INDICTIO.",
  ],
};

// --- Textus templates (body of the charter) ---

export const TEXTUS_TEMPLATES: {
  readonly author_context: readonly string[];
  readonly verba_dispositiva: readonly string[];
  readonly recipient_context: readonly string[];
  readonly property_description: readonly string[];
  readonly sanctio: readonly string[];
  readonly formula_confinium: readonly string[];
} = {
  author_context: [
    "Ibique $AUTHOR in nostra presentia constitutus, per se suosque heredes, iure proprio in perpetuum vendidit et tradidit $RECIPIENT [...]",
    "Cum $AUTHOR ad hec presentialiter accessisset, sponte et ex certa scientia vendidit atque concessit $RECIPIENT [...]",
    "$AUTHOR, in presentia testium infrascriptorum, per se et suos heredes vendidit, dedit et tradidit $RECIPIENT [...]",
  ],
  verba_dispositiva: [
    "unam petiam terre iuris sui, positam $PLACE, cui coheret ab uno latere via publica, ab alio $AUTHOR ipse, a tertio $RECIPIENT, a quarto fluvius Rhenus.",
    "integrum suum ius quod habet in una petia terre posita $PLACE, cum omnibus suis iuribus et pertinentiis.",
    "totum illud suum casamentum positum $PLACE, cum curia, orto et hedificiis superpositis.",
  ],
  recipient_context: [
    "Quam venditionem $RECIPIENT pro se suisque heredibus recepit et acceptavit, dans pro ea pretium infrascriptum.",
    "$RECIPIENT, emens pro se et suis heredibus, acceptavit dictam venditionem cum omnibus suprascriptis.",
    "Et $RECIPIENT eandem venditionem pro se suisque heredibus suscipiens, solvit pretium sicut inferius continetur.",
  ],
  property_description: [
    "Que petia terre iacet $PLACE et est pertice $SIZE, cum accessibus et egressibus suis.",
    "Dictum casamentum cum omnibus hedificiis, curte et pertinentibus suis positum $PLACE.",
    "Cuius rei mensura est perticarum $SIZE vel circa, cum omnibus iuribus et actionibus suis.",
  ],
  sanctio: [
    "Quod si quis contra hanc venditionem venire temptaverit, componat parti fidem servanti penam dupli valoris dicte rei, et hec venditio firma permaneat.",
    "Si quis autem hanc cartam venditionis infringere presumpserit, solvat penam $PENALTY librarum bononinorum, et nichilominus hec venditio in sua firmitate permaneat.",
    "Et ad hec omnia observanda obligavit $AUTHOR se suosque heredes et bona sua omnia presentia et futura.",
  ],
  formula_confinium: [
    "Ab una parte coheret $AUTHOR ipse, ab altera via publica, a tercia $RECIPIENT, a quarta fluvius.",
    "Cui coheret a mane via publica, a meridie heredes quondam $NEIGHBOR, a sera fluvius, a septentrione ortus communis.",
    "Quibus coheret ab oriente $AUTHOR ipse, ab occidente $RECIPIENT, a meridie strata publica, a septentrione fossatum commune.",
  ],
};

// --- Eschatocol templates (closing section) ---

export const ESCHATOCOL_TEMPLATES: {
  readonly datatio_topica: readonly string[];
  readonly completio: readonly string[];
  readonly testes_text: readonly string[];
} = {
  datatio_topica: [
    "Actum $PLACE, in domo $AUTHOR, presentibus testibus infrascriptis.",
    "Actum in civitate Bononie, in capella $PLACE, sub porticu domus $AUTHOR.",
    "Actum $PLACE, in curia episcopali, anno, indictione et die suprascriptis.",
  ],
  completio: [
    "Ego $NOTARIUS, imperiali auctoritate notarius, hiis omnibus interfui et hanc cartam rogatus scripsi et subscripsi.",
    "Et ego $NOTARIUS, notarius publicus, predictis interfui et rogatus scribere scripsi.",
    "Ego $NOTARIUS, notarius sacri palatii, hec omnia vidi et audivi et in hanc publicam formam redegi.",
  ],
  testes_text: [
    "Signa manuum suprascriptorum testium.",
    "Testes ibi fuerunt infrascripti, rogati et vocati.",
    "Presentibus testibus infrascriptis, ad hec specialiter vocatis et rogatis.",
  ],
};

// --- Helper function ---

/**
 * Replace all `$VAR_NAME` placeholders in a template string with values from `vars`.
 */
export function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\$(\w+)/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : match,
  );
}
