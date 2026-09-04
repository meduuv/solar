/* ============================================================
   data.js — the worlds, their numbers and their stories
   Figures follow NASA/JPL planetary fact sheets (2025).
   ============================================================ */

/* scale compression: true sizes are unusable, so we squash them
   logarithmically while preserving the *ordering* of every world. */
export const SIZE_EXP = 0.42;
export const SIZE_K   = 0.081;
export const ORB_BASE = 40;
export const ORB_K    = 72;
export const ORB_EXP  = 0.6;

export const dispRadius = km => Math.pow(km, SIZE_EXP) * SIZE_K;
export const dispOrbit  = au => (au <= 0 ? 0 : ORB_BASE + Math.pow(au, ORB_EXP) * ORB_K);

export const EARTH_RADIUS_KM = 6371;

export const BODIES = [
  {
    id:"sun", name:"Sol", native:"SOL · the star that made us", cls:"G2V main-sequence star",
    color:"#ffb35c", rim:"#ff8a2b", kind:"sun",
    radiusKm:696340, distAu:0, distKm:"—",
    dayStr:"25.4 days", yearStr:"230 Myr galactic", moons:0, moonNames:[],
    tempC:"5 505 °C surface", gravity:"274 m/s²", massStr:"1.989 × 10³⁰ kg",
    velKms:"—", tilt:"7.25°", comp:"73% hydrogen · 25% helium",
    tag:"Not a planet — the <em>reason</em> there are planets. Sol holds 99.86% of all the mass in the Solar System, and every world you are about to meet is debris that never fell in.",
    fact:"<b>Each second</b> the Sun converts about 600 million tonnes of hydrogen into helium, and 4 million tonnes of that difference leaves as pure light.",
    spin:0.0022, orbit:0
  },
  {
    id:"mercury", name:"Mercury", native:"MERCVRIVS · messenger of the gods", cls:"Terrestrial · innermost",
    color:"#c9b8a4", rim:"#8d7f6d", kind:"rock",
    radiusKm:2439.7, distAu:0.387, distKm:"57.9 million km",
    dayStr:"58.6 Earth days", yearStr:"88 Earth days", moons:0, moonNames:[],
    tempC:"−173 to 427 °C", gravity:"3.70 m/s²", massStr:"3.30 × 10²³ kg",
    velKms:"47.4 km/s", tilt:"0.03°", comp:"iron core (~85% of radius) · thin exosphere",
    tag:"A cratered iron cannonball sprinting around the Sun. With almost no atmosphere to move heat around, <em>noon and midnight differ by 600 °C</em> — the widest temperature swing of any planet.",
    fact:"<b>Three days, two years:</b> Mercury turns exactly three times on its axis for every two orbits, so a single solar day there lasts two Mercurian years.",
    spin:0.0038, orbit:0.0410,
    craters:240, bump:1.5
  },
  {
    id:"venus", name:"Venus", native:"VENVS · goddess of love", cls:"Terrestrial · Earth's twin",
    color:"#ffd9a0", rim:"#e8b56a", kind:"venus",
    radiusKm:6051.8, distAu:0.723, distKm:"108.2 million km",
    dayStr:"243 Earth days (retrograde)", yearStr:"225 Earth days", moons:0, moonNames:[],
    tempC:"464 °C — hotter than Mercury", gravity:"8.87 m/s²", massStr:"4.87 × 10²⁴ kg",
    velKms:"35.0 km/s", tilt:"177.4°", comp:"96% CO₂ · sulphuric-acid cloud decks",
    tag:"Earth's twin by size and its opposite by fate. A runaway greenhouse pushed the surface to <em>464 °C under 92 atmospheres</em> of pressure — the same crush as 900 m deep in the ocean.",
    fact:"<b>Venus spins backwards</b> and so slowly that its day outlasts its year. Stand there and the Sun would rise in the west, twice per orbit.",
    spin:-0.0009, orbit:0.0304,
    bump:0.3
  },
  {
    id:"earth", name:"Earth", native:"TERRA · 地球 · the only known cradle", cls:"Terrestrial · habitable zone",
    color:"#6fb7ff", rim:"#4a9dff", kind:"earth",
    radiusKm:6371, distAu:1.0, distKm:"149.6 million km",
    dayStr:"23 h 56 m", yearStr:"365.25 days", moons:1, moonNames:["The Moon"],
    tempC:"15 °C average", gravity:"9.81 m/s²", massStr:"5.97 × 10²⁴ kg",
    velKms:"29.8 km/s", tilt:"23.44°", comp:"78% N₂ · 21% O₂ · liquid-water oceans",
    tag:"The only world where the pressure and temperature let water sit on the surface as a liquid — and the only one, so far, that has noticed it is doing so. <em>71% of it is ocean.</em>",
    fact:"<b>Earth is the densest planet</b> in the Solar System, and its oversized Moon — a quarter of its width — stabilises the axial tilt that gives us predictable seasons.",
    spin:0.0180, orbit:0.0248,
    bump:0.7, clouds:true, night:true
  },
  {
    id:"mars", name:"Mars", native:"MARS · the red war-god", cls:"Terrestrial · outermost rocky",
    color:"#ff7d55", rim:"#c9552f", kind:"mars",
    radiusKm:3389.5, distAu:1.524, distKm:"227.9 million km",
    dayStr:"24 h 37 m", yearStr:"687 Earth days", moons:2, moonNames:["Phobos","Deimos"],
    tempC:"−65 °C average", gravity:"3.72 m/s²", massStr:"6.42 × 10²³ kg",
    velKms:"24.1 km/s", tilt:"25.19°", comp:"95% CO₂ · iron-oxide dust · polar water ice",
    tag:"Rust-coloured because its soil is literally oxidised iron. Mars carries the <em>tallest volcano</em> (Olympus Mons, 22 km) and the <em>deepest canyon</em> (Valles Marineris, 4 000 km long) in the Solar System.",
    fact:"<b>Ancient rivers ran here.</b> Orbiters have mapped deltas, lake beds and flood channels — Mars was warm and wet for hundreds of millions of years before it lost its atmosphere.",
    spin:0.0175, orbit:0.0198,
    craters:110, bump:1.3, caps:true
  },
  {
    id:"jupiter", name:"Jupiter", native:"IVPPITER · king of the gods", cls:"Gas giant · the great shield",
    color:"#e8b98a", rim:"#c98f5c", kind:"gas",
    radiusKm:69911, distAu:5.204, distKm:"778.5 million km",
    dayStr:"9 h 56 m — fastest spin", yearStr:"11.86 Earth years", moons:97,
    moonNames:["Io","Europa","Ganymede","Callisto","Amalthea","Himalia"],
    tempC:"−110 °C cloud tops", gravity:"24.79 m/s²", massStr:"1.898 × 10²⁷ kg",
    velKms:"13.1 km/s", tilt:"3.13°", comp:"90% H₂ · 10% He · ammonia cloud bands",
    tag:"Two and a half times the mass of every other planet combined, and still <em>80 times too light</em> to have ignited as a star. Its gravity has been vacuuming up comets that would otherwise reach us for four billion years.",
    fact:"<b>The Great Red Spot</b> is a storm wider than Earth that has been spinning for at least 190 years — and Jupiter's fastest jet streams run at 540 km/h.",
    spin:0.0440, orbit:0.0107,
    bands:22, spot:true
  },
  {
    id:"saturn", name:"Saturn", native:"SATVRNVS · god of time and harvest", cls:"Gas giant · ringed",
    color:"#f2d9a0", rim:"#d8b877", kind:"gas",
    radiusKm:58232, distAu:9.583, distKm:"1.434 billion km",
    dayStr:"10 h 42 m", yearStr:"29.45 Earth years", moons:274,
    moonNames:["Titan","Enceladus","Mimas","Iapetus","Rhea","Dione","Tethys"],
    tempC:"−140 °C cloud tops", gravity:"10.44 m/s²", massStr:"5.68 × 10²⁶ kg",
    velKms:"9.7 km/s", tilt:"26.73°", comp:"96% H₂ · He · 7 000 km-thick ring system",
    tag:"The lightest planet in the Solar System — mean density 0.687 g/cm³, so <em>Saturn would float in water</em>. Its rings span 280 000 km yet average only about 10 m thick.",
    fact:"<b>274 confirmed moons</b> — more than every other planet combined. Titan has rivers of liquid methane; Enceladus fires water geysers from a buried ocean.",
    spin:0.0400, orbit:0.0079,
    bands:18, ring:{inner:1.32, outer:2.32}
  },
  {
    id:"uranus", name:"Uranus", native:"OVRANOS · the primordial sky", cls:"Ice giant · tipped over",
    color:"#96e5e8", rim:"#5fc6cf", kind:"ice",
    radiusKm:25362, distAu:19.191, distKm:"2.871 billion km",
    dayStr:"17 h 14 m (retrograde)", yearStr:"84 Earth years", moons:28,
    moonNames:["Titania","Oberon","Umbriel","Ariel","Miranda"],
    tempC:"−195 °C — coldest atmosphere", gravity:"8.87 m/s²", massStr:"8.68 × 10²⁵ kg",
    velKms:"6.8 km/s", tilt:"97.77°", comp:"H₂ · He · methane (which paints it cyan)",
    tag:"Knocked onto its side by an ancient impact, Uranus <em>rolls</em> around its orbit. Each pole gets 42 years of unbroken sunlight followed by 42 years of darkness.",
    fact:"<b>The coldest place</b> ever measured on a planet is here: −224 °C, colder than Neptune despite being 1.6 billion km nearer the Sun.",
    spin:-0.0250, orbit:0.0058,
    bands:8, ring:{inner:1.6, outer:2.0, faint:true}
  },
  {
    id:"neptune", name:"Neptune", native:"NEPTVNVS · lord of the deep", cls:"Ice giant · the last planet",
    color:"#5b7cff", rim:"#3f57d8", kind:"ice",
    radiusKm:24622, distAu:30.07, distKm:"4.495 billion km",
    dayStr:"16 h 06 m", yearStr:"164.8 Earth years", moons:16,
    moonNames:["Triton","Nereid","Proteus"],
    tempC:"−200 °C cloud tops", gravity:"11.15 m/s²", massStr:"1.02 × 10²⁶ kg",
    velKms:"5.4 km/s", tilt:"28.32°", comp:"H₂ · He · methane · possible diamond rain",
    tag:"Found with mathematics before it was ever seen — Le Verrier predicted where to point the telescope in 1846 and Neptune was <em>within one degree</em> of his figure. It has completed only one orbit since.",
    fact:"<b>The windiest world:</b> supersonic gales reach 2 100 km/h, powered by an internal heat source nobody has fully explained.",
    spin:0.0290, orbit:0.0044,
    bands:9, spot:"dark"
  },
  {
    id:"pluto", name:"Pluto", native:"PLVTO · keeper of the underworld", cls:"Dwarf planet · Kuiper belt",
    color:"#d8b394", rim:"#a8846a", kind:"rock",
    radiusKm:1188.3, distAu:39.48, distKm:"5.906 billion km (mean)",
    dayStr:"6.39 Earth days", yearStr:"248 Earth years", moons:5,
    moonNames:["Charon","Nix","Hydra","Kerberos","Styx"],
    tempC:"−225 °C", gravity:"0.62 m/s²", massStr:"1.30 × 10²² kg",
    velKms:"4.7 km/s", tilt:"122.5°", comp:"nitrogen ice · water-ice bedrock · methane frost",
    tag:"Reclassified in 2006, then <em>completely reinvented</em> in 2015 when New Horizons found nitrogen glaciers flowing across a 1 000 km heart-shaped basin, and mountains of frozen water 3 km high.",
    fact:"<b>Pluto and Charon are a double world:</b> Charon is half Pluto's diameter, and the two are tidally locked, forever hanging motionless in each other's sky.",
    spin:0.0060, orbit:0.0036,
    craters:130, bump:1.2, heart:true
  }
];

/* derived display geometry */
BODIES.forEach((b,i) => {
  b.R  = dispRadius(b.radiusKm);
  b.OR = dispOrbit(b.distAu);
  b.rel = b.radiusKm / EARTH_RADIUS_KM;
  b.phase = i * 2.39996323;          // golden angle → pleasant, deterministic spread
});

export const PLANETS = BODIES.filter(b => b.kind !== "sun");
export const MAX_REL = Math.max(...BODIES.map(b => b.rel));
export const byId = id => BODIES.find(b => b.id === id);
