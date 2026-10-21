// sons.js — fabrication des sons par synthèse, hors temps réel (OfflineAudioContext).
// Chaque recette produit un AudioBuffer : boucles d'ambiance ou bruitages ponctuels.
// Pas de musique : uniquement des sons que l'on pouvait entendre à Corent vers 80 av. J.-C.

const SR = 44100;

function bruitBlanc(ctx, duree) {
  const b = ctx.createBuffer(1, Math.ceil(duree * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

function bruitRose(ctx, duree) {
  const b = ctx.createBuffer(1, Math.ceil(duree * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759;
    b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
    b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
    b6 = w * 0.115926;
  }
  return b;
}

function bruitBrun(ctx, duree) {
  const b = ctx.createBuffer(1, Math.ceil(duree * ctx.sampleRate), ctx.sampleRate);
  const d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return b;
}

function source(ctx, buffer, boucle = false) {
  const s = ctx.createBufferSource();
  s.buffer = buffer;
  s.loop = boucle;
  return s;
}

function filtre(ctx, type, f, q = 0.7) {
  const n = ctx.createBiquadFilter();
  n.type = type; n.frequency.value = f; n.Q.value = q;
  return n;
}

function gain(ctx, v = 1) { const g = ctx.createGain(); g.gain.value = v; return g; }

/** Rend une recette dans un OfflineAudioContext. */
async function rendre(duree, recette, canaux = 1) {
  const ctx = new OfflineAudioContext(canaux, Math.ceil(duree * SR), SR);
  const sortie = gain(ctx, 1);
  sortie.connect(ctx.destination);
  recette(ctx, sortie, duree);
  const buf = await ctx.startRendering();
  normaliser(buf, 0.9);
  return buf;
}

function normaliser(buf, cible) {
  let max = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) max = Math.max(max, Math.abs(d[i]));
  }
  if (max < 1e-6) return;
  const k = cible / max;
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] *= k;
  }
}

/** Rend une boucle sans couture : la fin est fondue dans le début. */
function boucler(buf, fondu = 1) {
  const n = Math.floor(fondu * buf.sampleRate);
  const out = new AudioBuffer({ numberOfChannels: buf.numberOfChannels, length: buf.length - n, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const src = buf.getChannelData(c), dst = out.getChannelData(c);
    for (let i = 0; i < dst.length; i++) dst[i] = src[i];
    for (let i = 0; i < n; i++) {
      const t = i / n;
      dst[i] = src[i] * Math.sqrt(t) + src[buf.length - n + i] * Math.sqrt(1 - t);
    }
  }
  return out;
}

const alea = (a, b) => a + Math.random() * (b - a);

// ---------------- recettes ----------------

/** Feu de bois : grondement sourd et crépitements irréguliers. */
function feu(ctx, out, D) {
  const grond = source(ctx, bruitBrun(ctx, D));
  const lp = filtre(ctx, 'lowpass', 280);
  const g = gain(ctx, 0.5);
  grond.connect(lp).connect(g).connect(out);
  grond.start();
  // souffle des flammes
  const souffle = source(ctx, bruitRose(ctx, D));
  const bp = filtre(ctx, 'bandpass', 900, 0.6);
  const gs = gain(ctx, 0.08);
  souffle.connect(bp).connect(gs).connect(out);
  souffle.start();
  for (let t = 0; t < D; t += 0.5) gs.gain.setTargetAtTime(alea(0.04, 0.14), t, 0.15);
  // crépitements : petites impulsions filtrées, en grappes
  const blanc = bruitBlanc(ctx, 0.05);
  let t = 0;
  while (t < D - 0.1) {
    t += -Math.log(1 - Math.random()) / 9;
    const grappe = Math.random() < 0.2 ? 3 + Math.floor(Math.random() * 4) : 1;
    for (let k = 0; k < grappe; k++) {
      const tk = t + k * alea(0.008, 0.04);
      if (tk > D - 0.06) break;
      const s = source(ctx, blanc);
      const hp = filtre(ctx, 'bandpass', alea(1500, 6000), alea(0.8, 3));
      const e = gain(ctx, 0);
      const a = Math.pow(Math.random(), 2) * 1.2 + 0.1;
      e.gain.setValueAtTime(a, tk);
      e.gain.exponentialRampToValueAtTime(0.001, tk + alea(0.008, 0.035));
      s.connect(hp).connect(e).connect(out);
      s.start(tk); s.stop(tk + 0.05);
    }
  }
}

/** Coup de marteau sur une enclume : partiels inharmoniques à décroissance rapide. */
function enclume(ctx, out) {
  const t0 = 0.005;
  const partiels = [[1, 1], [2.76, 0.55], [5.4, 0.35], [8.93, 0.2], [13.3, 0.12]];
  const f0 = alea(780, 1000);
  for (const [r, a] of partiels) {
    const o = ctx.createOscillator();
    o.frequency.value = f0 * r * alea(0.995, 1.005);
    const g = gain(ctx, 0);
    g.gain.setValueAtTime(a * 0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.0005, t0 + alea(0.5, 1.2) / Math.sqrt(r));
    o.connect(g).connect(out);
    o.start(t0); o.stop(t0 + 1.4);
  }
  // choc
  const s = source(ctx, bruitBlanc(ctx, 0.05));
  const bp = filtre(ctx, 'bandpass', 3500, 1);
  const g = gain(ctx, 0);
  g.gain.setValueAtTime(0.9, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.03);
  s.connect(bp).connect(g).connect(out);
  s.start(t0);
  // pièce de fer rebondissant sur la table
  const o = ctx.createOscillator();
  o.frequency.value = f0 * 4.1;
  const gr = gain(ctx, 0);
  gr.gain.setValueAtTime(0.12, t0 + 0.11);
  gr.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);
  o.connect(gr).connect(out);
  o.start(t0 + 0.1); o.stop(t0 + 0.3);
}

