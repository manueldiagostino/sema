# Graph Report - sema  (2026-06-10)

## Corpus Check
- 126 files · ~65,703 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 544 nodes · 794 edges · 46 communities (29 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.84)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7a46ce77`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community -1|Community -1]]
- [[_COMMUNITY_Admin Form System|Admin Form System]]
- [[_COMMUNITY_Admin Dashboard System|Admin Dashboard System]]
- [[_COMMUNITY_Fake Data Template Pools|Fake Data Template Pools]]
- [[_COMMUNITY_Admin Config and Design Specs|Admin Config and Design Specs]]
- [[_COMMUNITY_NPM Dependencies|NPM Dependencies]]
- [[_COMMUNITY_OpenSpec Change Foundations|OpenSpec Change Foundations]]
- [[_COMMUNITY_Entity Graph Builder Script|Entity Graph Builder Script]]
- [[_COMMUNITY_TypeScript Build Config|TypeScript Build Config]]
- [[_COMMUNITY_Git Utility and GitHub Auth|Git Utility and GitHub Auth]]
- [[_COMMUNITY_Layout and Error Boundary|Layout and Error Boundary]]
- [[_COMMUNITY_Entity Graph View (vis-network)|Entity Graph View (vis-network)]]
- [[_COMMUNITY_UIUX Improvement Specs|UI/UX Improvement Specs]]
- [[_COMMUNITY_Admin Publish and Fake Corpus Design|Admin Publish and Fake Corpus Design]]
- [[_COMMUNITY_Admin Publish and Fake Corpus Concepts|Admin Publish and Fake Corpus Concepts]]
- [[_COMMUNITY_OpenSpec Workflow Skills|OpenSpec Workflow Skills]]
- [[_COMMUNITY_Publish Panel Component|Publish Panel Component]]
- [[_COMMUNITY_Home Page and Graph URL State|Home Page and Graph URL State]]
- [[_COMMUNITY_Facet and Column Feature Concepts|Facet and Column Feature Concepts]]
- [[_COMMUNITY_Refine Corpus Table Design Docs|Refine Corpus Table Design Docs]]
- [[_COMMUNITY_Enhance Facet Sidebar Design Docs|Enhance Facet Sidebar Design Docs]]
- [[_COMMUNITY_Admin Layout and Static Export|Admin Layout and Static Export]]
- [[_COMMUNITY_Fake Corpus Generation Specs|Fake Corpus Generation Specs]]
- [[_COMMUNITY_Publish Interface Specification|Publish Interface Specification]]
- [[_COMMUNITY_Compare and Document Card Concepts|Compare and Document Card Concepts]]
- [[_COMMUNITY_Table Export and Viewport Patterns|Table Export and Viewport Patterns]]
- [[_COMMUNITY_Faceted Search URL and Slider Specs|Faceted Search URL and Slider Specs]]
- [[_COMMUNITY_Corpus API Route|Corpus API Route]]
- [[_COMMUNITY_Fake Corpus Task Tracking|Fake Corpus Task Tracking]]
- [[_COMMUNITY_Graph API Route|Graph API Route]]
- [[_COMMUNITY_OpenCode Config|OpenCode Config]]
- [[_COMMUNITY_OpenCode Plugin Dependency|OpenCode Plugin Dependency]]
- [[_COMMUNITY_Corpus Table Specs|Corpus Table Specs]]
- [[_COMMUNITY_Charter Type Column Spec|Charter Type Column Spec]]
- [[_COMMUNITY_Collapsible Facet Sections Spec|Collapsible Facet Sections Spec]]
- [[_COMMUNITY_ESLint Config|ESLint Config]]
- [[_COMMUNITY_Graphify Plugin|Graphify Plugin]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Next.js Logo Asset|Next.js Logo Asset]]
- [[_COMMUNITY_Vercel Deploy Config|Vercel Deploy Config]]
- [[_COMMUNITY_Next.js Config|Next.js Config]]
- [[_COMMUNITY_OpenSpec Global Config|OpenSpec Global Config]]
- [[_COMMUNITY_File Icon Asset|File Icon Asset]]
- [[_COMMUNITY_Globe Icon Asset|Globe Icon Asset]]
- [[_COMMUNITY_Window Icon Asset|Window Icon Asset]]
- [[_COMMUNITY_Pagination Contrast Fix|Pagination Contrast Fix]]

## God Nodes (most connected - your core abstractions)

## Surprising Connections (you probably didn't know these)
- `buildEntityGraph()` --calls--> `POST()`  [INFERRED]
   →   _Bridges community 5 → community 1_
- `Faceted Search Sidebar Specification` --semantically_similar_to--> `Admin Dashboard`  [INFERRED] [semantically similar]
   →   _Bridges community 4 → community 2_
- `Sema Project Overview` --references--> `OpenSpec Workflow System`  [EXTRACTED]
   →   _Bridges community 4 → community 13_

## Import Cycles
- None detected.

## Communities (46 total, 17 thin omitted)

### Community -1 - "Community -1"
Cohesion: 0.06
Nodes (47): AdHocFields.tsx, AdHocFieldsProps, AdminFormPage.tsx, AdminFormPageProps, getInitialFieldValue(), initializeFieldValues(), CharterTypeSelector.tsx, CharterTypeSelectorProps (+39 more)

### Community 0 - "Admin Form System"
Cohesion: 0.05
Nodes (43): AdminDashboard.tsx, ColumnConfig, CorpusResponse, DISPLAY_COLUMNS, DeleteConfirmModal.tsx, DeleteConfirmModalProps, page.tsx, CompareDrawer.tsx (+35 more)

### Community 1 - "Admin Dashboard System"
Cohesion: 0.08
Nodes (53): pools.ts, AUTHOR_NAMES, ESCHATOCOL_TEMPLATES, fillTemplate(), NOTARY_NAMES, PLACE_NAMES, PROTOCOL_TEMPLATES, REPOSITORIES (+45 more)

### Community 2 - "Fake Data Template Pools"
Cohesion: 0.06
Nodes (52): Admin Dashboard, AdminDashboard Component, Admin Form Page (/admin/form), columns.yaml Configuration, Config-Driven Reverse Mapping, corpus-metadata.json, DeleteConfirmModal Component, Diplomatic Formulary Structure (+44 more)

### Community 3 - "Admin Config and Design Specs"
Cohesion: 0.05
Nodes (37): package.json, dependencies, js-yaml, next, papaparse, react, react-dom, @tanstack/react-table (+29 more)

### Community 4 - "NPM Dependencies"
Cohesion: 0.09
Nodes (34): Faceted Search Sidebar Design, Faceted Search Sidebar Change Metadata, Faceted Search Sidebar Proposal, Faceted Search Sidebar Tasks, Admin Publish Interface Change, Project Architecture Documentation, Sema Project Overview, Build-Time Facet Computation (+26 more)

### Community 5 - "OpenSpec Change Foundations"
Cohesion: 0.16
Nodes (24): build-entity-graph.ts, BuildConfig, buildEntityGraph(), createDocumentNode(), createDocumentTypeNode(), deduplicatePhase1(), deduplicatePhase2(), deriveClan() (+16 more)

### Community 6 - "Entity Graph Builder Script"
Cohesion: 0.10
Nodes (21): tsconfig.json, compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx (+13 more)

### Community 7 - "TypeScript Build Config"
Cohesion: 0.23
Nodes (20): git.ts, CORPUS_PATHS, getCurrentBranch(), getGitHubToken(), getGitStatus(), getLastCommit(), git(), GitFile (+12 more)

### Community 8 - "Git Utility and GitHub Auth"
Cohesion: 0.12
Nodes (10): layout.tsx, geistMono, geistSans, metadata, GlobalErrorBoundary.tsx, GlobalErrorBoundary, Props, State (+2 more)

### Community 9 - "Layout and Error Boundary"
Cohesion: 0.16
Nodes (15): EntityGraphView.tsx, ALL_TYPES, EntityGraphViewProps, getDocumentNodesInHop(), getNeighborIds(), getTwoHopIds(), NETWORK_OPTIONS, NODE_GROUPS (+7 more)

### Community 10 - "Entity Graph View (vis-network)"
Cohesion: 0.17
Nodes (16): Aligned Compare Side-by-Side Spec, Aligned Compare Side-by-Side Capability, Default Column Visibility Capability, Fixed Table Viewport Capability, Full Content Document Modal Capability, Pagination Text Readability Capability, Remove Global Selection Checkbox Capability, Smart Graph View Button Capability (+8 more)

### Community 11 - "UI/UX Improvement Specs"
Cohesion: 0.21
Nodes (13): Admin Publish Interface Design, Admin Publish Interface Proposal, Directory-Presence as Mode Toggle, Fake Corpus Generation, GitHub PAT Authentication via HTTPS, Publish API Endpoint, PublishPanel Component, Medieval Latin Template Pools (+5 more)

### Community 12 - "Admin Publish and Fake Corpus Design"
Cohesion: 0.17
Nodes (12): Git Utility Library, GitHub PAT Authentication, Publish API Endpoint, PublishPanel, Two-Phase Publish Flow, Token Storage in data/.github-token, Directory Presence Detection Pattern, Fake Corpus Generation (+4 more)

### Community 13 - "Admin Publish and Fake Corpus Concepts"
Cohesion: 0.27
Nodes (12): OpenSpec Apply Command, OpenSpec Archive Command, OpenSpec Explore Command, OpenSpec Propose Command, Apply Change Skill, OpenSpec Apply Change Skill, Archive Change Skill, OpenSpec Archive Change Skill (+4 more)

### Community 14 - "OpenSpec Workflow Skills"
Cohesion: 0.29
Nodes (6): PublishPanel.tsx, formatDate(), GitFile, GitStatus, PublishPanel(), PublishResponse

### Community 15 - "Publish Panel Component"
Cohesion: 0.38
Nodes (6): page.tsx, EntityGraphView, GraphViewRouter(), useGraphUrlState.ts, GraphUrlState, useGraphUrlState()

### Community 16 - "Home Page and Graph URL State"
Cohesion: 0.29
Nodes (7): Clickable Facet Value Rows, Collapsible Facet Sections, Double-Handled Date Range Slider, Reduced Motion Support, Charter Type Derived Column, Default Column Visibility, Row-Click Selection

### Community 17 - "Facet and Column Feature Concepts"
Cohesion: 0.50
Nodes (5): Charter Type Derived Column, Default Column Visibility, Row-Click Selection, Refine Corpus Table Design, Refine Corpus Table Proposal

### Community 18 - "Refine Corpus Table Design Docs"
Cohesion: 0.60
Nodes (5): Clickable Facet Value Rows, Collapsible Facet Sections, Double-Handled Range Slider, Enhance Facet Sidebar UX Design, Enhance Facet Sidebar UX Proposal

### Community 20 - "Admin Layout and Static Export"
Cohesion: 0.83
Nodes (4): Fake Corpus Generation Capability, Fake Mode Toggle Capability, Fake Corpus Generation Spec, Fake Mode Toggle Spec

### Community 21 - "Fake Corpus Generation Specs"
Cohesion: 0.67
Nodes (3): Publish API Spec, Publish Interface Spec, Admin Publish Interface Tasks

### Community 22 - "Publish Interface Specification"
Cohesion: 0.67
Nodes (3): CompareView Component, DocumentCard Component, Side-by-Side Alignment via Row-per-Section Grid

### Community 23 - "Compare and Document Card Concepts"
Cohesion: 0.67
Nodes (3): TanStack React Table, Export Dropdown (Single Button), Fixed Table Height via CSS

### Community 24 - "Table Export and Viewport Patterns"
Cohesion: 0.67
Nodes (3): URL Query Parameter State Synchronization, Date Range Slider, Faceted Search Sidebar

### Community 26 - "Corpus API Route"
Cohesion: 0.67
Nodes (3): Fake Corpus Generation Spec, Fake Mode Toggle Spec, Generate Fake Corpus Tasks

### Community 28 - "Graph API Route"
Cohesion: 0.67
Nodes (3): opencode.json, plugin, $schema

### Community 29 - "OpenCode Config"
Cohesion: 0.67
Nodes (3): package.json, dependencies, @opencode-ai/plugin

### Community 30 - "OpenCode Plugin Dependency"
Cohesion: 0.67
Nodes (3): Charter Type Column Spec, Corpus Table Default Columns Spec, Refine Corpus Table Tasks

## Knowledge Gaps
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Should `Community -1` be split into smaller, more focused modules?**
  _Cohesion score 0.05837173579109063 - nodes in this community are weakly interconnected._
- **Should `Admin Form System` be split into smaller, more focused modules?**
  _Cohesion score 0.0519774011299435 - nodes in this community are weakly interconnected._
- **Should `Admin Dashboard System` be split into smaller, more focused modules?**
  _Cohesion score 0.07744107744107744 - nodes in this community are weakly interconnected._
- **Should `Fake Data Template Pools` be split into smaller, more focused modules?**
  _Cohesion score 0.058069381598793365 - nodes in this community are weakly interconnected._
- **Should `Admin Config and Design Specs` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `NPM Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08912655971479501 - nodes in this community are weakly interconnected._
- **Should `Entity Graph Builder Script` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._