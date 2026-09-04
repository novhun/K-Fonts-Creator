export const en = {
  // Navigation & Branding
  nav: {
    appTitle: "K Fonts Creator",
    appSubtitle: "Professional Khmer & Latin Font Studio",
    library: "Font Library",
    importFont: "Import Font",
    newProject: "New Project",
    toggleTheme: "Toggle theme",
    switchLang: "Change language",
    dark: "Dark",
    light: "Light",
    khmer: "ភាសាខ្មែរ",
    english: "English",
  },

  // Common UI words
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    close: "Close",
    download: "Download",
    copy: "Copy",
    copied: "Copied!",
    loading: "Loading…",
    search: "Search…",
    all: "All",
    clear: "Clear",
    error: "Error",
    back: "Back",
    details: "Details",
    version: "Version",
    author: "Author",
    unitsPerEm: "Units Per Em",
    ascender: "Ascender",
    descender: "Descender",
    preview: "Preview",
  },

  // Hero Section
  hero: {
    badge: "Browser-Based Font Creation Engine · Zero Setup",
    titlePrefix: "Design, Vectorize & Compile",
    titleHighlight: "Khmer & Latin Typefaces",
    description:
      "Create native TrueType & OpenType fonts from scratch or customize existing typefaces. Full support for Khmer subscripts (ជើងអក្សរ), coeng ligatures, Bézier vector paths, and instant web font packaging.",
    metricFonts: "Bundled OFL Fonts",
    metricKhmer: "Khmer Unicode Ready",
    metricExport: "Direct Binary Export",
    metricStorage: "Browser IndexedDB",
  },

  // Starter Templates
  templates: {
    title: "Quick Start Templates",
    subtitle: "Launch a project instantly with pre-configured glyph tables and metrics",
    popularBadge: "Most Popular",
    cleanBadge: "Clean Sans",
    cncBadge: "CNC & Laser",
    khmerUnicodeTitle: "Khmer Unicode Font",
    khmerUnicodeDesc:
      "Full Khmer script (1780–17FF), subscript coeng combinations, independent vowels & punctuation.",
    latinCleanTitle: "Latin Modern Sans",
    latinCleanDesc:
      "Standard Basic Latin & Extended A/B with optimal vertical metrics for web & print typography.",
    singleLineTitle: "Single-Line / Plotter",
    singleLineDesc:
      "Optimized centerline font for CNC engraving, laser etching, vinyl cutters, and plotter pens.",
  },

  // Projects Section
  projects: {
    title: "My Font Projects",
    subtitle: "Saved locally in your browser storage",
    searchPlaceholder: "Search projects…",
    noProjectsTitle: "No font projects created yet",
    noProjectsDesc:
      "Click any starter template above, import an existing .ttf file, or create a blank canvas to begin.",
    noMatch: "No projects matching",
    deleteConfirm: "Are you sure you want to delete this project?",
    openProject: "Open Project",
  },

  // Featured Showcase
  showcase: {
    liveBadge: "Live Showcase",
    title: "Bundled Khmer & Latin Font Library",
    subtitle:
      "Explore 315+ curated typefaces, test real glyph rendering, and download full folders directly",
    browseAll: "Browse All 315 Fonts",
    liveTesterLabel: "Live Custom Text:",
    liveTesterPlaceholder:
      "Type your own Khmer or Latin sample text here to preview in real-time…",
  },

  // Studio Capabilities
  studio: {
    title: "Full-Featured Typography Studio",
    subtitle:
      "Engineered specifically for complex Khmer script rendering and high-precision Latin vector glyphs",
    vectorTitle: "Vector Glyph Canvas",
    vectorDesc:
      "Precision cubic and quadratic Bézier curve tools, anchor manipulation, handles, and path direction control.",
    subscriptTitle: "Khmer Coeng Subscripts",
    subscriptDesc:
      "Seamless support for sub-consonant combinations (ជើងអក្សរ), virama / coeng markers, and contextual vowel positioning.",
    compileTitle: "OpenType Compilation",
    compileDesc:
      "Direct export to standard binary .ttf and .otf files with embedded cmap, hmtx, and font metrics.",
    singleLineTitle: "Single-Line & Dot Matrix",
    singleLineDesc:
      "Support for stroke-based CNC toolpaths, laser engraving fonts, and geometric dot-matrix typography.",
  },

  // Font Library Page (/fonts)
  library: {
    pageTitle: "Khmer & Latin Font Library",
    pageSubtitle: "Explore, test, and download 315+ open-source fonts bundled directly with K-Fonts-Creator.",
    backToDashboard: "Back to Dashboard",
    searchPlaceholder: "Search font families, styles, files, or folders…",
    folders: "Folders & Categories",
    allFamilies: "All Families",
    fontCount: "fonts found",
    variants: "variants",
    sampleKhmer: "ភាសាខ្មែរ រុងរឿង និងសម្បូរបែបក្នុងប្រវត្តិសាស្ត្រ",
    sampleLatin: "The quick brown fox jumps over the lazy dog.",
    downloadFolder: "Download Folder (ZIP)",
    downloadFont: "Download Font",
    copyCss: "Copy CSS",
    filterScript: "Script:",
    allScripts: "All Scripts",
    khmerOnly: "Khmer",
    khmerLatin: "Khmer + Latin",
    latinOnly: "Latin",
    sortBy: "Sort by:",
    sortName: "Name (A-Z)",
    sortVariants: "Most Variants",
    testText: "Custom Preview Text:",
  },

  // Editor TopBar & Dialogs
  editor: {
    export: "Export Font",
    settings: "Settings",
    reimport: "Re-import Font",
    glyphsDrawn: "glyphs drawn",
    backToHome: "Back to Home",
    exportSuccess: "Font exported successfully!",
    exportOtf: "OpenType (.otf)",
    exportOtfHint: "Raw font, best fidelity",
    exportWoff: "WOFF (.woff)",
    exportWoffHint: "Compressed web font",
    exportWoff2: "WOFF2 (.woff2)",
    exportWoff2Hint: "Best compression",
  },

  // Dialogs
  dialogs: {
    newProjectTitle: "Create New Font Project",
    projectName: "Project Name",
    fontMode: "Font Mode",
    outlineMode: "Outline (Standard TTF/OTF)",
    singleLineMode: "Single-Line (CNC / Laser)",
    dotMatrixMode: "Dot Matrix",
    createBtn: "Create Project",
    importTitle: "Import Existing Font",
    importDrag: "Drag & drop a .ttf, .otf, or .woff file here, or click to browse",
    importBtn: "Import & Open",
  },

  // Footer
  footer: {
    tagline: "Khmer & Latin Font Studio",
    storageNotice: "Local browser storage via IndexedDB · Licensed under OFL 1.1 / MIT",
  },
};

export type Translations = typeof en;
