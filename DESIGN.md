# DNR Customs — design system

The reference points are fashion houses and magazine spreads, not webshops.
Restraint is the brief: emphasis comes from scale, whitespace, and typographic
contrast — never from colour or ornament.

## Tokens

Defined in `src/app/globals.css`. Use the Tailwind names, never raw hex.

| Token | Use |
| --- | --- |
| `bg-paper` | Page ground (warm ivory) |
| `bg-paper-deep` | Recessed panels, image wells |
| `bg-card` | Raised cards |
| `text-ink` | Primary text |
| `text-ink-soft` | Body copy, secondary text |
| `text-ink-faint` | Disabled, metadata |
| `border-rule` | Hairline dividers |
| `border-rule-strong` | Interactive borders |
| `bg-inverse` / `text-inverse-ink` | Full-bleed inverted editorial panels |
| `text-alert` | Errors only |

## Type

- `.display` — Cormorant Garamond, light, tight. Statement headlines only.
  Set it **large**: `text-5xl` minimum, `text-7xl`/`text-8xl` for heroes.
- `.editorial` — italic serif, for asides and pull quotes.
- `.label` — uppercase, wide-tracked, 11px. Section marks, eyebrows, nav, meta.
- `.prose-editorial` — body copy at a readable measure.
- Default body font is Jost at weight 300. Keep body text small and quiet;
  let the serif carry the page.

## Components

Use these classes rather than rebuilding them:

- `.btn` + `.btn-primary` — the one primary action per view (ink block,
  inverts on hover).
- `.btn` + `.btn-ghost` — everything secondary (hairline border).
- `.link-rule` — inline links; the underline draws itself on hover.
- `.swatch` — variant selectors. Drive state with `aria-pressed`, not classes.
- `.field-input` — form fields. A baseline rule, no box.

## Rules of the house

1. **No rounded corners.** No `rounded-*` anywhere. Square edges throughout.
2. **No chromatic accent.** Ink, paper, and the garments. That is the palette.
   `text-alert` is for validation errors only.
3. **Hairline rules, not boxes.** Prefer a single `border-t`/`border-b` over a
   fully bordered card.
4. **Whitespace is the layout.** Be generous: `py-24`/`py-32` for sections.
   Crowding reads as cheap.
5. **Uppercase + tracking for anything small.** Use `.label`.
6. **Motion is slow and minimal.** 0.3–0.4s eases. No bounce, no scale-up
   flourishes; a gentle image zoom on hover is the ceiling.
7. **Images carry the page.** Give them room and let them run large; portrait
   aspect ratios (`aspect-[3/4]`, `aspect-[4/5]`) suit garments.

## Non-negotiable

Presentation only. Do not change component props, exported names, data
fetching, state logic, form field `name`s, or API request shapes. Keep every
`aria-*` attribute, `role`, `htmlFor`/`id` pairing, and screen-reader text
intact or improve it — accessibility must not regress.
