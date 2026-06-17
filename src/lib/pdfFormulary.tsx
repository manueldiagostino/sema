import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { CorpusItem } from "@/types/corpus";
import type { ExportSection, TeiSchema } from "@/types/schema";

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
  sectionTitle: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
    paddingBottom: 3,
  },
  fieldRow: {
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#666",
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 11,
    lineHeight: 1.5,
  },
  headerRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "bold",
    width: 120,
    color: "#555",
  },
  headerValue: {
    fontSize: 10,
    flex: 1,
  },
  headerContainer: {
    marginBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#333",
    paddingBottom: 10,
  },
});

/** Format a field value for display. */
function formatValue(value: string | string[] | undefined): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

/**
 * Resolve a human-readable label for a field.
 *
 * Priority: export.yaml `label` → TEI schema element `label` → raw field ID.
 */
function resolveLabel(
  fieldId: string,
  fieldLabel: string | undefined,
  schema: TeiSchema | undefined,
): string {
  if (fieldLabel) return fieldLabel;
  if (schema) {
    const elem = schema.elements[fieldId];
    if (elem?.label) return elem.label;
  }
  return fieldId;
}

interface FormularyPdfProps {
  item: CorpusItem;
  sections: ExportSection[];
  schema?: TeiSchema;
}

export default function FormularyPdf({ item, sections, schema }: FormularyPdfProps) {
  // Separate header section from body sections
  const headerSection = sections.find((s) => s.id === "header");
  const bodySections = sections.filter((s) => s.id !== "header");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header section — rendered as metadata rows */}
        {headerSection && (
          <View style={styles.headerContainer}>
            <Text style={styles.title}>
              {formatValue(item["intitulatio_analysis"] || item["id"])}
            </Text>
            {headerSection.fields.map((field) => {
              const value = formatValue(item[field.id]);
              if (!value) return null;
              return (
                <View key={field.id} style={styles.headerRow}>
                  <Text style={styles.headerLabel}>
                    {resolveLabel(field.id, field.label, schema)}:
                  </Text>
                  <Text style={styles.headerValue}>{value}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Body sections — protocol, contextus, eschatocol, fulltext */}
        {bodySections.map((section) => {
          if (section.type === "special") {
            // Special sections (e.g. fulltext) — render as standalone text
            return (
              <React.Fragment key={section.id}>
                {section.fields.map((field) => {
                  const value = formatValue(item[field.id]);
                  if (!value) return null;
                  return (
                    <View key={field.id} style={styles.fieldRow}>
                      <Text style={styles.sectionTitle}>
                        {resolveLabel(field.id, field.label, schema) || section.label}
                      </Text>
                      <Text style={styles.fieldValue}>{value}</Text>
                    </View>
                  );
                })}
              </React.Fragment>
            );
          }

          // Normal section — iterates fields
          return (
            <React.Fragment key={section.id}>
              <Text style={styles.sectionTitle}>{section.label}</Text>
              {section.fields.map((field) => {
                const value = formatValue(item[field.id]);
                if (!value) return null;
                return (
                  <View key={field.id} style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>
                      {resolveLabel(field.id, field.label, schema)}
                    </Text>
                    <Text style={styles.fieldValue}>{value}</Text>
                  </View>
                );
              })}
            </React.Fragment>
          );
        })}
      </Page>
    </Document>
  );
}
