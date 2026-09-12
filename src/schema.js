// ---------------------------------------------------------------------------
// schema.js — what each kind of section is made of.
//
// The admin panel does not know anything about the site. It reads this and
// builds the editing form from it. Add a field here and a box for it appears
// in /admin; there is no second place to update.
//
// field types:
//   text     one line, plain
//   rich     several lines, and <em> <strong> <a> <b> <br> are allowed
//   image    a picture, with a Choose button
//   number   a number box
//   bool     a tick box
//   select   a dropdown
//   list     several of something; "of" says what each one is made of
//   table    a grid of cells
// ---------------------------------------------------------------------------

const BACKGROUND = {
  key: "background", label: "Background", type: "select",
  options: [
    { value: "ground", label: "Page colour" },
    { value: "deep",   label: "Darker, with lines above and below" },
    { value: "lift",   label: "Lighter, with lines above and below" }
  ],
  help: "Alternating these is what stops the page reading as one long slab."
};

const LAYOUT = [
  { key: "width", label: "How wide it runs", type: "select", options: [
    { value: "narrow", label: "Narrow — a column of reading" },
    { value: "normal", label: "Normal — the rest of the page" },
    { value: "wide",   label: "Wide" },
    { value: "full",   label: "Edge to edge" }
  ]},
  { key: "align", label: "Alignment", type: "select", options: [
    { value: "left",   label: "Left" },
    { value: "center", label: "Centred" }
  ]},
  { key: "padTop",    label: "Space above, in rem", type: "number", help: "Leave empty to use the page's own spacing. Easier to drag on the preview than to type." },
  { key: "padBottom", label: "Space below, in rem", type: "number" }
];

const HEAD = [
  { key: "eyebrow", label: "Small label above the heading", type: "text" },
  { key: "heading", label: "Heading", type: "text" },
  { key: "intro",   label: "Opening paragraph", type: "rich" }
];