/** Pas sur gravier, herbe, terre ou bois. */
function pas(type) {
  return (ctx, out) => {
    const s = source(ctx, bruitBlanc(ctx, 0.4));
    const t0 = 0.002;
    if (type === 'gravier') {
      // crissement : plusieurs micro-impacts serrés
      const bp = filtre(ctx, 'bandpass', alea(1800, 3200), 0.9);
      const g = gain(ctx, 0);
      for (let k = 0; k < 14; k++) {
        const tk = t0 + alea(0, 0.12);
        g.gain.setValueAtTime(alea(0.3, 1), tk);
        g.gain.setTargetAtTime(0.02, tk + 0.002, 0.006);
      }
      g.gain.setTargetAtTime(0, t0 + 0.16, 0.03);
      s.connect(bp).connect(g).connect(out);
    } else if (type === 'herbe') {
      const hp = filtre(ctx, 'highpass', 1400);
      const lp = filtre(ctx, 'lowpass', 6000);
      const g = gain(ctx, 0);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
      g.gain.setTargetAtTime(0, t0 + 0.07, 0.05);
      s.connect(hp).connect(lp).connect(g).connect(out);
    } else if (type === 'terre') {
      const lp = filtre(ctx, 'lowpass', 900);
      const g = gain(ctx, 0);
      g.gain.setValueAtTime(0.8, t0);
      g.gain.setTargetAtTime(0, t0 + 0.01, 0.03);
      s.connect(lp).connect(g).connect(out);
    } else {
      // bois : coup sourd et résonance de la planche
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(alea(150, 190), t0);
      o.frequency.exponentialRampToValueAtTime(90, t0 + 0.08);
      const go = gain(ctx, 0);
      go.gain.setValueAtTime(0.8, t0);
      go.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      o.connect(go).connect(out);
      o.start(t0); o.stop(t0 + 0.2);
      const bp = filtre(ctx, 'bandpass', 700, 2);
      const g = gain(ctx, 0);
      g.gain.setValueAtTime(0.5, t0);
      g.gain.setTargetAtTime(0, t0 + 0.005, 0.015);
      s.connect(bp).connect(g).connect(out);
    }
    s.start(t0);
  };
}

