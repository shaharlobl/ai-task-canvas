

## Elevate the Kanban Board Design

The current design is very monochrome (zinc/slate only). Here's the plan to add color, depth, and richer interactions.

### 1. Colored Column Headers
Each column gets a distinct color accent:
- **To Do**: Indigo/violet indicator dot + tinted count badge
- **In Progress**: Amber/orange indicator dot + tinted count badge  
- **Completed**: Emerald/green indicator dot + tinted count badge

Add a subtle gradient or colored top border to each column area.

### 2. Richer Task Cards
- **Priority left border**: Instead of a tiny dot, add a colored left border strip (4px) -- red for high, amber for medium, green for low
- **Glassmorphism hover**: On hover, cards get a subtle backdrop blur + gradient overlay
- **Checkbox completion animation**: Add a satisfying checkmark animation when completing tasks
- **Category badges with colors**: Map categories to distinct pastel-colored badges (design, dev, research, etc.)
- **Avatar/initials circle** placeholder on each card for visual weight

### 3. Header Upgrade
- Gradient accent on the logo icon (indigo-to-purple)
- Progress bar showing completion percentage (animated, colored gradient)
- Subtle background pattern or mesh gradient behind the header

### 4. AI Sidebar Polish
- Gradient header bar (blue-to-purple) for the AI section
- Animated gradient border on the AI input when focused
- Suggestion chips below the empty state (quick actions like "Summarize board", "Add a task")
- Typing indicator with a gradient shimmer effect

### 5. Background & Layout
- Subtle dot grid or noise texture on the board background
- Column drop zones show a colorful dashed border animation when dragging
- Smooth spring-like animations on card hover (scale + shadow layers)

### 6. New CSS Variables & Animations
- Add column color variables (indigo, amber, emerald) to the theme
- Add shimmer keyframe, gradient-border keyframe, and spring-scale animation
- Add a dot-grid background utility class

### Files to Change
- `src/index.css` -- new color variables, background patterns, animations
- `tailwind.config.ts` -- new color tokens, keyframes
- `src/components/KanbanColumn.tsx` -- colored headers, enhanced drop zones
- `src/components/TaskCard.tsx` -- priority border, colored badges, richer hover
- `src/components/KanbanBoard.tsx` -- gradient header, progress bar
- `src/components/AISidebar.tsx` -- gradient header, suggestion chips, animated input
- `src/types/kanban.ts` -- add column color mapping

