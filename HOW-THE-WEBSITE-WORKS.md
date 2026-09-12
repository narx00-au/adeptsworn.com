# adeptsworn.com — how it works now

Short version: **go to https://adeptsworn.com/admin, sign in, change things,
press Publish.** Nothing else is needed day to day. The rest of this file is
for when something looks wrong, or for a future session picking this up cold.

---

## This Worker does THREE jobs

Before anything else, know this. `wispy-brook-7be4` is not just the website.

| What | Addresses | Code | Since |
|---|---|---|---|
| Discord sign-in | `/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout` | `src/index.js` | 8 Sept |
| The game's server list | `/api/servers`, `/api/servers/heartbeat` | `src/index.js` | 10 Sept |
| The website and its editor | `/`, `/admin-api/*`, `/media/*` | `src/site.js` | 12 Sept |

`src/router.js` is the front door and decides which is which. **`src/index.js`
was not modified when the website was added** — the router simply does not send
it the website's addresses, and everything else reaches it untouched.

Two things follow from that, and both matter:

- **The website editor lives at `/admin-api/`, never `/api/`.** `/api/servers`
  belongs to the game and was here first. Anything that puts the editor back on
  `/api/` breaks the server list.
- **There are two KV stores and they are not interchangeable.** `LOBBY` holds
  the game's server list. `SITE` holds the website. A website edit cannot reach
  the game's data and the game cannot overwrite the site.

## The shape of it

The site used to be one hand-written `index.html` that Cloudflare served as a
file. It is now built by code every time somebody asks for it, out of two
things kept in the `SITE` store:

| | |
|---|---|
| **content** | every word, every card, every section, in order |
| **theme** | the colours, the fonts, the spacing |

`/admin` is a page that edits those two things. That is the whole idea.

### Draft and live are separate

Everything you change is saved as a **draft**, straight away, automatically.
A draft is invisible to the public — only you can see it, in the preview panel
on the right. The live site does not move until you press **Publish**.

So you can leave the editor half-finished for a week and the site stays as it
was. Nothing you do in there can break adeptsworn.com by accident.

### Every Publish keeps the version it replaced

Press **History** and the last 20 published versions are listed, newest first.
"Load this one" puts that version back into your draft, where you can look it
over before publishing it again. The very first entry is the site exactly as it
was before any of this existed.

---

## Dragging

The preview on the right is not a picture of the site — it *is* the site, with a
thin editing layer on top that only ever appears for you.

- **Hover** a section and it lights up. **Click** it and it is selected, both in
  the preview and in the list on the left.
- A small **toolbar** appears on the selected section: move it up or down, set
  how wide it runs, centre it, cycle its shade, hide it, delete it.
- **Drag its top or bottom edge** to change the space above or below. The number
  in rem follows your cursor so you can see what you are setting.
- **Drag the ✥ Move handle** and the whole section changes place in the page. A
  green line shows where it will land.
- In the **list on the left**, drag a row to reorder, and drag the rows inside a
  section to reorder cards, steps or table rows.

Everything dragged is saved to the draft immediately. None of it is live until
you press Publish.

## The freeform canvas

"Add a section" → **Freeform canvas** gives you a blank area you lay out by
hand. Add text, a picture, a button or a plain panel; drag them where you want
them and pull the square at the bottom-right corner to size them.

It is not truly freeform, and that is deliberate. The canvas is **twelve columns
wide**, and everything snaps to that grid. Underneath a certain width — a phone,
a narrow window — the grid gives up and everything stacks into one column, in
the order you placed it, reading top to bottom and then left to right.

That is the whole reason it snaps. Page builders that let you drop a box at any
pixel produce layouts that look right on the machine they were built on and fall
apart on a phone. This one cannot: the arrangement you drag on a desktop has a
defined, sensible phone version, and you can check it with the **Phone** button
above the preview before anyone else sees it.

---

## The files