/** Grognement de porc : souffle nasal pulsé, très grave. */
function cochon(ctx, out) {
  const n = 2 + Math.floor(Math.random() * 3);
  let t = 0.01;
  for (let k = 0; k < n; k++) {
    const d = alea(0.12, 0.28);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(alea(80, 120), t);
    o.frequency.linearRampToValueAtTime(alea(60, 90), t + d);
    const s = source(ctx, bruitRose(ctx, d + 0.05));
    const mix = gain(ctx, 1);
    const gs = gain(ctx, 0.6);
    o.connect(mix); s.connect(gs).connect(mix);
    // modulation rapide de l'amplitude : le « ronflement »
    const am = gain(ctx, 0);
    const lfo = ctx.createOscillator(); lfo.frequency.value = alea(28, 40);
    const lfoG = gain(ctx, 0.5);
    lfo.connect(lfoG).connect(am.gain);
    am.gain.setValueAtTime(0.5, t);
    const f1 = filtre(ctx, 'bandpass', alea(280, 420), 3);
    const f2 = filtre(ctx, 'lowpass', 900);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.03);
    env.gain.setTargetAtTime(0, t + d - 0.04, 0.03);
    mix.connect(am).connect(f1).connect(f2).connect(env).connect(out);
    o.start(t); o.stop(t + d + 0.1); s.start(t); lfo.start(t); lfo.stop(t + d + 0.1);
    t += d + alea(0.05, 0.25);
  }
}

/** Bêlement : voix chevrotante passée dans des formants. */
function mouton(ctx, out) {
  const d = alea(0.6, 1.1);
  const t = 0.01;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const f = alea(330, 520);
  o.frequency.setValueAtTime(f * 0.92, t);
  o.frequency.linearRampToValueAtTime(f, t + 0.15);
  o.frequency.linearRampToValueAtTime(f * 0.85, t + d);
  const vib = ctx.createOscillator(); vib.frequency.value = alea(5.5, 8);
  const vibG = gain(ctx, f * 0.05);
  vib.connect(vibG).connect(o.frequency);
  const trem = gain(ctx, 0.7);
  const trL = ctx.createOscillator(); trL.frequency.value = vib.frequency.value;
  const trG = gain(ctx, 0.3); trL.connect(trG).connect(trem.gain);
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.06);
  env.gain.setTargetAtTime(0, t + d - 0.15, 0.07);
  const somme = gain(ctx, 1);
  for (const [fq, q, a] of [[alea(700, 900), 6, 1], [alea(1500, 1900), 8, 0.6], [2700, 10, 0.25]]) {
    const bp = filtre(ctx, 'bandpass', fq, q);
    const g = gain(ctx, a);
    trem.connect(bp).connect(g).connect(somme);
  }
  o.connect(trem);
  somme.connect(env).connect(out);
  o.start(t); o.stop(t + d + 0.3); vib.start(t); vib.stop(t + d + 0.3); trL.start(t); trL.stop(t + d + 0.3);
}

/** Meuglement : voix grave qui s'ouvre puis se referme. */
function boeuf(ctx, out) {
  const d = alea(1.3, 2.2);
  const t = 0.02;
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const f = alea(95, 135);
  o.frequency.setValueAtTime(f * 0.85, t);
  o.frequency.linearRampToValueAtTime(f * 1.08, t + d * 0.35);
  o.frequency.linearRampToValueAtTime(f * 0.8, t + d);
  const lp = filtre(ctx, 'lowpass', 300, 4);
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.linearRampToValueAtTime(alea(900, 1200), t + d * 0.4);
  lp.frequency.linearRampToValueAtTime(320, t + d);
  const env = gain(ctx, 0);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(1, t + 0.2);
  env.gain.setTargetAtTime(0, t + d - 0.25, 0.12);
  const s = source(ctx, bruitRose(ctx, d + 0.3));
  const gs = gain(ctx, 0.12);
  s.connect(gs).connect(lp);
  o.connect(lp).connect(env).connect(out);
  o.start(t); o.stop(t + d + 0.4); s.start(t);
}

