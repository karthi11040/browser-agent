# ChatGPT Design System Specification

## Overview

**Product:** ChatGPT  
**Surfaces Covered:**
1. **Marketing & Web Application Studio Surface:** `https://chatgpt.com/` (Conversion & Productivity)
2. **Editorial & Content / Blog Surface:** `https://chatgpt.com/c/6ab75e8a-e570-83e8-8e8a-ae46719724f9` (Content-First & Sustained Reading)

---

## 1. Design Principles by Surface

### Surface 1: Marketing & Studio (`https://chatgpt.com/`)
- **Consistency over novelty** — reuse existing patterns before inventing new ones.
- **Token-driven** — every visual decision references a token, not a magic number.
- **Accessible by default** — compliance is a baseline, not a feature.

### Surface 2: Editorial & Blog (`https://chatgpt.com/c/...`)
- **Readability above all** — optimise for sustained reading, not scanning.
- **Content is the interface** — typography and whitespace do the heavy lifting.
- **Minimal chrome** — navigation and UI should fade behind the content.

---

## 2. Color Tokens

| Token | Value | Role | Notes |
|-------|-------|------|-------|
| `--bg-primary` | `#212121` | Background | Dark base background |
| `--bg-tertiary` | `#414141` | Background | Card/secondary surface |
| `--bg-secondary` | `#E8E8E8` | Background | Light neutral surface |
| `--bg-secondary-surface` | `#F9F9F9` | Background | Crisp light surface |
| `--bg-tertiary-light` | `#F3F3F3` | Background | Light background tint |
| `--bg-status-success` | `#1F4E25` | Background | Success dark banner |
| `--bg-status-success-light` | `#DEF3E5` | Background | Success light banner |
| `--theme-blue-text-on-background` | `#2C67C5` | Background / Accent | Action blue |
| `--theme-blue-text-on-background-light` | `#E8F3FE` | Background | Light blue tint |
| `--theme-purple-background` | `#EDE5FC` | Background | Light purple pill/tag |
| `--text-tertiary` | `#5D5D5D` | Text Primary (Light) | Medium gray copy |
| `--text-secondary` | `#CDCDCD` | Text Secondary (Dark) | Subdued dark text |
| `--theme-purple-text` | `#A67DF2` | Text Secondary | Light purple text |
| `--theme-purple-accent` | `#7849D1` | Accent | Vibrant purple accent |
| `--color-green-700` | `#2C6732` | Accent | Deep green |
| `--color-green-600` | `#3A843F` | Accent | Medium green |
| `--accent-default` | `#8F8F8F` | Accent | Neutral border/icon |
| `--accent-muted` | `#AFAFAF` | Accent | Soft muted accent |
| `color-11` | `#FF6764` | Accent (Coral) | Editorial highlight / alert |
| `color-1` | `#000000` | Background Dark | Pure OLED black |
| `color-4` | `#1F4E94` | Border | Deep indigo border |
| `color-20` | `#FFFFFF` | Text Light | Pure white |

---

## 3. Typography Systems

**Font stack:** `-apple-system-body, OpenAI Sans, Inter, system-ui, -apple-system, sans-serif`

### System A: Marketing / Web Studio (High Density)
| Level | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 12px | 16px / 17.14px | Captions, metadata, tags |
| `text-sm` | 14px | 20px | Labels, secondary text, button labels |
| `text-base` | 16px | 24px | Body text (default studio) |
| `text-lg` | 18px | 28px | Subheadings, section emphasis |
| `text-xl` | 24px | 32px / 36px | Primary modal / section headings |

**Weight scale:** `400` (Regular) · `600` (Semi-bold)

### System B: Editorial & Reading (Sustained Reading)
| Level | Size | Line Height | Usage |
|-------|------|-------------|-------|
| `text-xs` | 14px | 20px | Captions, editorial metadata, author tags |
| `text-sm` | 16px | 24px | Secondary reading, lead-in captions |
| `text-base` | 18px | 28px / 32px | Primary article reading body (default) |
| `text-lg` | 24px | 36px | Subheadings, pull-quotes |

**Weight scale:** `400` (Regular) · `500` (Medium) · `600` (Semi-bold)

---

## 4. Spacing Scale

**Base unit:** 4px

- `space-1`: 2px
- `space-2`: 4px
- `space-3`: 5px / 6px
- `space-4`: 8px
- `space-5`: 10px
- `space-6`: 16px
- `space-7`: 22px
- `space-8`: 24px
- `space-9`: 82px
- `space-10`: 329px
- `space-11`: 466px

---

## 5. Shapes & Border Radii

