# CastleDefence / Emberfall: Factions

A browser strategy game by Linus Virebrand. The first playable prototype was built in one day using AI-assisted programming and image generation. The current version includes subsequent improvements; the one-day statement describes the initial prototype, not every feature in this repository.

## Play

[Play in your browser](https://crutz69.github.io/ProjektCastleDefence/)

Download `Spel.html` and open it in a modern desktop browser. The complete game, artwork and fonts are embedded. No installation, account or external service is required. Sound starts after interaction.

## Technical highlights

- JavaScript and Canvas rendering, with no runtime package dependencies.
- Four factions, animated units, projectile combat and class counters.
- Resource-limited opponents with four difficulty levels and scouting-based decisions.
- Twelve-stage campaign, local save checkpoints and tactical upgrades.
- Responsive interface and an offline single-file build.

## Development

Requires Node.js. Run `npm run check`, `npm test` and `npm run build`. Open `index.html` through a local server for source development, or open the generated `Spel.html` directly.

## Authorship and assets

Created through AI-assisted development. Project documentation records use of image generation for faction artwork. Generated artwork is included as part of the game; no claim of exclusive rights to generated imagery is made. Cinzel and DM Sans are distributed under their included SIL Open Font Licenses in `assets/`, also embedded in `Spel.html`.

No general open-source license is granted for the game code or artwork in this repository. Public visibility is provided for portfolio review. Third-party fonts retain their own license terms.

The repository contains only the current demo and the files needed to build it. Development archives and original working files are excluded.
