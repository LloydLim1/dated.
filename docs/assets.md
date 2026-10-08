# Asset provenance and direction

The visual direction uses forest green, warm light, restrained gold, DM Serif Display for expressive headings, and DM Sans for interface text. Place photographs are illustrative and do not document the fictional sample venues.

## Generated editorial asset

Built-in imagegen generated `public/images/editorial-source.png`. Its optimized derivatives are `public/images/hero.jpg` and `public/images/cafe.jpg`.

Final prompt: “Use case: photorealistic-natural. Asset type: wide editorial hero photograph for Dated, a Philippine outing discovery app. A beautiful candid still life at a sunlit contemporary Manila café: two iced coffees in condensation-covered glasses, a flaky croissant on a small ceramic plate, oak tabletop, woven rattan chair edge, lush tropical courtyard with olive and dark green plants behind, afternoon warm light. Intimate everyday exploration, magazine travel photography, natural analog grain, rich but believable color, cream highlights and forest green shadows. Landscape composition, photograph fills frame, no people necessary, no text, no logos, no watermarks. This is generic editorial illustration, not a named or existing venue.”

## Stock category photographs

- `restaurant.jpg`: https://images.unsplash.com/photo-1555396273-367ea4eb4db5
- `museum.jpg`: https://images.unsplash.com/photo-1561214115-f2f134cc4912
- `cinema.jpg`: https://images.unsplash.com/photo-1489599849927-2ee91cede3ba
- `pastry.jpg`: https://images.unsplash.com/photo-1509440159596-0249088772ff
- `garden.jpg`: https://images.unsplash.com/photo-1414235077428-338989a2e8c0

Downloaded copies are stored in the project, so rendering does not depend on remote photo URLs. Before publishing a real venue directory, replace these with correctly licensed and attributed venue photographs. [Unsplash license](https://unsplash.com/license).

## Fonts and icons

Local font files in `public/fonts/` came from Google Fonts. The original CSS URLs are retained in `google-fonts-source.css`. Icons use Lucide React. The Dated wordmark, icon, and navigation compositions are authored for this project.

Taste Blocks and the named animation audit tools were unavailable in this session. Native React, semantic HTML, CSS, Lucide, and MapLibre supply the interface instead. No unverifiable component catalog names or registry sources are claimed.

Motion focuses on place-card lift and photo zoom, input/action feedback, dialog arrival, and status feedback. Reduced-motion mode removes these transitions. The interface does not rely on animation to reveal its content.