/** Aboiement : deux ou trois jappements brefs. */
function chien(ctx, out) {
  const n = 1 + Math.floor(Math.random() * 3);
  let t = 0.01;
  const f = alea(380, 560);
  for (let k = 0; k < n; k++) {
    const d = alea(0.09, 0.16);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f * 1.25, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.7, t + d);
    const s = source(ctx, bruitBlanc(ctx, d + 0.05));
    const gs = gain(ctx, 0.35);
    const somme = gain(ctx, 1);
    o.connect(somme); s.connect(gs).connect(somme);
    const bp1 = filtre(ctx, 'bandpass', alea(900, 1300), 3);
    const bp2 = filtre(ctx, 'bandpass', alea(2000, 2600), 4);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.001, t + d);
    somme.connect(bp1).connect(env); somme.connect(bp2).connect(env);
    env.connect(out);
    o.start(t); o.stop(t + d + 0.05); s.start(t);
    t += d + alea(0.12, 0.3);
  }
}

/** Corneille : croassement rauque répété. */
function corneille(ctx, out) {
  const n = 2 + Math.floor(Math.random() * 3);
  let t = 0.01;
  for (let k = 0; k < n; k++) {
    const d = alea(0.22, 0.34);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    const f = alea(560, 720);
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 0.8, t + d);
    // rugosité : modulation rapide
    const am = gain(ctx, 0.6);
    const lfo = ctx.createOscillator(); lfo.frequency.value = alea(55, 80);
    const lg = gain(ctx, 0.4); lfo.connect(lg).connect(am.gain);
    const bp = filtre(ctx, 'bandpass', alea(1200, 1600), 2.5);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(1, t + 0.03);
    env.gain.setTargetAtTime(0, t + d - 0.06, 0.03);
    o.connect(am).connect(bp).connect(env).connect(out);
    o.start(t); o.stop(t + d + 0.1); lfo.start(t); lfo.stop(t + d + 0.1);
    t += d + alea(0.25, 0.5);
  }
}

/** Passereau : courte série de notes descendantes. */
function passereau(ctx, out) {
  const n = 3 + Math.floor(Math.random() * 6);
  let t = 0.01;
  const base = alea(3500, 5200);
  const motif = Math.random();
  for (let k = 0; k < n; k++) {
    const d = alea(0.04, 0.1);
    const o = ctx.createOscillator();
    const f = base * (motif < 0.5 ? 1 - k * 0.03 : 1 + Math.sin(k) * 0.12);
    o.frequency.setValueAtTime(f * 1.15, t);
    o.frequency.exponentialRampToValueAtTime(f * 0.8, t + d);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.8, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.001, t + d);
    o.connect(env).connect(out);
    o.start(t); o.stop(t + d + 0.02);
    t += d + alea(0.03, 0.12);
  }
}

/** Alouette des champs : chant continu, rapide et aigu, chanté en vol au-dessus des cultures. */
function alouette(ctx, out, D) {
  const o = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g2 = gain(ctx, 0.25);
  o2.frequency.value = 0;
  const env = gain(ctx, 0);
  o.connect(env); o2.connect(g2).connect(env);
  env.connect(out);
  let t = 0.05;
  while (t < D - 0.3) {
    // phrase de 1 à 3 s, puis courte respiration
    const fin = Math.min(D - 0.3, t + alea(1, 3));
    while (t < fin) {
      const d = alea(0.035, 0.09);
      const f = alea(2600, 5600);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * alea(0.8, 1.25), t + d);
      o2.frequency.setValueAtTime(f * 2, t);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(alea(0.3, 0.9), t + d * 0.25);
      env.gain.linearRampToValueAtTime(0, t + d);
      t += d + alea(0, 0.02);
    }
    t += alea(0.15, 0.5);
  }
  o.start(0); o2.start(0); o.stop(D); o2.stop(D);
}

