/**
 * Entity graph types for the corpus knowledge graph visualization.
 */

export type EntityType = "person" | "clan" | "institution" | "document" | "document_type" | "place";

export type EdgeType = "signs" | "witnesses" | "notarizes" | "receives" | "has_type" | "created_in" | "belongs_to_clan" | "co_occurs";

export interface EntityNode {
  id: string;
  type: EntityType;
  label: string;
  /** For person nodes: roles they play across documents */
  roles?: string[];
  /** For person nodes: derived clan name, if any */
  clan?: string;
  /** For document nodes: ISO date string */
  date?: string;
  /** For document nodes: the document type label */
  docType?: string;
  /** For document nodes: archive repository name */
  archive?: string;
  /** For document nodes: source XML filename */
  fileId?: string;
  /** For clan nodes: number of people in this clan */
  memberCount?: number;
  /** For institution nodes: type of institution */
  instType?: string;
}

export interface EntityEdge {
  source: string;
  target: string;
  type: EdgeType;
}

export interface EntityGraph {
  nodes: EntityNode[];
  edges: EntityEdge[];
}
