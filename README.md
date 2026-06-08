# Sema — TEI Corpus Explorer

A Next.js 16 platform for exploring and managing medieval charter corpora encoded in TEI P5 XML. Browse a public corpus table and entity knowledge graph, or use the password-protected admin dashboard to create, edit, and delete TEI documents.

## Features

- **Public corpus explorer** — searchable table of charters with an interactive entity knowledge graph
- **Admin dashboard** — password-protected area for document management (create, edit, delete)
- **Config-driven** — YAML configs for corpus columns (`config/columns.yaml`) and form fields (`config/form-sections.yaml`); no code changes needed to add or reorder fields
- **TEI P5 XML** — generates valid TEI XML from form input and parses it back for editing

## Getting Started

### Prerequisites

- Node.js 18 or later

### Setup

```bash
git clone <repo-url> && cd sema
npm install
```

Create a `.env.local` file with your admin password:

```
ADMIN_PASSWORD=your-password
```

Generate corpus data and start the dev server:

```bash
npm run build-json
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public corpus explorer, or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on `localhost:3000` |
| `npm run build` | Regenerate corpus data + Next.js production build |
| `npm run build-json` | Regenerate `corpus-metadata.json` and `entity-graph.json` from TEI XML |
| `npm run lint` | Run ESLint |

**Note:** `npm run build` runs `build-json` before `next build`. Running `next build` directly without generating the JSON files will fail.

## Project Structure

```
config/                  YAML configuration (form fields, corpus columns)
data/tei-samples/        TEI P5 XML source files
public/                  Generated JSON artifacts (corpus-metadata, entity-graph)
scripts/                 Build scripts (corpus metadata, entity graph)
src/app/                 Next.js App Router pages and API routes
src/components/          React components (public + admin)
src/lib/                 Server utilities (XML builder, XML parser, form config loader)
```

## Admin Usage

1. Navigate to `/admin` and enter the password set in `ADMIN_PASSWORD`.
2. The dashboard lists all documents with search and filter controls.
3. **Create:** click "New Document", fill in the form, and submit.
4. **Edit:** click "Edit" on a document, modify the fields, and click "Save Changes".
5. **Delete:** click "Delete", confirm in the modal — the XML file is removed and corpus JSON is rebuilt automatically.

## XML Parser

The admin edit mode uses `src/lib/xmlParser.ts` to reverse-map TEI XML back into form values. It reads the same `config/form-sections.yaml` used by the form builder.

**Known limitations:**

- Hand-written XML that deviates from the TEI structure expected by the config may produce empty fields.
- Mixed inline content (e.g. `<p>text <hi>styled</hi> more</p>`) extracts all text but loses the inline markup distinction.
- Missing elements in XML result in empty defaults — the parser never crashes.
- Unknown elements are silently ignored; missing fields are skipped.

## Windows Setup

Windows users: see [README_WINDOWS.md](README_WINDOWS.md) for detailed setup instructions.

**Quick start:** double-click `start.bat` (or right-click `start.ps1` and select "Run with PowerShell"). Ensure Node.js is installed first.