- `radius-sm`: `0px 10px 10px 0px` (tab attachments)
- `radius-md`: `2.68435e+07px` (circular / full pill)
- `radius-lg`: `8px` (cards, dialogs)
- `radius-xl`: `10px` (popovers, active tabs)
- `radius-full`: `16px` (large containers, chat bubbles)
- `radius-6`: `28px` (prominent input boxes)

---

## 6. Elevation & Shadows

- **shadow-sm:** `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(31, 78, 148) 0px 0px 0px 0px`
- **shadow-md:** `0px 2px 8px rgba(0, 0, 0, 0.08)`
- **shadow-lg:** `rgba(255, 255, 255, 0.2) 0px 0px 1px 0px inset`
- **Editorial / Blog surface:** Zero elevation detected (flat, content-forward aesthetic with pure whitespace separation).

---

## 7. Motion & Transitions

- **duration-fast:**
  - `opacity 0.001s cubic-bezier(0.4, 0, 0.2, 1)`
  - `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s, border-color 0.15s`
  - `opacity 0.15s steps(1, start)`
- **duration-base:**
  - `color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s, border-color 0.2s`
  - `width 0.3s cubic-bezier(0, 0, 0.2, 1)`
- **duration-slow:**
  - `opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)`

---

## 8. Component Density & Inventory

| Surface | Buttons | Links | Inputs | Navigation | Lists | Forms | Images |
|---|---|---|---|---|---|---|---|
| **Marketing / Studio** | 12 | 7 | 6 | 2 | 1 | 1 | 21 |
| **Editorial / Blog** | 105 | 43 | 6 | 2 | 4 | 1 | 121 |

---

## 9. Tone of Voice

- **Marketing & Studio:** Concise, confident, implementation-focused. Avoid filler preambles.
- **Editorial & Blog:** Informative, engaging, conversational. First person plural (`we`, `our`) when appropriate.

---

## 10. Do's and Don'ts

### Do
- Reference tokens by name, not raw values — agents and developers should use `color.text.primary` or `var(--bg-primary)`, not hardcoded hex values.
- Define all interactive states: default, hover, focus-visible, active, disabled.
- Use the spacing scale for all padding, margin, and gap values.
- Write content in sentence case. Reserve ALL CAPS for acronyms only.
- Test every component at the smallest and largest breakpoint before shipping.

### Don't
- Do not introduce colors outside the extracted palette.
- Do not use arbitrary spacing values — stick to the scale.
- Do not mix border-radius values. Pin to the detected set (`0px 10px 10px 0px`, `2.68435e+07px`, `8px`, `10px`, `16px`, `28px`).
- Do not use full-uppercase text for body or paragraph content.
- Do not nest interactive elements (e.g. buttons inside links).
- Do not ship components without defining hover, focus-visible, and disabled states.

---

## 11. Authoring Workflow

When creating or updating a component guideline for this system, follow this sequence:

1. **State the intent** — one sentence on what the component does and why it exists.
2. **Map tokens** — list every color, spacing, typography, and radius token the component uses. No raw values.
3. **Define anatomy** — break the component into named parts (container, label, icon, etc.) with their token assignments.
4. **Specify states** — document every state: default, hover, focus-visible, active, disabled, loading, error, empty.
5. **Describe interactions** — keyboard, pointer, and touch behavior, including edge cases (long content, overflow, truncation).
6. **Add accessibility criteria** — write testable pass/fail checks (e.g. "focus ring must be visible at 3:1 contrast").
7. **List anti-patterns** — concrete examples of misuse with a brief explanation of why each is wrong.
8. **Close with a QA checklist** — a mechanical list of verifiable items (see Definition of Done below).

---

## 12. Required Output Structure

Every component guideline produced from this system must contain these sections, in order:

1. **Overview** — purpose, when to use, when not to use.
2. **Tokens and foundations** — all referenced tokens from the tables above.
3. **Anatomy and variants** — named parts, variant matrix, responsive behavior.
4. **States and interactions** — full state table, keyboard/pointer/touch behavior.
5. **Accessibility** — ARIA attributes, contrast requirements, focus management, screen reader behavior.
6. **Content guidelines** — copy length, tone, capitalisation, placeholder text rules.
7. **Anti-patterns** — explicit examples of what not to build, with reasoning.

---

## 13. Definition of Done

A component is not complete until every item below is checked:

- [ ] Renders correctly in its default state (smoke test).
- [ ] All states documented and visually verified (hover, focus, disabled, loading, error, empty).
- [ ] All visual values use design tokens — zero hardcoded values.
- [ ] Keyboard navigation works without a pointer.
- [ ] No critical accessibility violations (contrast, ARIA, focus order).
- [ ] Tested at smallest and largest breakpoint.
- [ ] Anti-patterns section lists at least one concrete misuse example.
- [ ] Documentation covers purpose, usage, props/API, and limitations.
