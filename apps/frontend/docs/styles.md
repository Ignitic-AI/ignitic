# Design System & Styles

This document outlines the common styles, components, and patterns used across the Ignitic AI frontend. Reference this when creating new components to ensure consistency.

## Typography

- **Main Headings (h1, h2):** `font-generalSans` (General Sans)
  - Common classes: `text-3xl font-bold font-generalSans` or `text-4xl font-semibold font-generalSans`.
- **Paragraphs & General Text:** `font-generalSans` or `font-sans` (Manrope is the default sans-serif).
  - Common classes: `text-sm font-medium font-generalSans` or `text-base`.
- **Special/Logo:** `font-bebasNeue` (Bebas Neue).

## Colors

### Dark Mode (Default Theme)
- **Background:** `bg-bg` (`oklch(0.15 0 272)`)
- **Lighter Background:** `bg-bg-light` (`oklch(0.2 0 272)`)
- **Text:** `text-text` (`oklch(0.96 0 272)`)
- **Muted Text:** `text-text-muted` (`oklch(0.76 0 272)`)
- **Border:** `border-border` (`oklch(0.4 0 272)`)
- **Primary:** `bg-primary` (`oklch(0.76 0.1 272)`)

### Light Mode
- **Background:** `bg-bg-lm` (`oklch(0.96 0 272)`)
- **Lighter Background:** `bg-bg-light-lm` (`oklch(1 0 272)`)
- **Text:** `text-text-lm` (`oklch(0.15 0 272)`)
- **Muted Text:** `text-text-muted-lm` (`oklch(0.4 0 272)`)
- **Border:** `border-border-lm` (`oklch(0.6 0 272)`)
- **Primary:** `bg-primary-lm` (`oklch(0.4 0.1 272)`)

## Component Styles

### Buttons
- **Roundedness:** `rounded-md` (Standard Shadcn/UI default).
- **Height:** `h-9` (default), `h-8` (sm), `h-10` (lg).
- **Padding:** `px-4 py-2` (default).
- **Font:** `text-sm font-medium`.

### Cards
- **Roundedness:** `rounded-xl` (Legacy / Standard containers).
- **Modern Dashboard/List Roundedness:** `rounded-[4px]` (Used for grid items, workflow lists, and dashboard widgets).
- **Height:** Most cards use `h-fit` or `min-h-[300px]` depending on content.
- **Border:** `border` (with `border-border` or `border-border-lm`).
- **Padding:** `p-6` (Standard for containers).
- **Shadow:** `shadow-sm` or `shadow-lg` for highlighted sections.

### Modals & Dialogs
- **Roundedness:** `rounded-[4px]` (To match the modern card design).

### Inputs & Selects
- **Height:** `h-9` or `h-10`.
- **Roundedness:** `rounded-md`.
- **Font:** `font-generalSans`.

## Best Practices
- Use `cn()` utility from `@/lib/utils` for merging Tailwind classes.
- Prefer `font-generalSans` for UI elements and headings.
- Always include both light and dark mode classes for colors (e.g., `bg-bg-lm dark:bg-bg`).
- Use the `@theme` variables defined in `src/app/globals.css` where possible.
