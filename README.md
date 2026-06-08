# Sema — TEI Corpus Explorer

A Next.js 16 platform for exploring and managing medieval charter corpora encoded in TEI P5 XML. Browse a public corpus table and entity knowledge graph, or use the password-protected admin dashboard to create, edit, and delete TEI documents.

## Features

- **Public corpus explorer** — searchable table of charters with an interactive entity knowledge graph
- **Admin dashboard** — password-protected area for document management (create, edit, delete)
- **Config-driven** — YAML configs for corpus columns (`config/columns.yaml`) and form fields (`config/form-sections.yaml`); no code changes needed to add or reorder fields
- **TEI P5 XML** — generates valid TEI XML from form input and parses it back for editing

## Prerequisites

- **Node.js 18+** — download from [nodejs.org](https://nodejs.org)

## Quick Start

```bash
git clone <repo-url> && cd sema
npm install
npm run build-json
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The admin area at [/admin](http://localhost:3000/admin) uses password `dev` by default. See below to configure a custom password.

> For a production deployment use `npm run build && npm run start` instead — this requires setting `ADMIN_PASSWORD` in `.env.local`.

## Custom Password (Optional)

Create a `.env.local` file in the project root to override the default `dev` password:

```env
ADMIN_PASSWORD=your-password-here
```

Optional variables:

| Variable        | Purpose                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `COOKIE_SECRET` | Session encryption secret (auto-generated insecure default if omitted — set a strong one in production) |

## Running the App

### 1. Build the corpus data

Parse the TEI XML files in `data/tei-samples/` and generate the JSON files the app needs:

```bash
npm run build-json
```

This runs both `build-corpus` (→ `public/corpus-metadata.json`) and `build-entity-graph` (→ `public/entity-graph.json`).

> **Important:** This step must complete before the app starts. The dev server does _not_ build these files automatically.

### 2a. Development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) for the public corpus explorer, or [http://localhost:3000/admin](http://localhost:3000/admin) for the admin dashboard.

### 2b. Production build + start

```bash
npm run build    # builds corpus data, then runs next build
npm run start    # starts the production server on port 3000
```

`npm run build` always runs `build-json` before `next build`. Running `next build` directly without first generating the JSON files will fail.

### Generate fake data for testing

To populate the corpus with randomly generated TEI documents:

```bash
npm run generate-fake
```

This creates `data/fake/` with 100 fake charters, then rebuilds the JSON artifacts. The app automatically detects `data/fake/` and uses it instead of `data/tei-samples/` — no config changes needed.

Additional options:

```bash
npm run generate-fake -- --count 50     # generate 50 documents (default: 100)
npm run generate-fake -- --seed 42      # reproducible output
npm run generate-fake -- --sparse 0.5   # skip 50% of optional fields (default: 0.3)
npm run generate-fake -- --clean        # delete existing data/fake/ before generating
```

> **To return to the real corpus:** delete or rename `data/fake/`, then run `npm run build-json` again.

## All Commands

| Command                      | Description                                                            |
| ---------------------------- | ---------------------------------------------------------------------- |
| `npm run dev`                | Start dev server on `localhost:3000`                                   |
| `npm run build`              | Regenerate corpus data + Next.js production build                      |
| `npm run start`              | Start production server (after `npm run build`)                        |
| `npm run build-json`         | Regenerate `corpus-metadata.json` and `entity-graph.json` from TEI XML |
| `npm run build-corpus`       | Read TEI XML → `public/corpus-metadata.json`                           |
| `npm run build-entity-graph` | Read TEI XML → `public/entity-graph.json`                              |
| `npm run generate-fake`      | Generate fake TEI documents for testing                                |
| `npm run lint`               | Run ESLint                                                             |

## Syncing Changes to a Shared Repository

The admin panel saves new and edited TEI documents to `data/tei-samples/`. To share these changes with other users (e.g. push to a shared GitHub repository):

```bash
# Stage the changed XML file(s)
git add data/tei-samples/

# Commit with a descriptive message
git commit -m "Add charter: <document-title-or-id>"

# Push to the remote repository
git push
```

If you've deleted documents through the admin panel, stage the deletion the same way.

> **Note:** `public/corpus-metadata.json` and `public/entity-graph.json` are build artifacts regenerated by `npm run build-json`. They do not need to be committed.

## Windows

Windows users: see [README_WINDOWS.md](README_WINDOWS.md) for detailed setup and troubleshooting.

**Quick start:** double-click `start.bat` (or right-click `start.ps1` and select "Run with PowerShell"). Make sure Node.js is installed first.

## Project Structure

```
config/                  YAML configuration (form fields, corpus columns)
data/tei-samples/        TEI P5 XML source files (real corpus)
data/fake/               Auto-generated fake TEI documents (gitignored)
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
