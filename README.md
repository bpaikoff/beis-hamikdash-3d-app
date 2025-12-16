# בית המקדש — Beis Hamikdash 3D Explorer

An immersive first-person 3D walkthrough of the Holy Temple (Beis Hamikdash) in Jerusalem, featuring historically accurate architecture, holy vessels, and educational information.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm run dev
```

Then open **http://localhost:5173** in your browser.

## Controls

| Key | Action |
|-----|--------|
| `W` / `↑` | Walk forward |
| `S` / `↓` | Walk backward |
| `A` / `←` | Strafe left |
| `D` / `→` | Strafe right |
| `Shift` | Run |
| `Space` | Jump |
| `G` | Toggle ghost/noclip mode |
| `Mouse` | Look around |
| `Click` | Capture mouse |
| `Esc` | Release mouse |

## Temple Areas

### Outer Courts
- **Har HaBayis** — Temple Mount platform with outer walls and Chuldah Gates
- **Ezras Nashim** — Women's Court with four corner chambers:
  - Chamber of Oils (שמנים)
  - Chamber of Lepers (מצורעים)
  - Chamber of Nazarites (נזירים)
  - Chamber of Wood (עצים)

### Inner Courts (Azara)
- **Azaras Yisrael** — Court of Israelites (accessed via 15 steps)
- **Duchan** — Platform where Levites sang
- **Azaras Kohanim** — Priests' Court containing:
  - Great Altar (Mizbeiach) with ramp (Kevesh)
  - Copper Laver (Kiyor)
  - Slaughter tables and rings
  - Hanging pillars with hooks
  - Chamber of Hewn Stone (Lishkas HaGazis) — Sanhedrin
  - Chamber of the Hearth (Beis HaMoked)

### Heichal (Sanctuary)
- **Ulam** — Entrance Hall with Yachin and Boaz copper pillars
- **Heichal** — Main Sanctuary containing:
  - Golden Menorah (7 branches, lit)
  - Showbread Table (Shulchan) with 12 loaves
  - Golden Incense Altar (Mizbeiach HaZahav)
- **Kodesh HaKodashim** — Holy of Holies containing:
  - Holy Ark (Aron) with Keruvim
  - Foundation Stone (Even HaShtiya)
  - Paroches (sacred curtain)

## Gates

### Main Gates
- **Chuldah Gates** — Southern entrance (2 gates)
- **Beautiful Gate** (Sha'ar HaYafeh) — Entrance to Ezras Nashim
- **Nicanor Gate** — The great copper gate to the Azara

### Azara Side Gates (6 total)
- West: Kindling Gate, Water Gate, Gate of Firstlings
- East: Hearth Gate, Flame Gate, Sacrifice Gate

## Features

- **Hebrew Date Display** — Shows current date in Hebrew calendar
- **Daily Korbanos** — Lists the day's required offerings
- **Interactive Labels** — Walk near any vessel or gate for historical information
- **Minimap** — Top-left corner navigation aid
- **Compass** — Directional orientation (North toward Kodesh HaKodashim)
- **Sacrifice Animals** — Lambs placed on slaughter tables representing the Tamid
- **Ambient Details** — Flames on the Menorah and altar, divine glow in Kodesh HaKodashim

## Architecture

The codebase uses a modular builder pattern:

```
src/
├── game/
│   ├── TempleGame.js        # Main game controller
│   ├── TempleBuilder.js     # Orchestrates all builders
│   ├── PlayerController.js  # Movement and collision
│   └── builders/
│       ├── BaseBuilder.js       # Shared building utilities
│       ├── HarHaBayisBuilder.js # Temple Mount
│       ├── EzrasNashimBuilder.js# Women's Court
│       ├── AzaraBuilder.js      # Priests' Courts
│       ├── HeichalBuilder.js    # Sanctuary
│       ├── KeilimBuilder.js     # Holy vessels
│       └── LightingBuilder.js   # Lights and atmosphere
├── utils/
│   ├── HebrewCalendar.js    # Hebrew date calculations
│   └── Korbanos.js          # Daily offering logic
└── App.jsx                  # React UI
```

## Sources

Dimensions and layout based on:
- Maseches Middos (Mishnah)
- Rambam, Hilchos Beis HaBechirah
- Maseches Yoma
- Maseches Tamid

## Tech Stack

- React 18
- Three.js (3D rendering)
- Vite (build tool)

## Contributing

Contributions welcome! Areas for improvement:
- Additional Keilim details
- More accurate dimensions
- Sound effects (Levite singing, shofar)
- Time-of-day lighting changes
- Festival-specific decorations

---

יְהִי רָצוֹן שֶׁיִּבָּנֶה בֵּית הַמִּקְדָּשׁ בִּמְהֵרָה בְיָמֵינוּ

*May the Beis Hamikdash be rebuilt speedily in our days*