/** Grillons des champs : stridulations en trilles, plusieurs individus. */
function grillons(ctx, out, D) {
  for (let i = 0; i < 4; i++) {
    const o = ctx.createOscillator();
    o.frequency.value = alea(4200, 4900);
    const g = gain(ctx, 0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = alea(-0.8, 0.8);
    o.connect(g);
    (pan ? g.connect(pan) : g).connect(out);
    const periode = alea(0.4, 0.75), impulsions = 3 + Math.floor(Math.random() * 2), a = alea(0.3, 1);
    for (let t = alea(0, periode); t < D - 0.2; t += periode * alea(0.95, 1.05)) {
      for (let k = 0; k < impulsions; k++) {
        const tk = t + k * 0.033;
        g.gain.setValueAtTime(0, tk);
        g.gain.linearRampToValueAtTime(a, tk + 0.006);
        g.gain.linearRampToValueAtTime(0, tk + 0.022);
      }
    }
    o.start(0); o.stop(D);
  }
}

/** Chouette hulotte : « hou… hou-hou-hou-houuu ». */
function chouette(ctx, out) {
  const note = (t, f0, d, a) => {
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.linearRampToValueAtTime(f0 * 0.93, t + d);
    const vib = ctx.createOscillator(); vib.frequency.value = 9;
    const vg = gain(ctx, f0 * 0.012); vib.connect(vg).connect(o.frequency);
    const env = gain(ctx, 0);
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(a, t + 0.05);
    env.gain.setTargetAtTime(0, t + d - 0.08, 0.05);
    const s = source(ctx, bruitRose(ctx, d + 0.1));
    const sg = gain(ctx, 0.03);
    s.connect(sg).connect(env);
    o.connect(env).connect(out);
    o.start(t); o.stop(t + d + 0.2); vib.start(t); vib.stop(t + d + 0.2); s.start(t);
  };
  note(0.05, 560, 0.75, 0.8);
  note(1.9, 500, 0.12, 0.4);
  note(2.12, 520, 0.12, 0.45);
  note(2.36, 540, 0.14, 0.5);
  note(2.62, 560, 1.0, 0.75);
}

/**
 * Murmure de foule : voix superposées, inintelligibles, formées de syllabes
 * (source glottique + formants de voyelles + bruits de consonnes).
 */
function foule(ctx, out, D) {
  const VOYELLES = [[730, 1090, 2440], [530, 1840, 2480], [270, 2290, 3010], [570, 840, 2410], [300, 870, 2240], [660, 1720, 2410]];
  const lp = filtre(ctx, 'lowpass', 2600);
  lp.connect(out);
  const consonne = bruitBlanc(ctx, 0.08);
  for (let v = 0; v < 9; v++) {
    const femme = Math.random() < 0.45;
    const f0 = femme ? alea(180, 240) : alea(95, 140);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f0;
    const filtres = [0, 1, 2].map((i) => filtre(ctx, 'bandpass', VOYELLES[0][i], 7 + i * 3));
    const gains = [1, 0.5, 0.25].map((a) => gain(ctx, a));
    const env = gain(ctx, 0);
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = alea(-0.9, 0.9);
    filtres.forEach((f, i) => { o.connect(f); f.connect(gains[i]).connect(env); });
    const g = gain(ctx, alea(0.25, 1));
    env.connect(g);
    (pan ? g.connect(pan) : g).connect(lp);
    o.start(0); o.stop(D);
    // énoncés : suites de syllabes, avec intonation descendante, puis silences
    let t = alea(0, 2);
    while (t < D - 0.5) {
      const nSyl = 3 + Math.floor(Math.random() * 12);
      const debutPhrase = t;
      for (let k = 0; k < nSyl && t < D - 0.4; k++) {
        const d = alea(0.09, 0.24);
        const voy = VOYELLES[Math.floor(Math.random() * VOYELLES.length)];
        filtres.forEach((f, i) => f.frequency.setTargetAtTime(voy[i] * (femme ? 1.15 : 1), t, 0.02));
        const into = 1 + 0.15 * Math.sin(k * 0.9) - 0.12 * ((t - debutPhrase) / 2);
        o.frequency.setTargetAtTime(f0 * into, t, 0.04);
        env.gain.setTargetAtTime(alea(0.5, 1), t + 0.01, 0.02);
        env.gain.setTargetAtTime(0.05, t + d * 0.75, 0.02);
        if (Math.random() < 0.5) {
          const s = source(ctx, consonne);
          const hp = filtre(ctx, 'bandpass', alea(2500, 6000), 1.5);
          const ge = gain(ctx, 0);
          ge.gain.setValueAtTime(alea(0.1, 0.35), t);
          ge.gain.setTargetAtTime(0, t + 0.01, 0.015);
          s.connect(hp).connect(ge);
          (pan ? ge.connect(pan) : ge.connect(lp));
          s.start(t);
        }
        t += d;
      }
      env.gain.setTargetAtTime(0, t, 0.05);
      t += alea(0.4, 3);
    }
  }
  // rires et exclamations occasionnels
  for (let t = alea(1, 4); t < D - 1; t += alea(2.5, 6)) {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    const f = alea(160, 300);
    const env = gain(ctx, 0);
    const bp = filtre(ctx, 'bandpass', alea(700, 1000), 4);
    o.connect(bp).connect(env).connect(lp);
    for (let k = 0; k < 4; k++) {
      const tk = t + k * 0.14;
      o.frequency.setValueAtTime(f * (1 - k * 0.04), tk);
      env.gain.setValueAtTime(0, tk);
      env.gain.linearRampToValueAtTime(0.35, tk + 0.03);
      env.gain.linearRampToValueAtTime(0, tk + 0.11);
    }
    o.start(t); o.stop(t + 0.7);
  }
}

/** Réponse impulsionnelle d'une petite réverbération extérieure (murs de bois et de torchis). */
export function reponseImpulsionnelle(ctx, duree = 1.4) {
  const n = Math.floor(duree * ctx.sampleRate);
  const b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / ctx.sampleRate;
      // premières réflexions éparses puis queue diffuse
      const premiere = t < 0.08 && Math.random() < 0.004 ? 1.5 : 0;
      d[i] = ((Math.random() * 2 - 1) + premiere) * Math.pow(1 - t / duree, 3) * Math.exp(-t * 3.2);
    }
  }
  return b;
}

