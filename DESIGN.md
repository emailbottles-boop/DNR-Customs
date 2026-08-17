# D&R Customs — design system

Modern streetwear. Dark, typographic, technical. The reference points are
drop pages and technical-wear labels, not general-purpose webshops.

**Right now the shop carries one product, and the site is built around it as
Drop 01.** Layouts must look deliberate with a single item, never like a grid
waiting to be filled.

## Tokens

Defined in `src/app/globals.css`. Use the Tailwind names, never raw hex.

| Token | Use |
| --- | --- |
| `bg-ground` | Page ground — graphite, not flat black |
| `bg-void` | Deeper band, for full-bleed sections |
| `bg-surface` | Recessed wells: image fields, inputs |
| `bg-surface-lift` | Raised chips, disabled states |
| `text-bone` | Primary text |
| `text-bone-soft` | Body copy, secondary |
| `text-bone-faint` | Metadata, disabled |
| `border-hairline` | Dividers |
| `border-hairline-lit` | Interactive borders |
| `text-signal` / `bg-signal` | **The one accent.** See below. |
| `text-alert` | Validation errors only |

### The signal colour

`--signal` is a saturated orange. It is spent on **one primary action per view**
and on live status (in stock, drop live). Nothing else. If two things on a
screen are orange, one of them is wrong. Everything else earns emphasis through
scale, weight, and whitespace.

## Type

Two families, and the split matters — it is what separates this from a generic
dark theme.

- **Archivo** carries the shouting. `.display` is weight 800, uppercase,
  letter-spacing `-0.035em`, line-height `0.86`. Set it **large**: `text-6xl`
  minimum for a section head, `text-8xl`/`text-9xl` for a drop hero. Packed
  tight, filling its measure.
- `.display-sub` is the step down — heavy, uppercase, less compressed.
- **IBM Plex Mono** handles anything technical via `.label`: sizes, order
  references, prices in tables, section marks, nav, buttons. Uppercase,
  wide-tracked, 11px.
- `.prose-body` for running copy. Keep body text quiet and small; the display
  face does the work.

## Components

Use these rather than rebuilding them:

- `.btn` + `.btn-primary` — the signal fill. One per view.
- `.btn` + `.btn-ghost` — everything else.
- `.link-rule` — inline links, underline draws on hover.
- `.swatch` — size and colour selectors. Selected state is a **bone** fill, not
  signal; the signal belongs to the action. Drive it with `aria-pressed`.
- `.field-input` — form fields.

## Rules of the house

1. **No rounded corners.** No `rounded-*` anywhere.
2. **One accent, used once per view.** See above.
3. **Hairlines, not cards.** Prefer a single `border-t` over a bordered box.
4. **Type is the graphic.** Oversized uppercase display, tightly tracked, is the
   main visual device. Let headlines run big and crop close.
5. **Mono for anything small.** Use `.label`.
6. **Motion is fast and slight.** 0.2–0.3s. A subtle image scale on hover is the
   ceiling. No bounce, no parallax, no scroll-jacking.
7. **Product images carry the colour.** They sit on `bg-surface` wells in
   portrait ratios (`aspect-[3/4]`, `aspect-[4/5]`).
8. **Drop framing is real, not decoration.** "Drop 01" is meaningful — more will
   follow. Numbered markers are legitimate here; elsewhere they are not.

## Non-negotiable

Presentation only. Do not change component props, exported names, data
fetching, state logic, form field `name`s, or API request shapes. Keep every
`aria-*` attribute, `role`, `htmlFor`/`id` pairing, and screen-reader text
intact or improve it — accessibility must not regress.
