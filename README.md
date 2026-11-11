# AI Industrial Product Catalog — Static HTML Website

A clean, responsive, professional Industrial Product Catalog frontend inspired by industrial e-commerce leaders like **Fastenal** and **Grainger**.

Built strictly with:
- **HTML5**
- **CSS3** (CSS Grid & Flexbox)
- **Vanilla JavaScript** (ES6+, Fetch API, safe DOM construction)
- **JSON** (Local data store)

> **Zero External Dependencies:** No React, Angular, Vue, Next.js, TypeScript, Python backend, PHP, Node.js backend, database, or UI libraries (Bootstrap, Tailwind, etc.).

---

## 1. Project Structure

```text
Industrial-Product-Catalog/
├── index.html              # Main HTML5 application shell & modal
├── style.css               # Professional Fastenal/Grainger industrial stylesheet
├── script.js               # Vanilla JavaScript application, polling & safe DOM renderer
├── data/
│   └── products.json       # Product inventory JSON database
├── assets/
│   └── products/           # Directory for product image assets
├── excel/                  # Directory for incoming Excel data sheets
└── README.md               # Documentation and local setup instructions
```

---

## 2. JSON Data Schema (`data/products.json`)

The website dynamically consumes and renders data from `data/products.json`. The catalog initializes with an empty `products` array and listens for updates.

### Top-Level Schema:
```json
{
  "catalog_name": "Industrial Product Catalog",
  "total_products": 0,
  "last_updated": null,
  "products": []
}
```

### Product Item Schema:
```json
{
  "item_no": "9641272",
  "description": "Jobber Drill Bit Hss Blk Ox 135 Split Pt, 3/4",
  "product_title": "3/4 Inch HSS Black Oxide Jobber Drill Bit",
  "category": "Cutting Tools",
  "subcategory": "Drill Bits",
  "category_match_percent": 96,
  "uom": "EA",
  "pkg_qty": 1,
  "list_price": 16.91,
  "avg_cost": 9.04,
  "qty_on_hand": 0,
  "sales_qty_12m": 0,
  "vendor": "PRECISION CUTTING TOOL CO",
  "mfr_part_no": null,
  "status": "ACTIVE",
  "image": "assets/products/9641272.png",
  "image_match_percent": 94,
  "image_status": "generated",
  "image_source": "AI Generated"
}
```

---

## 3. Key Features & Industrial UI Specification

### Header & Dynamic KPI Dashboard
- **Branding**: Industrial monogram icon, "AI Industrial Product Catalog" header, and "AI-Enriched Industrial Product Inventory" subtitle.
- **Dynamic KPI Cards**:
  - **Total Products** (calculated from `products.length`)
  - **Active Products** (count of `status === 'ACTIVE'`)
  - **Inactive Products** (count of `status === 'INACTIVE'`)
  - **Total Categories** (count of unique non-empty categories)
  - **Generated Images** (count of products with generated status or valid images)
- **Live Sync Indicator**: Pulsing status dot and last sync timestamp.

### Search, Filters & Sorting
- **Multi-field Search**: Real-time filtering across Product Title, Item Number (`item_no`), Original Description, and Vendor. Keyboard shortcut `/` focuses the search bar.
- **Category Filter**: Populated dynamically from inventory data.
- **Subcategory Filter**: Updates dynamically to only show subcategories relevant to the selected category.
- **Status Filter**: Toggle between `ALL`, `ACTIVE`, and `INACTIVE`.
- **Sort Options**:
  - Product Title (A-Z and Z-A)
  - List Price (Low-to-High and High-to-Low)
  - Category Match % (High-to-Low)
  - Image Match % (High-to-Low)
- **Active Filter Chips**: Clickable tags to remove individual active filters.
- **Reset Filters & Refresh Buttons**: One-click filter reset and instant manual re-fetch with animated indicator.

### Product Card Architecture
Each card is built with safe DOM methods:
- **Section A (Product Image)**: Square `1:1` aspect ratio, `object-fit: contain`, pure white background, hover zoom indicator. Missing images or 404s automatically fallback to an inline SVG `"Image unavailable"` badge.
- **Section B (Product Identification)**: Bold product title, prominent `ITEM #` badge, active/inactive indicator pill, and original description in muted italics.
- **Section C (Category & Confidence)**: Category and subcategory breadcrumbs paired with evaluated Category Match percentage (or `"Not evaluated"` if null).
- **Section D (Product Details)**: Two-column spec table showing List Price (formatted with `$`), Average Cost, UOM, Package Quantity, Quantity on Hand, Sales Quantity (12M), Vendor, and Manufacturer Part Number (`"N/A"` if missing).
- **Section E (AI Image Matching)**: Horizontal progress bar color-coded by confidence:
  - `90% – 100%`: **Green** (`#10b981`)
  - `75% – 89%`: **Amber** (`#f59e0b`)
  - `< 75%`: **Red** (`#ef4444`)
  - `null`: Neutral indicator displaying `"Not evaluated"`
  - Image generation status tag and `"AI Generated Image"` label.

### Image Preview Modal
- Clicking any product image triggers an accessible high-resolution modal.
- Displays the large image, product title, item number, category, price, vendor, and AI image match progress bar.
- Closes via close button (`×`), pressing `Escape`, or clicking anywhere outside the modal dialog.

### Dynamic JSON Polling & Data Protection
- **Automatic 5-Second Refresh**: Silently polls `data/products.json?_t=<timestamp>` every 5 seconds.
- **No-Flicker Updates**: Compares data payloads before modifying the DOM.
- **Preserved State**: Active search terms, filters, and sorting remain intact across automated poll cycles.
- **Non-blocking Error Handling**: If `products.json` is being edited or temporarily invalid, current inventory is preserved and a non-blocking notification banner appears.
- **XSS Prevention**: Untrusted JSON data is never injected via raw `innerHTML`. All text is inserted via `textContent` and standard DOM attributes.

---

## 4. Responsive Grid Breakpoints

Configured via clean CSS Grid:
- **Desktop (≥ 1200px)**: 4 product cards per row
- **Laptop (900px – 1199px)**: 3 product cards per row
- **Tablet (600px – 899px)**: 2 product cards per row
- **Mobile (< 600px)**: 1 product card per row

---

## 5. Local Preview & Running the Application

Browsers restrict `fetch()` requests when opening files directly using `file:///` due to Cross-Origin (CORS) security policies. To run the static website locally, serve the `Industrial-Product-Catalog` directory using any local static web server.

### Option 1: Python (Built-in)
Navigate to the directory in your terminal and run:
```bash
cd Industrial-Product-Catalog
python -m http.server 8000
```
Then open: [http://localhost:8000](http://localhost:8000)

### Option 2: Node.js `npx serve`
```bash
cd Industrial-Product-Catalog
npx serve .
```

### Option 3: VS Code / IDE Live Server
Right-click `index.html` and select **"Open with Live Server"**.

---

## 6. System Boundaries & AI Agent Workflow

- **Frontend Scope**: Pure static viewer for JSON records. It contains no hardcoded products, no database queries, and no backend code.
- **Antigravity AI Agent Scope**: Excel ingestion, product categorization evaluation, product image generation, and appending/updating records in `data/products.json`.
- When new records are appended to `data/products.json`, the website detects the changes within 5 seconds and renders the new product cards automatically.