```
website/
  wrangler.jsonc     tells Cloudflare what to run and what storage to give it
  package.json       so Cloudflare's builder knows what this is
  .assetsignore      which files are NOT part of the public site
  index.html         the hand-written page of 10 Sept. STILL PUBLISHED, as the
                     fallback — see run_worker_first below. The Worker
                     redirects /index.html to / so nobody lands on it by
                     accident while things are working.
  assets/            the pictures. Still ordinary files in this repo.
  admin/             the editor
    index.html       the shell
    admin.css        its own skin — deliberately not the site's
    admin.js         the editor itself
    preview.js       the layer that makes the preview draggable. This is the
                     only file that runs inside the page you are editing, and
                     only ever when you are signed in and previewing.
  src/
    router.js        the front door — decides which of the three jobs answers
    index.js         Discord sign-in and the game's server list. NOT MINE.
                     Nothing added on 12 Sept opens this file.
    site.js          the website: the public page and the /admin-api/
    render.js        builds the public page out of content + theme
    css.js           the stylesheet, with the theme's values poured in
    schema.js        what each kind of section is made of
    seed.js          the site as it stood before any of this. The safety net.
    auth.js          the password and the signed-in ticket
```

### seed.js is the safety net

If Cloudflare storage is ever empty, wiped, or unreachable, the Worker renders
`seed.js` instead and the site keeps working. It is never written to at runtime.
It lives in git, which means **the site can always be recovered from this repo
alone**, even with every stored version gone.

### schema.js is the one place to add a field

The admin panel knows nothing about Adeptsworn. It reads `schema.js` and builds
the editing form from it. Add a field there and a box for it appears in /admin;
add a matching line in `render.js` and it appears on the page. There is no third
place to update.

---

## Things that will bite

**The `name` in wrangler.jsonc is the Worker's identity, not a label.** It is
`wispy-brook-7be4`. Change it and Cloudflare builds a *second* Worker while both
domains keep pointing at the first, and the site silently stops updating.

**`assets.run_worker_first` is load-bearing.** Cloudflare serves a matching
file before it runs any code, and `index.html` is still sitting in this folder.
Without that line, `/` is served from the file and the page-building code never
runs. The site would look frozen in time with no error anywhere.

That is also why `index.html` is deliberately left published: if this ever
breaks, the site falls back to the hand-written page rather than to nothing.
`/auth/*` and `/api/servers` are not in that list and do not need to be — there
are no files at those addresses, so they reach the Worker anyway.

**There is a window after publishing where the live site still serves the old
page.** Give it a minute. Check on a phone on mobile data — your PC's cache will
lie to you. This was true before and it is still true.

**The page background and the hero art are coupled.** `assets/hero.jpg` has its
edges faded to `#13151b` so it melts into the page. Change the page background
in the Design tab and the art will sit in a visible rectangle until that file is
rebuilt. The admin panel says so under that colour, and it is worth believing.

**Card names and rules come out of `data/Cards`, never out of memory.** A wrong
guess in the game engine throws an error. A wrong guess on the website just sits
there looking official — it happened on 6 September with two Realm cards that do
not exist. Read the file.

---

## If the editor will not let you in

- **"No admin password has been set"** — the Worker has no `ADMIN_PASSWORD`
  secret. Cloudflare dashboard → the Worker → Settings → Variables and Secrets →
  add a Secret named `ADMIN_PASSWORD`. Then reload /admin.
- **"Too many wrong passwords"** — ten wrong tries from one address locks that
  address out for fifteen minutes. Wait it out.
- **"No storage is connected"** — the KV namespace binding named `SITE` is
  missing or its id in `wrangler.jsonc` is wrong. The public site keeps working
  off `seed.js` while this is true; only saving is broken. Check you have not
  confused it with `LOBBY`, which is the game's.

Forgotten the password? Change the `ADMIN_PASSWORD` secret to something new.
Every signed-in session is signed out the moment you do — the ticket is derived
from the password, so changing it invalidates all of them.

---

## The Discord sign-in strip

The "Sign in with Discord" line at the top of the hero is part of the page the
Worker builds, and there is a switch for it in the editor's Settings tab. **That
switch only hides the strip.** Sign-in itself is `src/index.js` answering
`/auth/*` and keeps working whatever the switch says.

## Deploying

Unchanged: `tools\Publish-Website.bat` commits and pushes, and Cloudflare
rebuilds the Worker from the push. You only need this when the *code* changes.
Editing the site through /admin does not touch git at all and does not need a
deploy — it is live the moment you press Publish.