export const BLOCK_TYPES = {
  hero: {
    label: "Hero",
    blurb: "The top of the page: key art, the tagline and the opening lines.",
    unique: true,
    fields: [
      ...LAYOUT,
      { key: "eyebrow",     label: "Small label above the art", type: "text" },
      { key: "image",       label: "Key art", type: "image" },
      { key: "imageAlt",    label: "Description of the art", type: "text", help: "Read out by screen readers, and shown if the image fails to load." },
      { key: "imageWidth",  label: "Art width in pixels", type: "number" },
      { key: "imageHeight", label: "Art height in pixels", type: "number" },
      { key: "tagline",     label: "Tagline", type: "text" },
      { key: "lede",        label: "Opening paragraph", type: "rich" },
      { key: "kicker",      label: "The line under it", type: "rich" },
      { key: "pills",       label: "Status pills", type: "list", of: [
        { key: "text",   label: "Text", type: "text" },
        { key: "strong", label: "Stand out", type: "bool" }
      ]}
    ]
  },

  "realms-demo": {
    label: "Commit demo (interactive)",
    blurb: "The three Realm cards a visitor can turn sideways, and the Energy Battery that fills up.",
    unique: true,
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "realms", label: "The Realm cards", type: "list",
        help: "Card names and rules must match data/Cards. Never type one from memory.",
        of: [
          { key: "name",     label: "Card name", type: "text" },
          { key: "rule",     label: "Rule line", type: "text" },
          { key: "affinity", label: "Affinity", type: "select", options: [
            { value: "light", label: "Light" }, { value: "dark", label: "Dark" },
            { value: "solar", label: "Solar" }, { value: "frost", label: "Frost" },
            { value: "earthen", label: "Earthen" }, { value: "none", label: "Colourless" }
          ]},
          { key: "image", label: "Card art", type: "image" },
          { key: "icon",  label: "Affinity icon", type: "image" },
          { key: "alt",   label: "Description of the art", type: "text" }
        ]},
      { key: "batteryLabel",      label: "Battery label", type: "text" },
      { key: "emptyText",         label: "Text when the battery is empty", type: "text" },
      { key: "buttonEnd",         label: "First button", type: "text" },
      { key: "buttonEndNote",     label: "First button, small print", type: "text" },
      { key: "buttonRestore",     label: "Second button", type: "text" },
      { key: "buttonRestoreNote", label: "Second button, small print", type: "text" },
      { key: "note",              label: "Closing note", type: "rich" }
    ]
  },

  cards: {
    label: "Card grid",
    blurb: "A row of picture cards. The five Affinities use this one.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "columns",   label: "Columns on a wide screen", type: "number", min: 2, max: 5 },
      { key: "fullBleed", label: "Run the grid edge to edge", type: "bool" },
      { key: "items", label: "Cards", type: "list", of: [
        { key: "eyebrow",  label: "Small label", type: "text" },
        { key: "title",    label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "text",     label: "Text", type: "rich" },
        { key: "image",    label: "Picture", type: "image" },
        { key: "icon",     label: "Corner icon", type: "image" },
        { key: "alt",      label: "Description of the picture", type: "text" },
        { key: "hue",      label: "Accent colour", type: "select", options: [
          { value: "light", label: "Light" }, { value: "dark", label: "Dark" },
          { value: "solar", label: "Solar" }, { value: "frost", label: "Frost" },
          { value: "earthen", label: "Earthen" }, { value: "none", label: "Plain" }
        ]}
      ]}
    ]
  },

  steps: {
    label: "Numbered steps",
    blurb: "An ordered list with a name and a description each. The six turn stages use this one.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "numbered", label: "Show the numbers", type: "bool" },
      { key: "items", label: "Steps", type: "list", of: [
        { key: "name", label: "Name", type: "text" },
        { key: "desc", label: "Description", type: "rich" }
      ]}
    ]
  },

  "split-table": {
    label: "Text beside a table",
    blurb: "Writing on the left, a table on the right. The Life-by-table-size block.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "paragraphs", label: "Paragraphs", type: "list", simple: "rich" },
      { key: "tableLabel", label: "Label above the table", type: "text" },
      { key: "tableHead",  label: "Column headings", type: "list", simple: "text" },
      { key: "tableRows",  label: "Rows", type: "table", columnsFrom: "tableHead" },
      { key: "tableNote",  label: "Note under the table", type: "rich" }
    ]
  },

  status: {
    label: "Status list",
    blurb: "Working / In progress / Planned, each with a line of explanation.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "rows", label: "Rows", type: "list", of: [
        { key: "tag",  label: "Tag", type: "text" },
        { key: "tone", label: "Tag colour", type: "select", options: [
          { value: "off",  label: "Quiet — Planned" },
          { value: "on",   label: "Bright — Working" },
          { value: "now",  label: "Solar — In progress" },
          { value: "good", label: "Earthen — Done" }
        ]},
        { key: "text", label: "Text", type: "rich", help: "Wrap the first few words in <b></b> to make them the subject." }
      ]}
    ]
  },

  prose: {
    label: "Plain writing",
    blurb: "A heading and some paragraphs. The one to reach for when nothing fancier fits.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "paragraphs", label: "Paragraphs", type: "list", simple: "rich" }
    ]
  },

  gallery: {
    label: "Picture gallery",
    blurb: "A grid of pictures with optional captions. Screenshots go here.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "columns", label: "Columns on a wide screen", type: "number", min: 2, max: 4 },
      { key: "items", label: "Pictures", type: "list", of: [
        { key: "image",   label: "Picture", type: "image" },
        { key: "alt",     label: "Description of the picture", type: "text" },
        { key: "caption", label: "Caption", type: "rich" }
      ]}
    ]
  },

  cta: {
    label: "Buttons",
    blurb: "A heading and one or more buttons — a download link, a Discord invite.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "buttons", label: "Buttons", type: "list", of: [
        { key: "label",   label: "Button text", type: "text" },
        { key: "href",    label: "Where it goes", type: "text", help: "A full address like https://…, or mailto:you@…" },
        { key: "primary", label: "Make it the loud one", type: "bool" }
      ]}
    ]
  },

  contact: {
    label: "Contact forms",
    blurb: "The two forms and the email addresses under them.",
    unique: true,
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "forms", label: "Forms", type: "list", of: [
        { key: "title",     label: "Form title", type: "text" },
        { key: "lede",      label: "Blurb", type: "rich" },
        { key: "accessKey", label: "Web3Forms access key", type: "text", help: "From web3forms.com. It decides which inbox this form lands in." },
        { key: "subject",   label: "Subject line on the email", type: "text" },
        { key: "send",      label: "Send button text", type: "text" },
        { key: "fields",    label: "Boxes on the form", type: "list", of: [
          { key: "kind", label: "Kind", type: "select", options: [
            { value: "text", label: "One line" }, { value: "email", label: "Email address" },
            { value: "textarea", label: "Big box" }, { value: "select", label: "Dropdown" }
          ]},
          { key: "name",        label: "Name sent with the message", type: "text" },
          { key: "label",       label: "Label shown", type: "text" },
          { key: "hint",        label: "Small print after the label", type: "text" },
          { key: "placeholder", label: "Greyed-out example text", type: "text" },
          { key: "required",    label: "Must be filled in", type: "bool" },
          { key: "options",     label: "Dropdown choices", type: "list", simple: "text" }
        ]}
      ]},
      { key: "addressesLede", label: "Line above the addresses", type: "rich" },
      { key: "addresses", label: "Email addresses", type: "list", of: [
        { key: "what",  label: "What it is for", type: "text" },
        { key: "email", label: "Address", type: "text" }
      ]},
      { key: "privacy", label: "The small print", type: "rich" }
    ]
  },

  canvas: {
    label: "Freeform canvas",
    blurb: "A blank area you lay out by hand. Drag text, pictures and buttons where you want them and pull their corners to size. On a phone they stack in the order you placed them, top to bottom, so it cannot come apart on a small screen.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "rowHeight", label: "Height of one grid row, in rem", type: "number", help: "The canvas is 12 columns across and as many rows tall as you use. 4 is a sensible row." },
      { key: "gap",       label: "Gap between things, in rem", type: "number" },
      { key: "showGrid",  label: "Show the grid while editing", type: "bool" },
      { key: "items", label: "Things on the canvas", type: "list",
        help: "Easier to drag on the preview than to type here — but the numbers are honest if you would rather be exact.",
        of: [
          { key: "kind", label: "What it is", type: "select", options: [
            { value: "text",   label: "Text" },
            { value: "image",  label: "Picture" },
            { value: "button", label: "Button" },
            { value: "panel",  label: "Plain panel" }
          ], default: "text" },
          { key: "text",  label: "Text", type: "rich", default: "New text" },
          { key: "size",  label: "Text size", type: "select", default: "body", options: [
            { value: "small",   label: "Small" },
            { value: "body",    label: "Normal" },
            { value: "lead",    label: "Large" },
            { value: "title",   label: "Heading" },
            { value: "display", label: "Big heading" }
          ]},
          { key: "image", label: "Picture", type: "image" },
          { key: "alt",   label: "Description of the picture", type: "text" },
          { key: "fit",   label: "How the picture fills its box", type: "select", default: "cover", options: [
            { value: "cover",   label: "Fill the box, cropping" },
            { value: "contain", label: "Fit inside the box" }
          ]},
          { key: "href",    label: "Where the button goes", type: "text" },
          { key: "primary", label: "Make the button the loud one", type: "bool" },
          { key: "x", label: "Column, 1 to 12", type: "number", min: 1, max: 12, default: 1 },
          { key: "y", label: "Row", type: "number", min: 1, default: "nextRow" },
          { key: "w", label: "Columns wide", type: "number", min: 1, max: 12, default: 4 },
          { key: "h", label: "Rows tall", type: "number", min: 1, default: 2 }
        ]}
    ]
  },

  html: {
    label: "Raw HTML",
    blurb: "An escape hatch. Paste HTML straight in when none of the others will do.",
    fields: [
      BACKGROUND, ...LAYOUT, ...HEAD,
      { key: "html", label: "HTML", type: "rich", rows: 14 }
    ]
  }
};

