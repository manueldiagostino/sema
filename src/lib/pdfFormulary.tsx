import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: "#555",
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 3,
  },
  clause: {
    marginBottom: 10,
    lineHeight: 1.5,
  },
  clauseLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 2,
  },
  clauseText: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  metadataRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  metadataLabel: {
    fontSize: 10,
    fontWeight: "bold",
    width: 120,
    color: "#555",
  },
  metadataValue: {
    fontSize: 10,
    flex: 1,
  },
  header: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
});

interface Clause {
  type: string;
  subtype?: string;
  content: string;
}

function parseClauses(xmlContent: string): Clause[] {
  const clauses: Clause[] = [];
  const divRegex = /<(?:div|diploPart)\s+type="([^"]+)"(?:\s+subtype="([^"]*)")?[^>]*>\s*<p>([\s\S]*?)<\/p>\s*<\/(?:div|diploPart)>/g;
  let match;
  while ((match = divRegex.exec(xmlContent)) !== null) {
    clauses.push({
      type: match[1],
      subtype: match[2] || undefined,
      content: match[3].trim(),
    });
  }
  return clauses;
}

function extractTitle(xmlContent: string): string {
  const titleMatch = /<title>([^<]+)<\/title>/.exec(xmlContent);
  return titleMatch ? titleMatch[1].trim() : "Unknown Document";
}

function extractField(xmlContent: string, field: string): string {
  const patterns: Record<string, RegExp> = {
    repository: /<repository>([^<]+)<\/repository>/,
    shelfmark: /<idno>([^<]+)<\/idno>/,
    author: /<author>([^<]+)<\/author>/,
    recipient: /<recipient>([^<]+)<\/recipient>/,
    date: /<date[^>]*>([^<]*)<\/date>/,
    notary: /<name>([^<]+)<\/name>/,
    origPlace: /<origPlace>([^<]+)<\/origPlace>/,
  };
  const regex = patterns[field];
  if (!regex) return "";
  const match = regex.exec(xmlContent);
  return match ? match[1].trim() : "";
}

const typeLabels: Record<string, string> = {
  invocatio: "Invocatio",
  datatio: "Datatio",
  intitulatio: "Auctor",
  dispositio: "Verba dispositiva",
  inscriptio: "Destinatarius",
  clausulae: "Clausulae",
  sanctio: "Sanctio",
  subscriptio: "Subscriptio",
  completio: "Completio",
};

export default function FormularyPdf({ xmlContent }: { xmlContent: string }) {
  const title = extractTitle(xmlContent);
  const repository = extractField(xmlContent, "repository");
  const shelfmark = extractField(xmlContent, "shelfmark");
  const author = extractField(xmlContent, "author");
  const recipient = extractField(xmlContent, "recipient");
  const date = extractField(xmlContent, "date");
  const notary = extractField(xmlContent, "notary");
  const origPlace = extractField(xmlContent, "origPlace");

  const clauses = parseClauses(xmlContent);

  // Group clauses by parent section
  const protocolClauses = clauses.filter((c) =>
    ["invocatio"].includes(c.type) || (c.type === "datatio" && c.subtype === "chronica"),
  );
  const textusClauses = clauses.filter(
    (c) =>
      !["invocatio", "datatio", "subscriptio"].includes(c.type) && c.type !== "full_text",
  );
  const eschatocolClauses = clauses.filter((c) =>
    (c.type === "datatio" && c.subtype === "topica") || c.type === "subscriptio",
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Repository:</Text>
            <Text style={styles.metadataValue}>{repository || "—"}</Text>
          </View>
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Shelfmark:</Text>
            <Text style={styles.metadataValue}>{shelfmark || "—"}</Text>
          </View>
          {author && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Author:</Text>
              <Text style={styles.metadataValue}>{author}</Text>
            </View>
          )}
          {recipient && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Recipient:</Text>
              <Text style={styles.metadataValue}>{recipient}</Text>
            </View>
          )}
          {date && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Date:</Text>
              <Text style={styles.metadataValue}>{date}</Text>
            </View>
          )}
          {origPlace && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Place:</Text>
              <Text style={styles.metadataValue}>{origPlace}</Text>
            </View>
          )}
          {notary && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Notary:</Text>
              <Text style={styles.metadataValue}>{notary}</Text>
            </View>
          )}
        </View>

        {/* Protocol */}
        {protocolClauses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Protocol</Text>
            {protocolClauses.map((clause, i) => (
              <View key={`proto-${i}`} style={styles.clause}>
                <Text style={styles.clauseLabel}>
                  {typeLabels[clause.type] || clause.type}
                  {clause.subtype ? ` (${clause.subtype})` : ""}
                </Text>
                <Text style={styles.clauseText}>{clause.content}</Text>
              </View>
            ))}
          </>
        )}

        {/* Textus */}
        {textusClauses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Text</Text>
            {textusClauses.map((clause, i) => (
              <View key={`text-${i}`} style={styles.clause}>
                <Text style={styles.clauseLabel}>
                  {typeLabels[clause.type] || clause.type}
                  {clause.subtype ? ` (${clause.subtype})` : ""}
                </Text>
                <Text style={styles.clauseText}>{clause.content}</Text>
              </View>
            ))}
          </>
        )}

        {/* Eschatocol */}
        {eschatocolClauses.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Eschatocol</Text>
            {eschatocolClauses.map((clause, i) => (
              <View key={`esch-${i}`} style={styles.clause}>
                <Text style={styles.clauseLabel}>
                  {typeLabels[clause.type] || clause.type}
                  {clause.subtype ? ` (${clause.subtype})` : ""}
                </Text>
                <Text style={styles.clauseText}>{clause.content}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