/** Fabrique toute la banque de sons. Les boucles longues sont rendues une fois, puis rebouclées. */
export async function fabriquerSons() {
  const variantes = (n, d, r) => Promise.all(Array.from({ length: n }, () => rendre(d, r)));
  const [feuB, fouleB, alouetteB, grillonsB, enclumeV, gravier, herbe, terre, bois, cochonV, moutonV, boeufV, chienV, corneilleV, passereauV, chouetteB] = await Promise.all([
    rendre(7, feu).then((b) => boucler(b, 1)),
    rendre(16, foule, 2).then((b) => boucler(b, 1.5)),
    rendre(10, alouette).then((b) => boucler(b, 0.6)),
    rendre(8, grillons, 2).then((b) => boucler(b, 0.8)),
    variantes(3, 1.5, enclume),
    variantes(4, 0.25, pas('gravier')),
    variantes(4, 0.25, pas('herbe')),
    variantes(3, 0.2, pas('terre')),
    variantes(3, 0.25, pas('bois')),
    variantes(3, 1.4, cochon),
    variantes(3, 1.5, mouton),
    variantes(2, 2.7, boeuf),
    variantes(3, 1.2, chien),
    variantes(2, 2.2, corneille),
    variantes(5, 1.2, passereau),
    rendre(3.9, chouette),
  ]);
  return {
    feu: feuB, foule: fouleB, alouette: alouetteB, grillons: grillonsB,
    enclume: enclumeV, pas: { gravier, herbe, terre, bois },
    cochon: cochonV, mouton: moutonV, boeuf: boeufV, chien: chienV,
    corneille: corneilleV, passereau: passereauV, chouette: [chouetteB],
  };
}
