# ChatGPT Design System Specification

## Overview

**Product:** ChatGPT  
**URL:** https://chatgpt.com/  
**Surface type:** marketing / web application  
**Audience:** Business decision-makers, developers, and potential customers  
**Brand character:** Conversion-focused marketing and high-productivity chat presence with a rich, diverse color palette and a complementary two-font typographic system.

### Design Principles

- **Consistency over novelty** — reuse existing patterns before inventing new ones.
- **Token-driven** — every visual decision references a token, not a magic number.
- **Accessible by default** — compliance is a baseline, not a feature.

---

## Colors

| Token | Value | Role |
|-------|-------|------|
| `--bg-primary` | `#212121` | Background |
| `--bg-tertiary` | `#414141` | Background |
| `--bg-status-success` | `#1F4E25` | Background |
| `--theme-blue-text-on-background` | `#2C67C5` | Background |
| `--bg-secondary` | `#E8E8E8` | Background |
| `--theme-purple-background` | `#EDE5FC` | Background |
| `--bg-status-success-light` | `#DEF3E5` | Background |
| `--theme-blue-text-on-background-light` | `#E8F3FE` | Background |
| `--bg-tertiary-light` | `#F3F3F3` | Background |
| `--bg-secondary-surface` | `#F9F9F9` | Background |
| `--text-tertiary` | `#5D5D5D` | Text Primary |
| `--theme-purple-text` | `#A67DF2` | Text Secondary |
| `--text-secondary` | `#CDCDCD` | Text Secondary |
| `--color-green-700` | `#2C6732` | Accent |
| `--theme-purple-accent` | `#7849D1` | Accent |
| `--color-green-600` | `#3A843F` | Accent |
| `--accent-default` | `#8F8F8F` | Accent |
| `--accent-muted` | `#AFAFAF` | Accent |
| `color-4` | `#1F4E94` | Border |
| `color-20` | `#FFFFFF` | Text Light |

---

## Typography

**Font stack:** `-apple-system-body, OpenAI Sans, Inter, system-ui, -apple-system, sans-serif`

| Level | Size | Usage |
|-------|------|-------|
| `text-xs` | 12px | Captions, metadata |
| `text-sm` | 14px | Labels, secondary text |
| `text-base` | 16px | Body text (default) |
| `text-lg` | 18px | Subheadings, emphasis |
| `text-xl` | 24px | Section headings |

**Weight scale:** `400` (Regular) · `600` (Semi-bold)  
**Line heights:** `32px` · `28px` · `24px` · `20px` · `26px` · `16px` · `36px` · `17.1429px`

---

## Spacing

**Base unit:** 4px

- `space-1: 2px`
- `space-2: 4px`
- `space-3: 5px`
- `space-4: 6px`
- `space-5: 7px`
- `space-6: 8px`
- `space-7: 10px`
- `space-8: 12px`
- `space-9: 14px`
- `space-10: 16px`
- `space-11: 22px`
- `space-12: 24px`
- `space-13: 32px`
- `space-14: 64px`
- `space-15: 82px`
- `space-16: 329px`
- `space-17: 466px`

---

## Shapes

**Border radius:**
- `radius-sm`: `0px 10px 10px 0px`
- `radius-md`: `2.68435e+07px` (full pill)
- `radius-lg`: `8px`
- `radius-xl`: `10px`
- `radius-full`: `16px`
- `radius-6`: `28px`

---

## Elevation

- **shadow-sm:** `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgb(255, 255, 255) 0px 0px 0px 0px, rgb(31, 78, 148) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px`
- **shadow-md:** `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px`
- **shadow-lg:** `rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(255, 255, 255, 0.2) 0px 0px 1px 0px inset`

---

## Motion

- **duration-fast:** `all`
- **duration-fast:** `none`
- **duration-fast:** `opacity 0.001s cubic-bezier(0.4, 0, 0.2, 1)`
- **duration-fast:** `color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), outline-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.15s cubic-bezier(0.4, 0, 0.2, 1), fill 0.15s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-from 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-via 0.15s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-to 0.15s cubic-bezier(0.4, 0, 0.2, 1)`
- **duration-fast:** `opacity 0.15s steps(1, start)`
- **duration-base:** `color 0.2s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), outline-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), text-decoration-color 0.2s cubic-bezier(0.4, 0, 0.2, 1), fill 0.2s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-from 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-via 0.2s cubic-bezier(0.4, 0, 0.2, 1), --tw-gradient-to 0.2s cubic-bezier(0.4, 0, 0.2, 1)`
- **duration-base:** `width 0.3s cubic-bezier(0, 0, 0.2, 1)`
- **duration-slow:** `opacity 0.5s cubic-bezier(0.4, 0, 0.2, 1)`

---

## Components

- **Buttons:** 12 detected
- **Links:** 7 detected
- **Inputs:** 6 detected
- **Navigation:** 2 elements
- **Lists:** 1 detected
- **Forms:** 1 detected
- **Images:** 21 detected

---

## Do's and Don'ts

### Do
- Reference tokens by name, not raw values — agents and developers should use `color.text.primary`, not `#171717`.
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

## Writing Tone

Concise, confident, implementation-focused. Avoid filler preambles.

---

## Authoring Workflow

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

## Required Output Structure

Every component guideline produced from this system must contain these sections, in order:

1. **Overview** — purpose, when to use, when not to use.
2. **Tokens and foundations** — all referenced tokens from the tables above.
3. **Anatomy and variants** — named parts, variant matrix, responsive behavior.
4. **States and interactions** — full state table, keyboard/pointer/touch behavior.
5. **Accessibility** — ARIA attributes, contrast requirements, focus management, screen reader behavior.
6. **Content guidelines** — copy length, tone, capitalisation, placeholder text rules.
7. **Anti-patterns** — explicit examples of what not to build, with reasoning.

---

## Component Requirements

Every component built against this system must:

- Reference only tokens defined in the tables above — no hardcoded hex, px, or font values.
- Define all interactive states: default, hover, focus-visible, active, disabled, loading, error.
- Specify responsive behavior at the smallest and largest supported breakpoint.
- Handle edge cases: empty state, overflow / truncation, maximum content length.
- Include keyboard navigation (Tab, Enter, Escape, Arrow keys where applicable).
- Document ARIA roles, labels, and live-region behavior where relevant.
- Include known page component density:
  - **Buttons:** 12 detected
  - **Links:** 7 detected
  - **Inputs:** 6 detected
  - **Navigation:** 2 elements
  - **Lists:** 1 detected
  - **Forms:** 1 detected
  - **Images:** 21 detected

---

## Definition of Done

A component is not complete until every item below is checked:

- [ ] Renders correctly in its default state (smoke test).
- [ ] All states documented and visually verified (hover, focus, disabled, loading, error, empty).
- [ ] All visual values use design tokens — zero hardcoded values.
- [ ] Keyboard navigation works without a pointer.
- [ ] No critical accessibility violations (contrast, ARIA, focus order).
- [ ] Tested at smallest and largest breakpoint.
- [ ] Anti-patterns section lists at least one concrete misuse example.
- [ ] Documentation covers purpose, usage, props/API, and limitations.
