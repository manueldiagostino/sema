"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { EntityGraph, EntityNode, EntityEdge, EntityType } from "@/types/entity-graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EntityGraphViewProps {
  initialSelectedNode?: string;
  initialVisibleTypes?: string[];
  initialDateFrom?: string;
  initialDateTo?: string;
  initialDocFilter?: string[];
  onBackToTable: () => void;
  onStateChange: (state: {
    selectedNode?: string;
    visibleTypes?: string[];
    dateFrom?: string;
    dateTo?: string;
  }) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NODE_GROUPS: Record<EntityType, Record<string, unknown>> = {
  person: { color: { background: "#ea580c", border: "#c2410c" }, shape: "dot", size: 28, font: { color: "#fdba74", size: 20 } },
  clan: { color: { background: "#8b5cf6", border: "#7c3aed" }, shape: "diamond", size: 26, font: { color: "#c4b5fd", size: 20 } },
  institution: { color: { background: "#3b82f6", border: "#2563eb" }, shape: "square", size: 30, font: { color: "#93c5fd", size: 20 } },
  document: { color: { background: "#10b981", border: "#059669" }, shape: "square", size: 38, font: { color: "#6ee7b7", size: 20 } },
  document_type: { color: { background: "#6b7280", border: "#4b5563" }, shape: "hexagon", size: 22, font: { color: "#d1d5db", size: 20 } },
  place: { color: { background: "#14b8a6", border: "#0d9488" }, shape: "triangle", size: 26, font: { color: "#5eead4", size: 20 } },
};

const ALL_TYPES: EntityType[] = ["person", "clan", "institution", "document", "document_type", "place"];

const TYPE_LABELS: Record<EntityType, string> = {
  person: "Person",
  clan: "Clan",
  institution: "Institution",
  document: "Document",
  document_type: "Document Type",
  place: "Place",
};

const NETWORK_OPTIONS = {
  physics: {
    enabled: true,
    solver: "barnesHut" as const,
    barnesHut: {
      gravitationalConstant: -2000,
      centralGravity: 0.3,
      springLength: 95,
      springConstant: 0.04,
      damping: 0.09,
    },
    stabilization: {
      enabled: true,
      iterations: 200,
      fit: true,
    },
  },
  interaction: {
    hover: true,
    tooltipDelay: 200,
    zoomView: true,
    dragView: true,
    dragNodes: true,
  },
  layout: {
    improvedLayout: true,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function getNeighborIds(nodeId: string, edges: EntityEdge[]): Set<string> {
  const neighbors = new Set<string>();
  for (const e of edges) {
    if (e.source === nodeId) neighbors.add(e.target);
    if (e.target === nodeId) neighbors.add(e.source);
  }
  return neighbors;
}

function getTwoHopIds(nodeId: string, edges: EntityEdge[]): Set<string> {
  const oneHop = getNeighborIds(nodeId, edges);
  const twoHop = new Set<string>([nodeId, ...oneHop]);
  for (const n of oneHop) {
    for (const e of edges) {
      if (e.source === n) twoHop.add(e.target);
      if (e.target === n) twoHop.add(e.source);
    }
  }
  return twoHop;
}

function getDocumentNodesInHop(nodeId: string, nodes: EntityNode[], edges: EntityEdge[]): EntityNode[] {
  const neighborIds = getNeighborIds(nodeId, edges);
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const docs: EntityNode[] = [];
  for (const nid of neighborIds) {
    const node = nodeMap.get(nid);
    if (node && node.type === "document") docs.push(node);
  }
  // Also check if the node itself is a document
  const self = nodeMap.get(nodeId);
  if (self && self.type === "document") docs.push(self);
  return docs;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EntityGraphView({
  initialSelectedNode,
  initialVisibleTypes,
  initialDateFrom,
  initialDateTo,
  initialDocFilter,
  onBackToTable,
  onStateChange,
}: EntityGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<unknown>(null);
  const nodesDataSetRef = useRef<unknown>(null);
  const edgesDataSetRef = useRef<unknown>(null);
  const allNodesRef = useRef<EntityNode[]>([]);
  const allEdgesRef = useRef<EntityEdge[]>([]);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeRef = useRef({
    foreground: "#ffffff",
    dimmed: "rgba(229,231,235,0.2)",
    edgeLabel: "#d1d5db",
  });

  // Local state
  const [graphData, setGraphData] = useState<EntityGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<string | undefined>(initialSelectedNode);
  const [visibleTypes, setVisibleTypes] = useState<string[]>(
    initialVisibleTypes && initialVisibleTypes.length > 0
      ? initialVisibleTypes
      : [...ALL_TYPES]
  );
  const [dateFrom, setDateFrom] = useState(initialDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initialDateTo ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [infoCard, setInfoCard] = useState<{
    label: string;
    type: EntityType;
    docCount: number;
    dateRange?: string;
  } | null>(null);

  // -----------------------------------------------------------------------
  // Sync state to URL (deferred via useEffect, NEVER during render)
  // -----------------------------------------------------------------------

  useEffect(() => {
    onStateChange({
      selectedNode,
      visibleTypes: visibleTypes.length < ALL_TYPES.length ? visibleTypes : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode, visibleTypes, dateFrom, dateTo]);

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  useEffect(() => {
    fetch("entity-graph.json")
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to load entity graph: ${res.status} ${res.statusText}`);
        }
        return res.json() as Promise<EntityGraph>;
      })
      .then((data) => {
        let filteredNodes = data.nodes;
        let filteredEdges = data.edges;

        if (initialDocFilter && initialDocFilter.length > 0) {
          const docFilterSet = new Set(initialDocFilter);
          // Find document nodes whose id is in the filter
          const docNodeIds = new Set<string>();
          for (const node of data.nodes) {
            if (node.type === "document" && docFilterSet.has(node.id)) {
              docNodeIds.add(node.id);
            }
          }
          // Collect all 1-hop neighbor IDs of those document nodes
          const allowedNodeIds = new Set<string>(docNodeIds);
          for (const edge of data.edges) {
            if (docNodeIds.has(edge.source)) {
              allowedNodeIds.add(edge.target);
            }
            if (docNodeIds.has(edge.target)) {
              allowedNodeIds.add(edge.source);
            }
          }
          // Filter nodes and edges
          filteredNodes = data.nodes.filter((n) => allowedNodeIds.has(n.id));
          filteredEdges = data.edges.filter(
            (e) => allowedNodeIds.has(e.source) && allowedNodeIds.has(e.target)
          );
        }

        setGraphData({ nodes: filteredNodes, edges: filteredEdges });
        allNodesRef.current = filteredNodes;
        allEdgesRef.current = filteredEdges;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load entity graph");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [initialDocFilter]);

  // -----------------------------------------------------------------------
  // Node interaction handlers
  // -----------------------------------------------------------------------

  const deselectAll = useCallback(() => {
    const network = networkRef.current as {
      unselectAll: () => void;
      setData: (data: Record<string, unknown>) => void;
    } | null;
    if (!network) return;

    const visNodes = nodesDataSetRef.current as {
      get: (id: string) => Record<string, unknown>;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
      getIds: () => string[];
    } | null;
    const visEdges = edgesDataSetRef.current as {
      getIds: () => string[];
      get: (id: string) => Record<string, unknown> | undefined;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
    } | null;

    if (!visNodes || !visEdges) return;

    // Restore all nodes to full opacity, unhide, remove glow, reset border in one batch
    const nodeIds = visNodes.getIds();
    const nodeUpdates: Record<string, unknown>[] = [];
    for (const id of nodeIds) {
      const node = visNodes.get(id);
      const group = node.group as EntityType;
      const groupColors = NODE_GROUPS[group]?.color as { background: string; border: string } | undefined;
      const groupFont = NODE_GROUPS[group]?.font as { color: string; size: number } | undefined;
      const baseSize = (NODE_GROUPS[group]?.size as number) || 20;
      nodeUpdates.push({
        id,
        hidden: false,
        size: baseSize,
        color: groupColors,
        borderWidth: 0,
        borderColor: groupColors?.border,
        shadow: false,
        font: groupFont || { color: themeRef.current.foreground, size: 20 },
      });
    }
    visNodes.update(nodeUpdates);

    // Restore all edges in one batch
    const edgeIds = visEdges.getIds();
    visEdges.update(edgeIds.map((id) => ({ id, hidden: false, color: { color: "#9ca3af" }, width: 2 })));

    network.unselectAll();
    setSelectedNode(undefined);
    setInfoCard(null);
  }, []);

  const handleNodeClick = useCallback((nodeId: string) => {
    const network = networkRef.current as {
      selectNodes: (ids: string[]) => void;
    } | null;
    const visNodes = nodesDataSetRef.current as {
      get: (id: string) => Record<string, unknown>;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
      getIds: () => string[];
    } | null;
    const visEdges = edgesDataSetRef.current as {
      getIds: () => string[];
      get: (id: string) => Record<string, unknown> | undefined;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
    } | null;

    if (!network || !visNodes || !visEdges) return;

    const nodes = allNodesRef.current;
    const edges = allEdgesRef.current;

    const neighborIds = getNeighborIds(nodeId, edges);
    const highlightIds = new Set([nodeId, ...neighborIds]);

    // Dim non-neighbor nodes in one batch
    const allNodeIds = visNodes.getIds();
    const nodeUpdates: Record<string, unknown>[] = [];
    const hollowColor = { background: "rgba(0,0,0,0)", border: "#6b7280" };
    for (const id of allNodeIds) {
      const node = visNodes.get(id);
      if (node.hidden === true) continue;
      const group = node.group as EntityType;
      const groupColors = NODE_GROUPS[group]?.color as { background: string; border: string } | undefined;
      const groupFont = NODE_GROUPS[group]?.font as { color: string; size: number } | undefined;
      const baseSize = (NODE_GROUPS[group]?.size as number) || 20;
      const isHighlighted = highlightIds.has(id);
      const ghostFontColor = hexToRgba(groupFont?.color || themeRef.current.foreground, 0.2);
      nodeUpdates.push({
        id,
        size: isHighlighted ? baseSize : Math.round(baseSize * 0.55),
        color: isHighlighted ? groupColors : hollowColor,
        font: {
          color: isHighlighted ? groupFont?.color || themeRef.current.foreground : ghostFontColor,
          size: 20,
        },
      });
    }
    visNodes.update(nodeUpdates);

    // Dim non-connected edges in one batch
    const connectedEdgeIds = new Set<string>();
    const edgeIds = visEdges.getIds();
    const edgeUpdates: Record<string, unknown>[] = [];
    for (const id of edgeIds) {
      const edge = visEdges.get(id) as Record<string, unknown> | undefined;
      if (!edge) continue;
      const from = edge.from as string;
      const to = edge.to as string;
      if (highlightIds.has(from) && highlightIds.has(to)) {
        connectedEdgeIds.add(id);
        edgeUpdates.push({ id, hidden: false, color: { color: "#9ca3af" }, width: 2 });
      } else {
        edgeUpdates.push({ id, hidden: false, color: { color: "rgba(156,163,175,0.25)" }, width: 1 });
      }
    }
    visEdges.update(edgeUpdates);

    // Glow effect on selected node
    visNodes.update({
      id: nodeId,
      borderWidth: 3,
      borderColor: themeRef.current.foreground,
      shadow: { enabled: true, color: hexToRgba(themeRef.current.foreground, 0.5), size: 15 },
    });

    network.selectNodes([nodeId]);

    // Build info card
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const clickedNode = nodeMap.get(nodeId);
    if (clickedNode) {
      const docs = getDocumentNodesInHop(nodeId, nodes, edges);
      const docDates = docs
        .map((d) => d.date)
        .filter(Boolean)
        .sort();
      const dateRange =
        docDates.length > 0
          ? `${docDates[0]}${docDates.length > 1 ? ` — ${docDates[docDates.length - 1]}` : ""}`
          : undefined;

      setInfoCard({
        label: clickedNode.label,
        type: clickedNode.type,
        docCount: docs.length,
        dateRange,
      });
    }

    setSelectedNode(nodeId);
  }, []);

  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const visNodes = nodesDataSetRef.current as {
      get: (id: string) => Record<string, unknown>;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
      getIds: () => string[];
    } | null;
    const visEdges = edgesDataSetRef.current as {
      getIds: () => string[];
      get: (id: string) => Record<string, unknown> | undefined;
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
    } | null;
    const network = networkRef.current as {
      focus: (id: string, opts: Record<string, unknown>) => void;
      selectNodes: (ids: string[]) => void;
    } | null;

    if (!visNodes || !visEdges || !network) return;

    const twoHopIds = getTwoHopIds(nodeId, allEdgesRef.current);
    const allNodeIds = visNodes.getIds();

    // Hide nodes outside 2-hop in one batch
    const nodeUpdates: Record<string, unknown>[] = [];
    for (const id of allNodeIds) {
      const node = visNodes.get(id);
      if (twoHopIds.has(id)) {
        const group = node.group as EntityType;
        const groupColors = NODE_GROUPS[group]?.color as { background: string; border: string } | undefined;
        const groupFont = NODE_GROUPS[group]?.font as { color: string; size: number } | undefined;
        const baseSize = (NODE_GROUPS[group]?.size as number) || 20;
        nodeUpdates.push({
          id,
          hidden: false,
          size: baseSize,
          color: groupColors,
          font: groupFont || { color: themeRef.current.foreground, size: 20 },
        });
      } else {
        nodeUpdates.push({ id, hidden: true });
      }
    }
    visNodes.update(nodeUpdates);

    // Hide edges outside 2-hop in one batch
    const edgeIds = visEdges.getIds();
    const edgeUpdates: Record<string, unknown>[] = [];
    for (const id of edgeIds) {
      const edge = visEdges.get(id) as Record<string, unknown> | undefined;
      if (!edge) continue;
      const from = edge.from as string;
      const to = edge.to as string;
      if (twoHopIds.has(from) && twoHopIds.has(to)) {
        edgeUpdates.push({ id, hidden: false });
      } else {
        edgeUpdates.push({ id, hidden: true });
      }
    }
    visEdges.update(edgeUpdates);

    // Glow effect on selected node
    visNodes.update({
      id: nodeId,
      borderWidth: 3,
      borderColor: themeRef.current.foreground,
      shadow: { enabled: true, color: hexToRgba(themeRef.current.foreground, 0.5), size: 15 },
    });

    network.focus(nodeId, { scale: 1.2, animation: { duration: 500, easingFunction: "easeInOutQuad" } });
    network.selectNodes([nodeId]);

    // Build info card (inlined to avoid redundant full-dim pass)
    const nodes = allNodesRef.current;
    const edges = allEdgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const clickedNode = nodeMap.get(nodeId);
    if (clickedNode) {
      const docs = getDocumentNodesInHop(nodeId, nodes, edges);
      const docDates = docs
        .map((d) => d.date)
        .filter(Boolean)
        .sort();
      const dateRange =
        docDates.length > 0
          ? `${docDates[0]}${docDates.length > 1 ? ` — ${docDates[docDates.length - 1]}` : ""}`
          : undefined;

      setInfoCard({
        label: clickedNode.label,
        type: clickedNode.type,
        docCount: docs.length,
        dateRange,
      });
    }

    setSelectedNode(nodeId);
  }, []);

  // -----------------------------------------------------------------------
  // vis-network initialization
  // -----------------------------------------------------------------------

  useEffect(() => {
    if (!graphData || !containerRef.current || graphData.nodes.length === 0) return;

    let destroyed = false;
    const data = graphData; // capture for async scope

    async function initNetwork() {
      const vis = await import("vis-network/standalone");

      if (destroyed || !containerRef.current) return;

      // Read theme foreground color from CSS variables at runtime
      const foreground =
        getComputedStyle(document.documentElement).getPropertyValue("--foreground").trim() || "#ffffff";
      themeRef.current = {
        foreground,
        dimmed: hexToRgba(foreground, 0.2),
        edgeLabel: hexToRgba(foreground, 0.6),
      };

      const visNodes = new vis.DataSet(
        data.nodes.map((n, i, arr) => {
          const base = {
            id: n.id,
            label: n.label,
            group: n.type,
            ...NODE_GROUPS[n.type],
          };

          // Position document nodes in a circle to create hub-and-spoke layout
          if (n.type === "document") {
            const docNodes = arr.filter((x) => x.type === "document");
            const docIndex = docNodes.findIndex((x) => x.id === n.id);
            const angle = (2 * Math.PI * docIndex) / docNodes.length;
            const radius = 800;
            return {
              ...base,
              x: Math.cos(angle) * radius,
              y: Math.sin(angle) * radius,
              fixed: { x: true, y: true },
            };
          }

          return base;
        })
      );

      const visEdges = new vis.DataSet(
        data.edges.map((e) => {
          const isCoOccurs = e.type === "co_occurs";
          return {
            id: `${e.source}-${e.target}`,
            from: e.source,
            to: e.target,
            label: isCoOccurs ? undefined : e.type,
            color: isCoOccurs ? "#d1d5db" : "#9ca3af",
            width: isCoOccurs ? 1 : 2,
            dashes: isCoOccurs ? [5, 5] : false,
            font: { size: 10, color: themeRef.current.edgeLabel, align: "top" },
            smooth: { enabled: true, type: "curvedCW", roundness: 0.15 },
          };
        })
      );

      nodesDataSetRef.current = visNodes;
      edgesDataSetRef.current = visEdges;

      const network = new vis.Network(
        containerRef.current,
        { nodes: visNodes, edges: visEdges },
        NETWORK_OPTIONS
      );

      networkRef.current = network;

      // Stop physics after stabilization
      network.once("afterDrawing", () => {
        // Physics will be stopped after stabilization event
      });

      network.on("stabilizationIterationsDone", () => {
        network.setOptions({ physics: { enabled: false } });
        // Unfix document nodes so users can drag them after layout settles
        const docIds = data.nodes
          .filter((n) => n.type === "document")
          .map((n) => n.id);
        visNodes.update(docIds.map((id) => ({ id, fixed: false })));
      });

      // -------------------------------------------------------------------
      // Deselect handler — fires whenever vis-network deselects a node
      // (including empty-canvas clicks). When the resulting selection is
      // empty, sync React state and restore visual styles.
      // -------------------------------------------------------------------
      network.on("deselectNode", (params: { nodes: string[] }) => {
        const remaining = (params && params.nodes) || [];
        if (remaining.length === 0) {
          if (clickTimeoutRef.current !== null) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }
          deselectAll();
        }
      });

      // -------------------------------------------------------------------
      // Click handler — debounced node selection
      // -------------------------------------------------------------------
      network.on("click", (params: { nodes: string[]; event: unknown }) => {
        if (!params.nodes || params.nodes.length === 0) return;

        // Debounce to distinguish from double-click
        if (clickTimeoutRef.current !== null) {
          clearTimeout(clickTimeoutRef.current);
        }
        clickTimeoutRef.current = setTimeout(() => {
          clickTimeoutRef.current = null;
          handleNodeClick(params.nodes[0]);
        }, 250);
      });

      // -------------------------------------------------------------------
      // Double-click handler — 2-hop neighborhood + recenter
      // -------------------------------------------------------------------
      network.on("doubleClick", (params: { nodes: string[] }) => {
        // Cancel pending single-click action
        if (clickTimeoutRef.current !== null) {
          clearTimeout(clickTimeoutRef.current);
          clickTimeoutRef.current = null;
        }
        if (params.nodes.length === 0) return;
        handleNodeDoubleClick(params.nodes[0]);
      });

      // Restore initial selection if provided
      if (initialSelectedNode) {
        handleNodeClick(initialSelectedNode);
      }
    }

    initNetwork();

    return () => {
      destroyed = true;
      if (networkRef.current) {
        try {
          (networkRef.current as { destroy: () => void }).destroy();
        } catch {
          // ignore
        }
        networkRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData]);

  // -----------------------------------------------------------------------
  // Filter application
  // -----------------------------------------------------------------------

  const applyFilters = useCallback(() => {
    const visNodes = nodesDataSetRef.current as {
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
      getIds: () => string[];
      get: (id: string) => Record<string, unknown>;
    } | null;
    const visEdges = edgesDataSetRef.current as {
      update: (item: Record<string, unknown> | Record<string, unknown>[]) => void;
      getIds: () => string[];
      get: (id: string) => Record<string, unknown>;
    } | null;

    if (!visNodes || !visEdges) return;

    const nodes = allNodesRef.current;
    const visibleNodeIds = new Set<string>();

    // Type filter
    for (const node of nodes) {
      if (visibleTypes.includes(node.type)) {
        visibleNodeIds.add(node.id);
      }
    }

    // Date range filter — hide documents outside range
    if (dateFrom || dateTo) {
      for (const node of nodes) {
        if (node.type === "document" && node.date) {
          if (dateFrom && node.date < dateFrom) {
            visibleNodeIds.delete(node.id);
          }
          if (dateTo && node.date > dateTo) {
            visibleNodeIds.delete(node.id);
          }
        }
      }
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const searchMatches = new Set<string>();
      for (const node of nodes) {
        if (node.label.toLowerCase().includes(query)) {
          searchMatches.add(node.id);
        }
      }
      // Intersect with visible nodes
      for (const id of visibleNodeIds) {
        if (!searchMatches.has(id)) {
          visibleNodeIds.delete(id);
        }
      }
    }

    // Apply visibility to nodes
    const allNodeIds = visNodes.getIds();
    for (const id of allNodeIds) {
      const isVisible = visibleNodeIds.has(id);
      visNodes.update({ id, hidden: !isVisible });
    }

    // Apply visibility to edges — only show edges where both endpoints are visible
    const edgeIds = visEdges.getIds();
    for (const id of edgeIds) {
      const edge = visEdges.get(id) as Record<string, unknown> | undefined;
      if (!edge) continue;
      const from = edge.from as string;
      const to = edge.to as string;
      const bothVisible = visibleNodeIds.has(from) && visibleNodeIds.has(to);
      visEdges.update({ id, hidden: !bothVisible });
    }
  }, [visibleTypes, dateFrom, dateTo, searchQuery]);

  // Re-apply filters when they change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  // -----------------------------------------------------------------------
  // Reset layout
  // -----------------------------------------------------------------------

  const handleResetLayout = useCallback(() => {
    const network = networkRef.current as {
      setOptions: (opts: Record<string, unknown>) => void;
      fit: () => void;
    } | null;
    const visNodes = nodesDataSetRef.current as {
      update: (items: Record<string, unknown> | Record<string, unknown>[]) => void;
      get: (id: string) => Record<string, unknown>;
      getIds: () => string[];
    } | null;
    if (!network || !visNodes) return;

    // Reposition document nodes back to their original circle layout
    const allNodes = allNodesRef.current;
    const docNodes = allNodes.filter((n) => n.type === "document");
    const docUpdates: Record<string, unknown>[] = [];
    for (let i = 0; i < docNodes.length; i++) {
      const angle = (2 * Math.PI * i) / docNodes.length;
      const radius = 800;
      docUpdates.push({
        id: docNodes[i].id,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        fixed: { x: true, y: true },
      });
    }
    visNodes.update(docUpdates);

    network.setOptions({ physics: { enabled: true } });
    setTimeout(() => {
      const currentNetwork = networkRef.current as {
        setOptions: (opts: Record<string, unknown>) => void;
        fit: () => void;
      } | null;
      const currentVisNodes = nodesDataSetRef.current as {
        update: (items: Record<string, unknown> | Record<string, unknown>[]) => void;
      } | null;
      if (!currentNetwork || !currentVisNodes) return;
      currentNetwork.setOptions({ physics: { enabled: false } });
      // Unfix document nodes so users can drag them after layout settles
      currentVisNodes.update(docNodes.map((n) => ({ id: n.id, fixed: false })));
      currentNetwork.fit();
    }, 2000);
  }, []);

  // -----------------------------------------------------------------------
  // Reset filters
  // -----------------------------------------------------------------------

  const handleResetFilters = useCallback(() => {
    deselectAll();
    setVisibleTypes([...ALL_TYPES]);
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  }, [deselectAll]);

  // -----------------------------------------------------------------------
  // Type toggle
  // -----------------------------------------------------------------------

  const handleTypeToggle = useCallback((type: EntityType) => {
    setVisibleTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    );
  }, []);

  // -----------------------------------------------------------------------
  // Date range change
  // -----------------------------------------------------------------------

  const handleDateFromChange = useCallback((value: string) => {
    setDateFrom(value);
  }, []);

  const handleDateToChange = useCallback((value: string) => {
    setDateTo(value);
  }, []);

  // -----------------------------------------------------------------------
  // Search match count
  // -----------------------------------------------------------------------

  const searchMatchCount = useMemo(() => {
    if (!searchQuery.trim() || !graphData) return 0;
    const query = searchQuery.toLowerCase();
    return graphData.nodes.filter((n) => n.label.toLowerCase().includes(query)).length;
  }, [searchQuery, graphData]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-lg">Loading entity graph…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="rounded-md border border-red-300 bg-red-50 px-6 py-4 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-semibold">Error loading graph</p>
          <p className="text-sm">{error}</p>
          <button
            onClick={onBackToTable}
            className="mt-3 rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            Back to Table
          </button>
        </div>
      </div>
    );
  }

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <p className="text-lg text-muted">No entities found in the graph.</p>
          <button
            onClick={onBackToTable}
            className="mt-3 rounded bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary/90"
          >
            Back to Table
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div className="bg-background border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
        <button
          onClick={onBackToTable}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          ← Back to Table
        </button>

        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <input
            type="text"
            placeholder="Search entities…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
          {searchQuery.trim() && searchMatchCount === 0 && (
            <p className="absolute left-0 right-0 top-full mt-1 text-xs text-red-500">
              No entities found
            </p>
          )}
        </div>

        <button
          onClick={() => setShowFilters((p) => !p)}
          className={`rounded border px-3 py-1.5 text-sm transition-all duration-200 ${
            showFilters
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          Filters {showFilters ? "▲" : "▼"}
        </button>

        <button
          onClick={() => setShowLegend((p) => !p)}
          className={`rounded border px-3 py-1.5 text-sm transition-all duration-200 ${
            showLegend
              ? "border-accent bg-accent/10 text-accent"
              : "border-border bg-background text-foreground hover:bg-muted"
          }`}
        >
          Legend {showLegend ? "▲" : "▼"}
        </button>

        <button
          onClick={handleResetLayout}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          Reset Layout
        </button>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────── */}
      <div
        className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          showFilters
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-background border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              {/* Type toggles */}
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-muted">Types:</span>
                {ALL_TYPES.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-1.5 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={visibleTypes.includes(type)}
                      onChange={() => handleTypeToggle(type)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{
                        backgroundColor: (NODE_GROUPS[type].color as Record<string, string>).background,
                      }}
                    />
                    {TYPE_LABELS[type]}
                  </label>
                ))}
              </div>

              {/* Date range */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Date:</span>
                <input
                  type="text"
                  placeholder="From (YYYY-MM-DD)"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
                <span className="text-muted">—</span>
                <input
                  type="text"
                  placeholder="To (YYYY-MM-DD)"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="rounded border border-border bg-background px-2 py-1 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
              </div>

              {/* Reset */}
              <button
                onClick={handleResetFilters}
                className="rounded border border-border bg-background px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Legend Panel ─────────────────────────────────────────────── */}
      <div
        className={`grid transition-all duration-300 ease-in-out motion-reduce:transition-none ${
          showLegend
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="bg-background border-b border-border px-4 py-3">
            <div className="flex flex-wrap items-center gap-4">
              {ALL_TYPES.map((type) => {
                const group = NODE_GROUPS[type];
                const color = (group.color as Record<string, string>).background;
                const shape = group.shape as string;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="h-4 w-4"
                      style={{
                        backgroundColor: color,
                        borderRadius:
                          shape === "dot"
                            ? "50%"
                            : shape === "diamond"
                              ? "2px"
                              : shape === "square"
                                ? "2px"
                                : shape === "hexagon"
                                  ? "2px"
                                  : shape === "triangle"
                                    ? "0"
                                    : "2px",
                        clipPath:
                          shape === "diamond"
                            ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)"
                            : shape === "triangle"
                              ? "polygon(50% 0%, 0% 100%, 100% 100%)"
                            : shape === "hexagon"
                              ? "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)"
                              : undefined,
                      }}
                    />
                    <span className="text-sm text-foreground">{TYPE_LABELS[type]}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-2 ml-4">
                <div className="h-0.5 w-6 bg-gray-400" />
                <span className="text-sm text-muted">Direct</span>
                <div className="h-0.5 w-6 border-t-2 border-dashed border-gray-300" />
                <span className="text-sm text-muted">Co-occurs</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Graph Canvas ─────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        <div ref={containerRef} className="absolute inset-0 bg-background" />
        {selectedNode && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-background/80 px-3 py-1 text-xs text-muted-foreground pointer-events-none">
            Click empty space to deselect · Double-click to zoom
          </div>
        )}
      </div>

      {/* ── Info Card (conditional) ──────────────────────────────────── */}
      {infoCard && (
        <div className="bg-card border-t border-border px-4 py-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg text-foreground">{infoCard.label}</span>
                <span
                  className="rounded px-2 py-0.5 text-xs font-medium text-white"
                  style={{
                    backgroundColor: (NODE_GROUPS[infoCard.type].color as Record<string, string>).background,
                  }}
                >
                  {TYPE_LABELS[infoCard.type]}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-4 text-sm text-muted">
                <span>Related documents: {infoCard.docCount}</span>
                {infoCard.dateRange && <span>Date range: {infoCard.dateRange}</span>}
              </div>
            </div>
            <button
              onClick={deselectAll}
              className="rounded p-1 text-muted hover:text-foreground transition-colors"
              aria-label="Close info card"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
