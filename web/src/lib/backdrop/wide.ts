// Where the backdrop lives: screens this wide leave margins beside the sheet
// for it (components/Backdrop.astro). Narrower ones get the story on a page
// of its own (pages/story.astro), which wide ones never see. Stylesheets
// can't import it, so the ones that hang on it say 1440px themselves.

export const WIDE = '(min-width: 1440px)';