export const SITE_FIELDS = [
  { key: "title",         label: "Page title", type: "text", help: "Shown in the browser tab and as the headline in Google." },
  { key: "description",   label: "Description", type: "text", help: "The grey line under the title in search results. Around 150 characters." },
  { key: "ogTitle",       label: "Title when shared on social media", type: "text" },
  { key: "ogDescription", label: "Description when shared", type: "text" },
  { key: "ogImage",       label: "Picture when shared", type: "text", help: "Must be a full address starting https://" },
  { key: "url",           label: "The site's own address", type: "text" },
  { key: "favicon",       label: "Tab icon", type: "image" },
  { key: "appleIcon",     label: "Icon when saved to a phone", type: "image" },
  { key: "lang",          label: "Language code", type: "text" },
  { key: "accountStrip",  label: "Show the Discord sign-in strip", type: "bool",
    help: "The \u201cSign in with Discord\u201d line at the top of the hero. Turning this off only hides the strip \u2014 sign-in itself is a separate part of this Worker and keeps working." }
];

export const FOOTER_FIELDS = [
  { key: "mark",  label: "Wordmark", type: "text" },
  { key: "lines", label: "Lines", type: "list", simple: "rich" }
];

export const THEME_FIELDS = {
  colours: [
    { key: "ground",     label: "Page background",        var: "--ground",     help: "The hero art is faded to this exact colour at its edges. Change it and assets/hero.jpg has to be rebuilt or you get a visible rectangle." },
    { key: "groundLift", label: "Raised panels",          var: "--ground-lift" },
    { key: "groundDeep", label: "Recessed bands",         var: "--ground-deep" },
    { key: "carve",      label: "Lines and borders",      var: "--carve" },
    { key: "carveSoft",  label: "Faint dividing lines",   var: "--carve-soft" },
    { key: "parchment",  label: "Main text",              var: "--parchment" },
    { key: "muted",      label: "Secondary text",         var: "--muted" },
    { key: "mutedDim",   label: "Labels and small print", var: "--muted-dim" },
    { key: "light",      label: "Light Affinity",   var: "--light" },
    { key: "dark",       label: "Dark Affinity",    var: "--dark" },
    { key: "solar",      label: "Solar Affinity",   var: "--solar" },
    { key: "frost",      label: "Frost Affinity",   var: "--frost" },
    { key: "earthen",    label: "Earthen Affinity", var: "--earthen" }
  ],
  fonts: [
    { key: "display",     label: "Headings",  var: "--display" },
    { key: "body",        label: "Body text", var: "--body" },
    { key: "mono",        label: "Labels and tables", var: "--mono" },
    { key: "webfontHref", label: "Webfont stylesheet", plain: true, help: "The address the page loads fonts from. Empty it once the game's own fonts are on the site." }
  ],
  layout: [
    { key: "measure",     label: "Paragraph width",       var: "--measure" },
    { key: "shellMax",    label: "Page width",            var: "--shell-max" },
    { key: "pad",         label: "Side margin",           var: "--pad" },
    { key: "sectionPad",  label: "Space above and below each section", var: "--section-pad" },
    { key: "bodySize",    label: "Body text size",        plain: true },
    { key: "bodyLine",    label: "Line spacing",          plain: true },
    { key: "radius",      label: "Corner rounding",       var: "--radius", help: "0px is square, which is what the game uses." },
    { key: "borderWidth", label: "Border thickness",      var: "--bw" }
  ]
};
