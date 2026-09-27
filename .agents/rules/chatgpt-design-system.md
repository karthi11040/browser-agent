# Rule: ChatGPT Design System Guidelines

Apply the following design system tokens, principles, and rules when building or modifying UI components, marketing surfaces, editorial blogs, and web pages:

## Design Principles
- **Marketing / Studio**: Consistency over novelty, token-driven, accessible by default.
- **Editorial / Blog**: Readability above all (optimised for sustained reading), content is the interface, minimal chrome.

## Colors & Tokens
- `--bg-primary`: `#212121` (Dark Primary Background)
- `--bg-tertiary`: `#414141` (Dark Surface/Card Background)
- `--bg-secondary`: `#E8E8E8` (Light Surface)
- `--bg-secondary-surface`: `#F9F9F9`
- `--bg-tertiary-light`: `#F3F3F3`
- `--text-secondary`: `#CDCDCD`
- `--text-tertiary`: `#5D5D5D`
- `--color-green-700`: `#2C6732` (Accent)
- `--color-green-600`: `#3A843F` (Accent)
- `--accent-default`: `#8F8F8F`
- `--accent-muted`: `#AFAFAF`
- `color-11`: `#FF6764` (Accent Coral / Alert)
- `color-1`: `#000000` (Pure Dark Background)
- `color-4`: `#1F4E94` (Border)
- `color-20`: `#FFFFFF` (Light Text)
- `--theme-purple-text`: `#A67DF2` / `#7849D1`
- `--theme-purple-background`: `#EDE5FC`
- `--theme-blue-text-on-background`: `#2C67C5` / `#E8F3FE`
- `--bg-status-success`: `#1F4E25` / `#DEF3E5`

## Typography Systems
- **Font Stack**: `-apple-system-body, OpenAI Sans, Inter, system-ui, -apple-system, sans-serif`
- **Studio Scale**: 12px (`text-xs`), 14px (`text-sm`), 16px (`text-base`), 18px (`text-lg`), 24px (`text-xl`)
- **Editorial / Reading Scale**: 14px (`text-xs`), 16px (`text-sm`), 18px (`text-base` body), 24px (`text-lg`)
- **Weight Scale**: 400 · 500 · 600

## Spacing (Base unit: 4px)
- `space-1` (2px), `space-2` (4px), `space-3` (6px), `space-4` (8px), `space-5` (10px), `space-6` (16px), `space-7` (22px), `space-8` (24px), `space-9` (82px), `space-10` (329px)

## Shapes & Radii
- `radius-sm`: `0px 10px 10px 0px`
- `radius-md`: `2.68435e+07px` (pill)
- `radius-lg`: `8px`
- `radius-xl`: `10px`
- `radius-full`: `16px`
- `radius-6`: `28px`

## Writing Tone
- Studio / Product: Concise, confident, implementation-focused.
- Editorial / Blog: Informative, engaging, conversational (first person plural when appropriate).

## Component Quality Bar (Definition of Done)
- All states documented and visually verified (hover, focus, disabled, loading, error, empty).
- All visual values use design tokens — zero hardcoded values.
- Keyboard navigation works without a pointer.
- Tested at smallest and largest breakpoint.
