// ---------------------------------------------------------------------------
// seed.js — the site exactly as it stood before the admin panel existed.
//
// This is the SAFETY NET. It lives in git, so if Cloudflare KV is ever empty,
// wiped, or unreachable, the Worker renders this and the site keeps working.
// It is never written to at runtime. Editing happens in KV, through /admin.
//
// Every word, card name and rule below was copied out of the old index.html.
// Nothing here was invented. Card names and rules come from data/Cards.
// ---------------------------------------------------------------------------

export const DEFAULT_THEME = {
  colours: {
    ground:       "#13151b",
    groundLift:   "#1a1d25",
    groundDeep:   "#0d0f13",
    carve:        "#2b303b",
    carveSoft:    "#20242d",
    parchment:    "#e7e3d9",
    muted:        "#98a1b0",
    mutedDim:     "#6c7484",
    light:        "#e3cf94",
    dark:         "#a97ec0",
    solar:        "#e28c3c",
    frost:        "#8fc0dd",
    earthen:      "#9dae66"
  },
  fonts: {
    display: '"Cinzel",Georgia,"Times New Roman",serif',
    body:    '"Spectral",Georgia,"Times New Roman",serif',
    mono:    '"IBM Plex Mono",ui-monospace,"SFMono-Regular",Consolas,monospace',
    // The <link> the page loads for webfonts. Empty string = load nothing,
    // which is what you want once the game's own fonts are self-hosted.
    webfontHref: "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Spectral:ital,wght@0,300;0,400;0,600;1,300;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
  },
  layout: {
    measure:     "63ch",
    shellMax:    "1180px",
    pad:         "clamp(1.25rem,5vw,3.5rem)",
    sectionPad:  "clamp(3.5rem,9vh,6.5rem)",
    bodySize:    "clamp(1rem,0.95rem + 0.25vw,1.115rem)",
    bodyLine:    "1.65",
    radius:      "0px",
    borderWidth: "1px"
  },
  custom: ""   // extra CSS, appended last, wins over everything above
};

