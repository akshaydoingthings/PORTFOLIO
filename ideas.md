# Design brief — Akshay Kumar portfolio

## Design movement
Minimal editorial portfolio with an indie-software edge: quiet, deliberate, and typographically confident rather than glossy or template-like.

## Core principles
- Lead with a strong point of view and clear hierarchy.
- Use restraint: one accent color, tight copy, and purposeful motion.
- Keep the page fast and legible with CSS-first surfaces instead of decorative imagery.
- Make technical identity visible through code, metadata, and precise microcopy.

## Color philosophy
Dark ink (`#141512`) is the canvas; warm off-white (`#F3F1E8`) is the primary reading color; electric lime (`#D9F75D`) is reserved for action, active states, and the brand mark. Muted sage and graphite support hierarchy.

## Layout paradigm
Single-page longform with a slim sticky nav, generous horizontal margins, a two-column hero, offset project cards, and a compact split-stat rail. Sections are separated by thin rules and small uppercase labels.

## Signature elements
- Rounded terminal panel with syntax-colored lines in the hero.
- Lime square brand mark based on an open bracket + dot metaphor.
- Small “available for…” handwritten-style note.
- Project cards that reveal a diagonal arrow and subtle lift on hover.
- Fine blueprint/grid background pattern.

## Interaction philosophy
Interactions should feel tactile and informative: underlines grow on links, cards lift slightly, buttons invert, and active navigation is obvious. No gratuitous parallax.

## Animation
IntersectionObserver-powered reveal with a 650ms ease-out and staggered delays. Respect `prefers-reduced-motion` by disabling transitions and smooth scrolling.

## Typography system
Use a high-contrast serif for display headlines (`Georgia` fallback stack) and a neutral system sans for interface/copy. Metadata uses letter-spaced uppercase text.

## Brand essence
Akshay is the kind of builder who makes complex systems feel calm, human, and useful.

## Brand voice
Curious, direct, quietly ambitious, and specific. Avoid buzzword piles; prefer concrete verbs and short sentences.

## Wordmark / logo
`am/` as a compact monogram: a full-bleed ink square with a lime open-bracket silhouette and centered lime dot, echoing code syntax and a personal mark.

## Signature brand color
Electric lime `#D9F75D`.

## Ground-truth reference
The requested inspiration is the Simplefolio repository: one-page flow, bold hero, about, selected projects, contact CTA, social footer, responsive behavior, and light reveal motion. This implementation keeps that information architecture while making the visual language more editorial and personal.

## Serving and discovery
Static HTML/CSS/JS is sufficient because all content is known at build time and there is no backend. The public page includes descriptive title/description, Open Graph/Twitter metadata (without a guessed canonical URL), and `manus-routes.json` for the single `/` route. The project is intended for static publication with versioned asset caching and uncached HTML.
