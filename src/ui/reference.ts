/**
 * Reference material - static experiment documents.
 *
 * Loaded on demand into the drawer. Not part of the simulation: these are the
 * written procedures and nameplate tables the student reads alongside the
 * bench.
 *
 * Each document's `body()` returns an HTML string rather than a DOM tree,
 * because the drawer already renders HTML and the documents are static.
 * Nothing here is user-supplied, so there is no injection surface.
 */

export interface ReferenceDoc {
  id: string;
  num: string;
  title: string;
  sub: string;
  body: () => string;
}

export const REFERENCE_DOCS: ReferenceDoc[] = [
  {
    id: 'exp1', num: '01',
    title: 'Study of Nameplate Ratings & Rated Speed',
    sub: 'Record nameplate data of all lab machines',
    body: function () {
      return '<h1>Experiment 01 · Nameplate Ratings</h1>' +
        '<p class="ref-meta">Record rated voltage, current, power, frequency and RPM for each machine.</p>' +
        '<h2>Objective</h2>' +
        '<p>Examine the nameplate data of machines in the Electrical Machines Laboratory and identify the rated speed of rotating machines versus static devices.</p>' +
        '<h2>Apparatus</h2>' +
        '<ul>' +
        '<li>DC Motor / Generator Set — <strong>M1-2/EV</strong></li>' +
        '<li>Three-Phase Synchronous Generator — <strong>GMS</strong></li>' +
        '<li>Three-Phase Induction Motor — <strong>M-4/EV</strong></li>' +
        '<li>Single-Phase Induction Motor — <strong>M-R/CV</strong></li>' +
        '<li>Load Resistor Bank / Rheostat — <strong>308T</strong></li>' +
        '<li>Eddy-Current Dynamometer</li>' +
        '</ul>' +
        '<h2>Recorded Ratings</h2>' +
        '<ul>' +
        '<li><strong>DC Motor / Gen · M1-2/EV</strong> — 220 V, 1.4 A, 300 W · 2500 mot / 3000 gen rpm</li>' +
        '<li><strong>3φ Async Motor · M-4/EV</strong> — 400 V, 1.5 A (Y) / 2.6 A (Δ), 500 W, p=2, 50 Hz · <strong>2850 rpm</strong></li>' +
        '<li><strong>Sync Generator · GMS</strong> — 400 V, 350 W, 50 Hz · 1250 rpm</li>' +
        '<li><strong>1φ Async Motor · M-R/CV</strong> — 230 V, 3.6 A, 370 W, C=12.5 µF, p=2 · 2850 rpm</li>' +
        '<li><strong>Rheostat · 308T</strong> — 500 Ω, 2 A · <em>static, no RPM</em></li>' +
        '</ul>' +
        '<h2>Discussion</h2>' +
        '<p>Induction motor runs at 2850 rpm due to slip, while the synchronous machine sits at its synchronous speed. The DC machine carries separate motor and generator ratings. Transformer and rheostats are static devices — no RPM rating at all.</p>';
    }
  },
  {
    id: 'exp2', num: '02',
    title: 'Three-Phase Asynchronous Motor Starting',
    sub: 'DOL start · line current characteristics',
    body: function () {
      return '<h1>Experiment 02 · 3φ Async Motor</h1>' +
        '<p class="ref-meta">Direct-on-line starting behaviour of an asynchronous motor.</p>' +
        '<h2>Objective</h2>' +
        '<p>Observe the starting behaviour and running characteristics of a three-phase asynchronous motor under direct-on-line (DOL) starting.</p>' +
        '<h2>Apparatus</h2>' +
        '<ul><li>M-4/EV three-phase induction motor (400 V, 500 W, p=2, 2850 rpm)</li>' +
        '<li>AV-1/EV power supply — fixed 400 V 3φ line</li>' +
        '<li>AC ammeter (0–5 A), AC voltmeter (0–500 V)</li></ul>' +
        '<h2>Procedure</h2>' +
        '<ul>' +
        '<li>Connect the motor star (Y) for 400 V line operation.</li>' +
        '<li>Verify the connections and close the main supply switch.</li>' +
        '<li>Record line current and voltage during start and steady state.</li>' +
        '<li>Repeat with delta connection to compare line currents.</li>' +
        '</ul>' +
        '<h2>Expected Result</h2>' +
        '<p>Y-connection draws ≈ 1.5 A per line; Δ-connection ≈ 2.6 A. Speed settles at about 2850 rpm due to slip.</p>';
    }
  },
  {
    id: 'exp3', num: '03',
    title: 'Load Characteristics of a DC Machine',
    sub: 'V_t and I_L under varying load',
    body: function () {
      return '<h1>Experiment 03 · DC Machine Load Test</h1>' +
        '<p class="ref-meta">Terminal voltage and current under varying load resistance.</p>' +
        '<h2>Objective</h2>' +
        '<p>Study the external characteristics of a DC machine by progressively loading it with a resistive load bank.</p>' +
        '<h2>Apparatus</h2>' +
        '<ul><li>M1-2/EV DC machine (220 V, 1.4 A, 300 W)</li>' +
        '<li>308T load bank / rheostat (500 Ω, 2 A)</li>' +
        '<li>AV-1/EV DC supply, AZ-VIPS ammeter + voltmeter</li></ul>' +
        '<h2>Procedure</h2>' +
        '<ul>' +
        '<li>Set the field rheostat to give rated terminal voltage at no load.</li>' +
        '<li>Step the load bank from open to progressively lower resistance.</li>' +
        '<li>Record V_t and I_L at every step.</li>' +
        '</ul>' +
        '<h2>Expected Result</h2>' +
        '<p>Terminal voltage droops with increasing load current due to armature I²R drop, armature reaction, and field-current reduction in shunt configuration.</p>';
    }
  },
  {
    id: 'exp4', num: '04',
    title: 'DC Shunt Generator — External Characteristic',
    sub: 'V_t vs I_L curve from live bench',
    body: function () {
      return '<h1>Experiment 04 · DC Shunt Generator</h1>' +
        '<p class="ref-meta">External characteristic V_t vs I_L of a shunt generator.</p>' +
        '<h2>Objective</h2>' +
        '<p>Plot the external characteristic V_t vs I_L of a DC shunt generator and observe the terminal voltage droop as the load increases.</p>' +
        '<h2>Apparatus</h2>' +
        '<ul><li>M1-2/EV DC machine, prime mover at 1500 rpm</li>' +
        '<li>308T field rheostat, 308T-LB load bank</li>' +
        '<li>AZ-VIPS voltmeter + ammeter</li></ul>' +
        '<h2>Key Numbers (from session)</h2>' +
        '<ul>' +
        '<li>Open-circuit terminal voltage: <strong>220 V</strong> at I_L = 0</li>' +
        '<li>Full-load point: <strong>V_t ≈ 148.5 V at I_L ≈ 0.836 A</strong></li>' +
        '<li>Regulation: ≈ 48 % over the tested load range</li>' +
        '</ul>' +
        '<h2>Discussion</h2>' +
        '<p>The droop is caused by three compounding effects: (a) armature I²R drop, (b) armature reaction, and (c) shunt-field current reduction as terminal voltage falls — the last one is the positive-feedback loop that makes shunt-generator droop steeper than separately-excited.</p>';
    }
  },
  {
    id: 'exp5', num: '05',
    title: 'Characteristics of a Single-Phase Induction Motor',
    sub: 'Capacitor start · line current comparison',
    body: function () {
      return '<h1>Experiment 05 · 1φ Induction Motor</h1>' +
        '<p class="ref-meta">Effect of the starting capacitor on line current and self-starting.</p>' +
        '<h2>Objective</h2>' +
        '<p>Understand the working principle of the single-phase induction motor and observe the effect of a starting capacitor on the line current and starting capability.</p>' +
        '<h2>Theory</h2>' +
        '<p>A single-phase supply produces a pulsating field, which resolves into two equal and opposite rotating fields — zero net starting torque. The starting capacitor in series with the auxiliary winding causes its current to lead the main winding current, producing a rotating field and self-starting.</p>' +
        '<h2>Apparatus</h2>' +
        '<ul><li>M-R/CV single-phase motor (230 V, 3.6 A, 370 W, C=12.5 µF)</li>' +
        '<li>AC ammeter (0–5 A), AC voltmeter (0–300 V)</li>' +
        '<li>Starting capacitor C = 12.5 µF</li></ul>' +
        '<h2>Observation (from session)</h2>' +
        '<ul>' +
        '<li><strong>With capacitor:</strong> V = 217 V, I = 2.1 A</li>' +
        '<li><strong>Without capacitor:</strong> V = 228 V, I = 3.5 A</li>' +
        '</ul>' +
        '<h2>Discussion</h2>' +
        '<p>Adding the capacitor reduced line current from 3.5 A to 2.1 A (≈40 % drop) by improving the phase relationship between voltage and current — a power-factor correction effect. Minor voltage differences between the two runs came from natural mains fluctuation.</p>';
    }
  },
  {
    id: 'exp6', num: '06',
    title: 'Synchronous Reactance of a 3φ Alternator',
    sub: 'OC + SC tests · Xs determination',
    body: function () {
      return '<h1>Experiment 06 · Synchronous Reactance</h1>' +
        '<p class="ref-meta">OC and SC tests to find Xs of a three-phase synchronous generator.</p>' +
        '<h2>Objective</h2>' +
        '<p>Determine the synchronous reactance X_s of a three-phase alternator from open-circuit and short-circuit tests.</p>' +
        '<h2>Theory</h2>' +
        '<p>Z_s = R_a + jX_s, and |Z_s| = √(R_a² + X_s²). From OC and SC tests at the same field current, Z_s = V_oc / I_sc. The armature resistance is measured as DC and multiplied by 1.4 to account for AC skin effect.</p>' +
        '<h2>Data (from session)</h2>' +
        '<ul>' +
        '<li>R_dc = 18.5 Ω → <strong>R_a = 1.4 × 18.5 = 25.9 Ω</strong></li>' +
        '<li>If = 0.100 A · Voc = 155.1 V · Isc = 0.182 A → Z_s = 852.20 Ω, X_s = 851.81 Ω</li>' +
        '<li>If = 0.130 A · Voc = 203.9 V · Isc = 0.242 A → Z_s = 842.56 Ω, X_s = 842.16 Ω</li>' +
        '<li>If = 0.199 A · Voc = 302.4 V · Isc = 0.392 A → Z_s = 771.43 Ω, X_s = 770.99 Ω</li>' +
        '<li>If = 0.290 A · Voc = 398.8 V · Isc = 0.575 A → Z_s = 693.57 Ω, X_s = 693.08 Ω</li>' +
        '<li><strong>X_s average ≈ 789.5 Ω</strong></li>' +
        '</ul>' +
        '<h2>Discussion</h2>' +
        '<p>Z_s and X_s fall slightly as field current rises — magnetic saturation reduces the incremental flux per amp of field current. Since R_a (25.9 Ω) is tiny compared to Z_s (≈700–850 Ω), X_s ≈ Z_s in every row. Synchronous reactance dominates the impedance.</p>';
    }
  }
];
