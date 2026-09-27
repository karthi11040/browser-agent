# Rule: ChatGPT Design System Guidelines

Apply the following design system tokens, principles, and rules when building or modifying UI components, marketing surfaces, and web pages:

## Design Principles
- **Consistency over novelty** — reuse existing patterns before inventing new ones.
- **Token-driven** — every visual decision references a token, not a magic number.
- **Accessible by default** — compliance is a baseline, not a feature.

## Colors & Tokens
- `--bg-primary`: `#212121` (Dark Primary Background)
- `--bg-tertiary`: `#414141` (Dark Surface/Secondary Background)
- `--bg-secondary`: `#E8E8E8` (Light Surface)
- `--bg-secondary-surface`: `#F9F9F9`
- `--bg-tertiary-light`: `#F3F3F3`
- `--text-secondary`: `#CDCDCD`
- `--text-tertiary`: `#5D5D5D`
- `--color-green-700`: `#2C6732` (Accent)
- `--color-green-600`: `#3A843F` (Accent)
- `--accent-default`: `#8F8F8F`
- `--accent-muted`: `#AFAFAF`
- `color-4`: `#1F4E94` (Border)
- `color-20`: `#FFFFFF` (Light Text)
- `--theme-purple-text`: `#A67DF2` / `#7849D1`
- `--theme-purple-background`: `#EDE5FC`
- `--theme-blue-text-on-background`: `#2C67C5` / `#E8F3FE`
- `--bg-status-success`: `#1F4E25` / `#DEF3E5`

## Typography
- **Font Stack**: `-apple-system-body, OpenAI Sans, Inter, system-ui, -apple-system, sans-serif`
- `text-xs`: 12px (captions, metadata)
- `text-sm`: 14px (labels, secondary text)
- `text-base`: 16px (body text default)
- `text-lg`: 18px (subheadings, emphasis)
- `text-xl`: 24px (section headings)
- Weights: 400 · 600

## Spacing (Base unit: 4px)
- `space-1` (2px), `space-2` (4px), `space-4` (6px), `space-6` (8px), `space-8` (12px), `space-10` (16px), `space-12` (24px), `space-13` (32px), `space-14` (64px)

## Shapes & Radii
- `radius-sm`: `0px 10px 10px 0px`
- `radius-md`: `2.68435e+07px` (pill)
- `radius-lg`: `8px`
- `radius-xl`: `10px`
- `radius-full`: `16px`
- `radius-6`: `28px`

## Component Quality Bar (Definition of Done)
- All states documented and visually verified (hover, focus, disabled, loading, error, empty).
- All visual values use design tokens — zero hardcoded values.
- Keyboard navigation works without a pointer.
- Tested at smallest and largest breakpoint.
