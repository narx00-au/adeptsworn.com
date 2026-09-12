// ---------------------------------------------------------------------------
// css.js — the site's stylesheet, built from the theme.
//
// The rules are the SAME ones the hand-written index.html used. The only
// change is that the values at the top now come from theme.json instead of
// being typed in, so the Design tab in /admin can move them.
// ---------------------------------------------------------------------------

export function buildCss(theme) {
  const c = theme.colours, f = theme.fonts, l = theme.layout;
  return `
:root{
  --ground:${c.ground};
  --ground-lift:${c.groundLift};
  --ground-deep:${c.groundDeep};
  --carve:${c.carve};
  --carve-soft:${c.carveSoft};
  --parchment:${c.parchment};
  --muted:${c.muted};
  --muted-dim:${c.mutedDim};

  --light:${c.light};
  --dark:${c.dark};
  --solar:${c.solar};
  --frost:${c.frost};
  --earthen:${c.earthen};

  --display:${f.display};
  --body:${f.body};
  --mono:${f.mono};

  --measure:${l.measure};
  --pad:${l.pad};
  --shell-max:${l.shellMax};
  --section-pad:${l.sectionPad};
  --radius:${l.radius};
  --bw:${l.borderWidth};
  color-scheme:dark;
}

*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;
  background:var(--ground);
  color:var(--parchment);
  font-family:var(--body);
  font-weight:300;
  font-size:${l.bodySize};
  line-height:${l.bodyLine};
  overflow-x:hidden;
}
img{max-width:100%;display:block}
a{color:inherit}
.link{
  color:var(--parchment);
  text-decoration:none;
  border-bottom:1px solid rgba(231,227,217,.32);
  padding-bottom:1px;
  transition:border-color .2s,color .2s;
}
.link:hover{border-bottom-color:var(--parchment)}
:focus-visible{outline:2px solid var(--parchment);outline-offset:3px}

h1,h2,h3{font-family:var(--display);font-weight:500;text-wrap:balance;margin:0;line-height:1.15}
p{margin:0}

.label{
  font-family:var(--mono);
  font-size:.72rem;
  letter-spacing:.22em;
  text-transform:uppercase;
  color:var(--muted-dim);
  font-weight:500;
}

.shell{max-width:var(--shell-max);margin:0 auto;padding-inline:var(--pad)}
.prose{max-width:var(--measure)}

.rule{border:0;height:0;border-top:var(--bw) solid var(--carve);border-bottom:1px solid rgba(231,227,217,.05);margin:0}

/* ---------- how wide a section runs, and how much air it gets ----------
   Set by dragging in the editor. A section with nothing set falls back to the
   theme's own values, so the page still has one rhythm unless you break it
   on purpose. --------------------------------------------------------- */
.w-narrow  > .shell{max-width:48rem}
.w-normal  > .shell{max-width:var(--shell-max)}
.w-wide    > .shell{max-width:1480px}
.w-full    > .shell{max-width:none}
.align-center{text-align:center}
.align-center .sec-head{align-items:center}
.align-center .sec-head p,
.align-center .prose{margin-inline:auto}
.align-center .cta{align-items:center}
.align-center .turn__desc{margin-inline:auto}
section[style*="--sec-pt"]{padding-top:var(--sec-pt,var(--section-pad))}
section[style*="--sec-pb"]{padding-bottom:var(--sec-pb,var(--section-pad))}

/* ---------- backgrounds a section can wear ---------- */
.bg-ground{background:var(--ground)}
.bg-deep{background:var(--ground-deep);border-block:var(--bw) solid var(--carve)}
.bg-lift{background:var(--ground-lift);border-block:var(--bw) solid var(--carve)}

/* =========================================================
   HERO
   ========================================================= */
.hero{position:relative;overflow:hidden;border-bottom:var(--bw) solid var(--carve)}
.hero__inner{
  position:relative;
  padding-block:clamp(1.5rem,5vh,3rem) clamp(3.5rem,9vh,6rem);
  display:flex;flex-direction:column;gap:1.75rem;
}
/* The wordmark is the key art itself, not type. Its edges are already
   faded to --ground in the file, so it melts into the page instead of
   sitting in a visible box -- which means the page background and the
   image background have to stay the same colour. Change --ground and
   this asset has to be rebuilt. */
.wordmark{margin:0 0 -1.1rem;line-height:0}
.wordmark img{display:block;width:100%;max-width:880px;height:auto;margin-inline-start:-3.5%}
.hero__tagline{
  font-family:var(--display);
  font-size:clamp(1rem,.85rem + .75vw,1.5rem);
  letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:0;
}
.hero__lede{max-width:52ch;font-size:clamp(1.1rem,1rem + .55vw,1.4rem);line-height:1.55;color:var(--parchment)}
.hero__kicker{font-style:italic;color:var(--muted);max-width:46ch}
.hero__meta{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;align-items:baseline;padding-top:.5rem}
.pill{
  font-family:var(--mono);font-size:.72rem;letter-spacing:.16em;text-transform:uppercase;
  border:var(--bw) solid var(--carve);padding:.4rem .7rem;color:var(--muted);border-radius:var(--radius);
}
.pill--live{color:var(--parchment);border-color:rgba(231,227,217,.35)}


/* The hero uses the same spacing variables as the other sections. */
.hero[style*="--sec-pt"] .hero__inner{padding-top:var(--sec-pt)}
.hero[style*="--sec-pb"] .hero__inner{padding-bottom:var(--sec-pb)}
.hero.align-center .hero__inner{align-items:center;text-align:center}
.hero.align-center .wordmark img{margin-inline-start:0}
/* =========================================================
   Shared section frame
   ========================================================= */
section{padding-block:var(--section-pad)}
.sec-head{display:flex;flex-direction:column;gap:.9rem;margin-bottom:2.75rem}
.sec-head h2{font-size:clamp(1.6rem,1.2rem + 1.5vw,2.5rem);letter-spacing:.03em}
.sec-head p{color:var(--muted);max-width:var(--measure)}

/* =========================================================
   THE RHYTHM — interactive commit / restore
   ========================================================= */
.rhythm__grid{display:grid;gap:clamp(2rem,5vw,4rem);grid-template-columns:1fr}
@media(min-width:900px){.rhythm__grid{grid-template-columns:minmax(0,1fr) minmax(0,26rem)}}

.realms{display:flex;gap:clamp(.75rem,2.5vw,1.5rem);flex-wrap:wrap;align-items:flex-start}
.realm{
  --hue:var(--muted);
  width:clamp(6.5rem,20vw,8.5rem);
  aspect-ratio:5/7;
  background:linear-gradient(165deg,var(--ground-lift),#101319);
  border:var(--bw) solid var(--carve);
  color:var(--parchment);
  font-family:var(--body);
  display:flex;flex-direction:column;
  padding:.55rem;cursor:pointer;text-align:left;border-radius:var(--radius);
  transition:transform .42s cubic-bezier(.34,1.3,.5,1), border-color .3s, box-shadow .3s;
  transform-origin:50% 50%;
}
.realm:hover{border-color:var(--hue)}
.realm[aria-pressed="true"]{
  transform:rotate(90deg);
  border-color:var(--hue);
  box-shadow:0 0 0 1px color-mix(in srgb,var(--hue) 40%,transparent);
}
.realm__art{position:relative;aspect-ratio:4/3;overflow:hidden;border:var(--bw) solid var(--carve);margin-bottom:.55rem;background:#0b0d11}
.realm__art img.realm__pic{width:100%;height:100%;object-fit:cover}
.realm__icon{position:absolute;top:.3rem;left:.3rem;width:1.15rem;height:1.15rem;object-fit:contain;opacity:.95;filter:drop-shadow(0 1px 2px rgba(0,0,0,.9));z-index:2}
.realm__name{font-size:.92rem;line-height:1.2;font-weight:400}
.realm__rule{font-family:var(--mono);font-size:.62rem;letter-spacing:.06em;color:var(--hue);text-transform:uppercase}
.realm__foot{margin-top:auto;padding-top:.4rem}
.realm--light{--hue:var(--light)}
.realm--dark{--hue:var(--dark)}
.realm--solar{--hue:var(--solar)}
.realm--frost{--hue:var(--frost)}
.realm--earthen{--hue:var(--earthen)}

.rhythm__stage{min-height:calc(clamp(6.5rem,20vw,8.5rem) * 7/5 + 1rem);display:flex;align-items:center}

.battery{border:var(--bw) solid var(--carve);padding:1.35rem;background:var(--ground);border-radius:var(--radius)}
.battery__head{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;margin-bottom:1rem}
.battery__count{font-family:var(--mono);font-size:1.5rem;font-variant-numeric:tabular-nums;color:var(--parchment)}
.pips{display:flex;gap:.45rem;flex-wrap:wrap;min-height:1.6rem;align-items:center}
.pip{width:1.15rem;height:1.15rem;border-radius:50%;background:var(--pip);box-shadow:0 0 10px color-mix(in srgb,var(--pip) 55%,transparent);animation:pip-in .35s cubic-bezier(.34,1.4,.5,1) both}
@keyframes pip-in{from{transform:scale(.2);opacity:0}to{transform:scale(1);opacity:1}}
.pips__empty{font-style:italic;color:var(--muted-dim);font-size:.95rem}

.stages{display:flex;flex-direction:column;gap:.6rem;margin-top:1.5rem}
.stage-btn{
  font-family:var(--mono);font-size:.75rem;letter-spacing:.14em;text-transform:uppercase;
  background:transparent;border:var(--bw) solid var(--carve);color:var(--parchment);
  padding:.75rem .9rem;cursor:pointer;text-align:left;border-radius:var(--radius);
  transition:background .2s,border-color .2s;
}
.stage-btn:hover{background:var(--ground-lift);border-color:rgba(231,227,217,.4)}
.stage-btn small{display:block;font-family:var(--body);font-size:.85rem;letter-spacing:0;text-transform:none;color:var(--muted);margin-top:.2rem}
.rhythm__note{margin-top:1.5rem;color:var(--muted);font-style:italic;font-size:.95rem}

/* =========================================================
   CARD GRID (the Affinities, and any grid you add)
   ========================================================= */
.affinities{display:grid;gap:1px;background:var(--carve);grid-template-columns:1fr}
@media(min-width:640px){.affinities{grid-template-columns:repeat(2,1fr)}}
@media(min-width:1000px){
  .affinities[data-cols="2"]{grid-template-columns:repeat(2,1fr)}
  .affinities[data-cols="3"]{grid-template-columns:repeat(3,1fr)}
  .affinities[data-cols="4"]{grid-template-columns:repeat(4,1fr)}
  .affinities[data-cols="5"]{grid-template-columns:repeat(5,1fr)}
}
.aff{background:var(--ground);display:flex;flex-direction:column;position:relative}
.aff__img{position:relative;aspect-ratio:3/2;overflow:hidden}
@media(min-width:1000px){.aff__img{aspect-ratio:3/4}}
.aff__img img{width:100%;height:100%;object-fit:cover;filter:saturate(.85);transition:transform .8s ease, filter .6s ease}
.aff:hover .aff__img img{transform:scale(1.045);filter:saturate(1.05)}
.aff__img::after{content:"";position:absolute;inset:0;background:linear-gradient(to top,var(--ground) 2%,color-mix(in srgb,var(--ground) 15%,transparent) 55%,color-mix(in srgb,var(--ground) 35%,transparent) 100%)}
.aff__img .aff__sym{position:absolute;top:.9rem;left:.9rem;width:1.6rem;height:1.6rem;z-index:2;object-fit:contain;opacity:.92;filter:drop-shadow(0 1px 3px rgba(0,0,0,.85))}
.aff__body{padding:1.1rem 1.15rem 1.6rem;display:flex;flex-direction:column;gap:.55rem;flex:1}
.aff__name{font-family:var(--mono);font-size:.72rem;letter-spacing:.22em;text-transform:uppercase;color:var(--hue)}
.aff__adept{font-family:var(--display);font-size:1.05rem;line-height:1.25}
.aff__passive{font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-dim)}
.aff__text{font-size:.92rem;color:var(--muted);line-height:1.55}
.aff--light{--hue:var(--light)}
.aff--dark{--hue:var(--dark)}
.aff--solar{--hue:var(--solar)}
.aff--frost{--hue:var(--frost)}
.aff--earthen{--hue:var(--earthen)}
.aff--none{--hue:var(--muted)}

/* =========================================================
   STEPS — a real ordered sequence, so numbers are honest
   ========================================================= */
.turn__list{list-style:none;margin:0;padding:0;display:grid;gap:0}
.turn__item{display:grid;grid-template-columns:2.75rem 1fr;gap:1.25rem;padding-block:1.4rem;border-top:1px solid var(--carve-soft);align-items:start}
.turn__list[data-numbered="no"] .turn__item{grid-template-columns:1fr}
.turn__item:first-child{border-top:0}
.turn__n{font-family:var(--mono);font-size:.82rem;color:var(--muted-dim);padding-top:.28rem;font-variant-numeric:tabular-nums}
.turn__name{font-family:var(--display);font-size:1.1rem;letter-spacing:.02em}
.turn__desc{color:var(--muted);font-size:.96rem;margin-top:.3rem;max-width:58ch}

/* =========================================================
   SPLIT + TABLE
   ========================================================= */
.split{display:grid;gap:clamp(2rem,5vw,4rem);grid-template-columns:1fr}
@media(min-width:860px){.split{grid-template-columns:minmax(0,1.15fr) minmax(0,1fr)}}
.tablewrap{overflow-x:auto}
table{border-collapse:collapse;width:100%;font-family:var(--mono);font-size:.9rem;font-variant-numeric:tabular-nums}
th,td{text-align:left;padding:.72rem .9rem;border-bottom:1px solid var(--carve-soft)}
thead th{font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--muted-dim);border-bottom-color:var(--carve);font-weight:500}
tbody tr:hover{background:var(--ground-lift)}
td:first-child{color:var(--parchment)}
td:last-child{color:var(--muted)}
.tablenote{color:var(--muted);font-size:.92rem;margin-top:1rem;font-style:italic}
.split__p + .split__p{margin-top:1.1rem}

/* =========================================================
   STATUS
   ========================================================= */
.status__list{list-style:none;margin:0;padding:0;display:grid;gap:0}
.status__row{display:grid;grid-template-columns:auto 1fr;gap:1rem;align-items:baseline;padding-block:.95rem;border-top:1px solid var(--carve-soft)}
.status__row:first-child{border-top:0}
.status__tag{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;border:var(--bw) solid var(--carve);padding:.28rem .55rem;color:var(--muted-dim);white-space:nowrap;border-radius:var(--radius)}
.status__tag--on{color:var(--parchment);border-color:rgba(231,227,217,.4)}
.status__tag--now{color:var(--solar);border-color:color-mix(in srgb,var(--solar) 45%,transparent)}
.status__tag--good{color:var(--earthen);border-color:color-mix(in srgb,var(--earthen) 45%,transparent)}
.status__txt{color:var(--muted)}
.status__txt b{color:var(--parchment);font-weight:600}

/* =========================================================
   PROSE / GALLERY / CALL TO ACTION — blocks you can add
   ========================================================= */
.pblock p + p{margin-top:1.1rem}
.gallery{display:grid;gap:1px;background:var(--carve);grid-template-columns:repeat(2,1fr)}
@media(min-width:900px){
  .gallery[data-cols="2"]{grid-template-columns:repeat(2,1fr)}
  .gallery[data-cols="3"]{grid-template-columns:repeat(3,1fr)}
  .gallery[data-cols="4"]{grid-template-columns:repeat(4,1fr)}
}
.gallery figure{margin:0;background:var(--ground)}
.gallery img{width:100%;height:100%;object-fit:cover;aspect-ratio:16/10}
.gallery figcaption{padding:.7rem .9rem;color:var(--muted);font-size:.88rem}
.cta{display:flex;flex-direction:column;gap:1.25rem;align-items:flex-start}
.cta__row{display:flex;flex-wrap:wrap;gap:.75rem}
.btn{
  font-family:var(--mono);font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;
  border:var(--bw) solid var(--carve);color:var(--muted);background:transparent;
  padding:.8rem 1.2rem;cursor:pointer;text-decoration:none;display:inline-block;border-radius:var(--radius);
  transition:background .2s,border-color .2s,color .2s;
}
.btn:hover{background:var(--ground-lift);border-color:rgba(231,227,217,.4);color:var(--parchment)}
.btn--primary{background:var(--ground-lift);border-color:rgba(231,227,217,.34);color:var(--parchment)}
.btn--primary:hover{background:var(--carve);border-color:var(--parchment)}

/* =========================================================
   FREEFORM CANVAS
   Twelve columns wide and as many rows tall as you use. On a narrow screen the
   grid gives up and everything stacks in the order it was placed — which is
   why render.js sorts by row, then column, before writing it out. A layout
   dragged on a desktop therefore cannot break on a phone.
   ========================================================= */
.canvas{
  display:grid;
  grid-template-columns:repeat(12,minmax(0,1fr));
  grid-auto-rows:var(--canvas-row,4rem);
  gap:var(--canvas-gap,1rem);
}
.citem{
  grid-column:var(--x,1) / span var(--w,3);
  grid-row:var(--y,1) / span var(--h,2);
  min-width:0;min-height:0;
  display:flex;flex-direction:column;justify-content:center;
}
.citem--image{justify-content:stretch}
.citem--image img{width:100%;height:100%;object-fit:cover;border-radius:var(--radius)}
.citem--button{align-items:flex-start;justify-content:center}
.citem--panel{border:var(--bw) solid var(--carve);background:var(--ground-lift);border-radius:var(--radius)}
.ctext{min-width:0;overflow-wrap:break-word}
.csize--small   .ctext,.csize--small{font-size:.85rem;color:var(--muted)}
.csize--body    .ctext{font-size:1rem}
.csize--lead    .ctext{font-size:clamp(1.1rem,1rem + .55vw,1.4rem);line-height:1.5}
.csize--title   .ctext{font-family:var(--display);font-size:clamp(1.3rem,1.1rem + 1vw,2rem);line-height:1.2}
.csize--display .ctext{font-family:var(--display);font-size:clamp(1.8rem,1.2rem + 2.4vw,3.4rem);line-height:1.1;letter-spacing:.02em}
.align-center .citem{align-items:center;text-align:center}

@media(max-width:700px){
  .canvas{display:flex;flex-direction:column}
  .citem{grid-column:auto;grid-row:auto}
  .citem--image{min-height:12rem}
  .citem--panel{min-height:6rem}
}

/* =========================================================
   FOOTER
   ========================================================= */
footer{border-top:var(--bw) solid var(--carve);padding-block:3rem;background:var(--ground-deep)}
.foot{display:flex;flex-wrap:wrap;gap:1.5rem 2.5rem;justify-content:space-between;align-items:baseline}
.foot p{color:var(--muted-dim);font-size:.88rem}
.foot__mark{font-family:var(--display);letter-spacing:.14em;text-transform:uppercase;font-size:.95rem;color:var(--muted)}

/* =========================================================
   CONTACT — forms
   ========================================================= */
.forms{display:grid;gap:1px;background:var(--carve);border:var(--bw) solid var(--carve);grid-template-columns:1fr}
@media(min-width:840px){.forms[data-count="2"]{grid-template-columns:repeat(2,1fr)}}
.formcard{background:var(--ground-deep);padding:clamp(1.4rem,3vw,2.1rem);display:flex;flex-direction:column;gap:1rem}
.formcard h3{font-size:1.25rem;letter-spacing:.02em}
.formcard__lede{color:var(--muted);font-size:.95rem;line-height:1.55}
.field{display:flex;flex-direction:column;gap:.4rem}
.flabel{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-dim)}
.flabel span{text-transform:none;letter-spacing:0;font-family:var(--body);font-style:italic}
.finput{
  font-family:var(--body);font-size:1rem;font-weight:300;
  color:var(--parchment);background:var(--ground);
  border:var(--bw) solid var(--carve);padding:.6rem .7rem;width:100%;border-radius:var(--radius);
  transition:border-color .2s;
}
.finput::placeholder{color:var(--muted-dim);opacity:.8}
.finput:hover{border-color:rgba(231,227,217,.28)}
.finput:focus{outline:none;border-color:var(--parchment)}
textarea.finput{resize:vertical;min-height:7.5rem;line-height:1.5}
select.finput{appearance:none;cursor:pointer}
.fsend{
  font-family:var(--mono);font-size:.75rem;letter-spacing:.16em;text-transform:uppercase;
  background:var(--ground-lift);border:var(--bw) solid rgba(231,227,217,.34);color:var(--parchment);
  padding:.8rem 1.2rem;cursor:pointer;align-self:flex-start;border-radius:var(--radius);
  transition:background .2s,border-color .2s;
}
.fsend:hover{background:var(--carve);border-color:var(--parchment)}
.fsend[disabled]{opacity:.55;cursor:default}
.fnote{font-size:.92rem;line-height:1.5;min-height:1.4rem;color:var(--muted)}
.fnote[data-state="ok"]{color:var(--earthen)}
.fnote[data-state="bad"]{color:var(--solar)}
.fhp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.contact__foot{margin-top:1.75rem;color:var(--muted-dim);font-size:.9rem;line-height:1.6;max-width:var(--measure);display:flex;flex-direction:column;gap:.9rem}
.contact__foot strong{color:var(--muted);font-weight:600}
.addrs{list-style:none;margin:0;padding:0;display:grid;gap:.45rem}
.addrs li{display:grid;grid-template-columns:9rem 1fr;gap:.5rem;align-items:baseline}
@media(max-width:520px){.addrs li{grid-template-columns:1fr;gap:.1rem}}
.addrs__what{font-family:var(--mono);font-size:.66rem;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-dim)}

/* =========================================================
   ACCOUNT STRIP — added 8 September 2026 with Discord sign-in.
   Deliberately NOT Discord blurple. This page's own rule, written
   at the top of this stylesheet, is that the only chroma here is
   Affinity colour, so colour always means something. A purple
   button would be the first thing on the page that means nothing.
   It is stone, like every other control.
   ========================================================= */
.account{
  display:flex;justify-content:flex-end;align-items:center;gap:1rem;
  font-family:var(--mono);font-size:.72rem;letter-spacing:.12em;
  text-transform:uppercase;
  margin-bottom:.5rem;
}
.account__who{color:var(--muted)}
/* A person's name is not a label. Everything else in this strip is
   uppercase because it is furniture; the name renders exactly as
   they typed it. */
.account__who strong{color:var(--parchment);font-weight:500;letter-spacing:.06em;text-transform:none;font-size:.8rem}
.account__in,.account__out{
  color:var(--parchment);text-decoration:none;
  border:var(--bw) solid var(--carve);
  background:var(--ground-lift);
  padding:.5rem .9rem;
  transition:border-color .2s,background .2s;
}
.account__in:hover,.account__out:hover{
  border-color:var(--muted-dim);
  background:var(--carve-soft);
}
.account__out{border-color:transparent;background:none;padding:.5rem 0;color:var(--muted-dim)}
.account__out:hover{background:none;border-color:transparent;color:var(--parchment)}

@media (prefers-reduced-motion:reduce){
  *{animation-duration:.01ms!important;transition-duration:.01ms!important}
}

${theme.custom || ""}
`;
}