export const DEFAULT_CONTENT = {
  site: {
    title:         "Adeptsworn",
    description:   "A tactical spell duel for two to five players. Commit your Realms, spend the Power, and live with what you promised. In development.",
    ogTitle:       "Adeptsworn",
    ogDescription: "A tactical spell duel for two to five players. Last player alive wins.",
    ogImage:       "https://adeptsworn.com/assets/hero.jpg",
    url:           "https://adeptsworn.com/",
    favicon:       "assets/favicon.png",
    appleIcon:     "assets/apple-touch-icon.png",
    lang:          "en",
    // The Discord sign-in strip at the top of the hero. It was added to the
    // live page on 8 September and it is ON. Turning it off here removes the
    // strip and its script from the page; it does NOT disable Discord
    // sign-in, which lives in src/index.js and answers /auth/*.
    accountStrip:  true
  },

  footer: {
    mark: "Adeptsworn",
    lines: [
      "An independent card game in development. Set VW01. Not affiliated with anybody.",
      'Say hello: <a class="link" href="mailto:hello@adeptsworn.com">hello@adeptsworn.com</a>'
    ]
  },

  blocks: [
    {
      id: "hero",
      type: "hero",
      name: "Hero",
      hidden: false,
      eyebrow: "Set VW01 · In development",
      image: "assets/hero.jpg",
      imageAlt: "Adeptsworn",
      imageWidth: 1600,
      imageHeight: 902,
      tagline: "Every oath is temporary.",
      lede: "A tactical spell duel for two to five. Commit your Realms for Power, spend it on Minions and Sorceries, and get it back one turn later than you would like.",
      kicker: "Last player alive wins. There is nothing more to victory than that.",
      pills: [
        { text: "Local network play — working", strong: true },
        { text: "Internet play — being built", strong: false },
        { text: "113 cards · 5 Adepts", strong: false }
      ]
    },

    {
      id: "rhythm",
      type: "realms-demo",
      name: "The core rhythm (interactive)",
      hidden: false,
      background: "deep",
      eyebrow: "The core rhythm",
      heading: "Commit, spend, wait.",
      intro: "Every Realm you control is a switch you can throw once. Turn it sideways — <em>commit</em> it — and it pays you one Power of its Affinity. It stays sideways until your own Restoration Stage. Try it.",
      realms: [
        { name: "Radiant Star",  rule: "Commit: add 1 Light",   affinity: "light",   image: "assets/realm_light.jpg",   icon: "assets/icon_light.png",   alt: "Radiant Star — a shining star over a bright landscape" },
        { name: "Frostpeak",     rule: "Commit: add 1 Frost",   affinity: "frost",   image: "assets/realm_frost.jpg",   icon: "assets/icon_frost.png",   alt: "Frostpeak — a frozen mountain summit" },
        { name: "Verdant Grove", rule: "Commit: add 1 Earthen", affinity: "earthen", image: "assets/realm_earthen.jpg", icon: "assets/icon_earthen.png", alt: "Verdant Grove — a deep green wooded grove" }
      ],
      batteryLabel: "Energy Battery",
      emptyText: "Empty. Commit a Realm.",
      buttonEnd:         "End Stage",
      buttonEndNote:     "Unused Power disappears. The Realms stay down.",
      buttonRestore:     "Your Restoration Stage",
      buttonRestoreNote: "Everything you committed stands back up.",
      note: "That gap is the whole game. Power spent holding a trick on somebody else’s turn is Power you do not have on your own."
    },

    {
      id: "affinities",
      type: "cards",
      name: "Five Affinities",
      hidden: false,
      background: "ground",
      fullBleed: true,
      columns: 5,
      eyebrow: "Five Affinities, five Adepts",
      heading: "Pick one. Nobody else can have it.",
      intro: "Your Adept is your avatar and a real creature on the board. It starts face down and useless. Pay its cost to flip it and it hits the table with a bang — and from that moment it can be attacked, blocked and killed like anything else.",
      items: [
        { eyebrow: "Light",   title: "Seraphine, Dawncaller",  subtitle: "Unbroken Vigil",   text: "Hold your hand and your Minions shrug off damage. Swing, and the protection is gone until you next stand still.",              image: "assets/adept_light.jpg",   icon: "assets/icon_light.png",   hue: "light",   alt: "Seraphine, Dawncaller — a robed figure haloed in light" },
        { eyebrow: "Dark",    title: "Morvath, Soulbinder",    subtitle: "Harvest",          text: "Your own dead pay you. The first Minion you lose each turn draws you a card, and somebody across the table loses Life for it.",    image: "assets/adept_dark.jpg",    icon: "assets/icon_dark.png",    hue: "dark",    alt: "Morvath, Soulbinder — a dark sorcerer amid bound souls" },
        { eyebrow: "Solar",   title: "Kaelis, Sunforged",      subtitle: "Forge-Heat",       text: "Everything you summon can attack the moment it lands. No waiting, no build-up, no mercy.",                                       image: "assets/adept_solar.jpg",   icon: "assets/icon_solar.png",   hue: "solar",   alt: "Kaelis, Sunforged — a smith wreathed in forge-fire" },
        { eyebrow: "Frost",   title: "Medalin, Iceweaver",     subtitle: "Deepening Cold",   text: "Enemy Minions arrive already committed. They turn up to the fight lying down, and there is nothing they can do about it.",      image: "assets/adept_frost.jpg",   icon: "assets/icon_frost.png",   hue: "frost",   alt: "Medalin, Iceweaver — a hooded figure in a blizzard holding an ice stave" },
        { eyebrow: "Earthen", title: "Bertha of Girthwall",    subtitle: "Deep Foundations", text: "The first Realm you commit each turn pays double. Slow to start, impossible to out-resource.",                                   image: "assets/adept_earthen.jpg", icon: "assets/icon_earthen.png", hue: "earthen", alt: "Bertha of Girthwall — a crowned warrior in moss-covered plate armour, holding a glowing golden axe in a sunlit forest" }
      ]
    },

    {
      id: "turn",
      type: "steps",
      name: "The turn",
      hidden: false,
      background: "deep",
      numbered: true,
      eyebrow: "One turn, in order",
      heading: "Six stages, and a second bite.",
      intro: "A turn is one player’s pass through these. A round is everybody taking one. Every card in the game is written in turns — at a five-player table, that is a fivefold difference.",
      items: [
        { name: "Restoration",       desc: "Your committed cards stand back up. Every Minion on the table — not just yours — heals every wound. A cut lasts until the next Restoration, whoever’s turn that is." },
        { name: "Draw",              desc: "One card, and you choose blind which deck it comes from: Spells or Realms. Seven to open the game. Whoever goes first skips this on turn one — that is the price of the seat." },
        { name: "Operations",        desc: "Play a Realm, summon Minions, cast Sorceries, equip Relics, flip your Adept face up." },
        { name: "Combat",            desc: "Attack a player, or attack their Adept directly. Anyone at the table may intervene — on either side." },
        { name: "Second Operations", desc: "A second window after the dust settles, so you can act on what actually survived rather than on what you hoped would." },
        { name: "End",               desc: "Discard what you did not want — and it is <em>offered to whoever is on the lowest Life</em>, to take or refuse. Then trim to seven, and any Power you did not spend is gone." }
      ]
    },

    {
      id: "table",
      type: "split-table",
      name: "The table",
      hidden: false,
      background: "ground",
      eyebrow: "Two to five players",
      heading: "The duel is fine. The table is the point.",
      paragraphs: [
        "Three to five players is a free-for-all, and conversation, trading, bargaining and betrayal are part of the rules rather than something that happens around them. You may only <em>open</em> a negotiation if you hold the live decision — you are the active player, or somebody has just aimed something at you. Bystanders can answer an offer. They cannot start one.",
        "Promises are not binding. An agreed trade is."
      ],
      tableLabel: "Starting Life by table size",
      tableHead: ["Players", "Life", "Why"],
      tableRows: [
        ["2", "20", "The duel"],
        ["3", "17", "Politics begins"],
        ["4", "15", "Crowded"],
        ["5", "13", "Full table"]
      ],
      tableNote: "Life drops as the table grows so every size lands in roughly the same thirteen-round game. At a flat 20, a five-player game runs half as long again."
    },

    {
      id: "status",
      type: "status",
      name: "Build status",
      hidden: false,
      background: "deep",
      eyebrow: "Where it is up to",
      heading: "Honest build status.",
      intro: "Adeptsworn is being built by one person in the evenings. Nothing below is a promise with a date on it.",
      rows: [
        { tag: "Working",     tone: "on",   text: "<b>The game.</b> Full rules engine, five Adepts, 113 cards, AI opponents that assess the whole table before choosing who to hit." },
        { tag: "Working",     tone: "on",   text: "<b>Play over a local network.</b> Host on one machine, join from another, up to five seats with humans and AI mixed." },
        { tag: "Working",     tone: "on",   text: "<b>Card art.</b> Every card in the shipping set is illustrated." },
        { tag: "In progress", tone: "now",  text: "<b>Play over the internet.</b> A dedicated server is running in Sydney. Matches do not run on anybody’s home PC." },
        { tag: "Planned",     tone: "off",  text: "<b>Accounts and profiles.</b> Sign in, a match history, wins and losses, friends and private groups." },
        { tag: "Planned",     tone: "off",  text: "<b>Custom modes.</b> The two-player and big-table variants as a per-game choice rather than a build." }
      ]
    },

    {
      id: "contact",
      type: "contact",
      name: "Contact",
      hidden: false,
      background: "ground",
      eyebrow: "Get in touch",
      heading: "Tell me it’s broken. Or tell me it’s good.",
      intro: "One person builds this, and reads everything that arrives. Feedback on the rules and the balance is the most useful thing you can send — it is a card game, and card games are only ever fixed by people playing them.",
      forms: [
        {
          title: "Feedback",
          lede: 'Balance, rules, the art, anything that felt wrong. Goes to <strong>feedback@adeptsworn.com</strong>. For a bug you can reproduce, <a class="link" href="mailto:devops@adeptsworn.com">devops@</a> is the faster route.',
          accessKey: "acd70eda-9d65-41a5-b02a-1cc67fbde65d",
          subject: "Adeptsworn — feedback from the website",
          send: "Send feedback",
          fields: [
            { kind: "select",   name: "topic",   label: "What is it about", options: ["Game balance", "A rule that is unclear", "Something broken", "The card art", "Something else"] },
            { kind: "email",    name: "email",   label: "Your email", hint: "— only if you want a reply", required: false, placeholder: "you@example.com" },
            { kind: "textarea", name: "message", label: "What happened", required: true, placeholder: "The more specific the better. What you did, what you expected, what you got." }
          ]
        },
        {
          title: "Contact",
          lede: "Anything else — questions, playtesting, or just saying hello. Goes to <strong>hello@adeptsworn.com</strong>.",
          accessKey: "9514d3b8-1410-4d06-88d1-1735f6fd9f94",
          subject: "Adeptsworn — message from the website",
          send: "Send message",
          fields: [
            { kind: "text",     name: "name",    label: "Your name", required: true, placeholder: "What should I call you?" },
            { kind: "email",    name: "email",   label: "Your email", required: true, placeholder: "you@example.com" },
            { kind: "textarea", name: "message", label: "Message", required: true, placeholder: "Go on then." }
          ]
        }
      ],
      addressesLede: "<strong>Prefer email?</strong> These are the same addresses the game itself gives you:",
      addresses: [
        { what: "Bug reports",    email: "devops@adeptsworn.com" },
        { what: "Feedback",       email: "feedback@adeptsworn.com" },
        { what: "Anything else",  email: "hello@adeptsworn.com" }
      ],
      privacy: 'Messages sent through the forms above are relayed by <a class="link" href="https://web3forms.com" rel="noopener">Web3Forms</a>, which passes them to my inbox. Your address is used to reply to you and nothing else — there is no mailing list, and nothing is stored on this site.'
    }
  ]
};
