

## AI-Powered Kanban Board

A modern, Linear-inspired Kanban board with a full AI agent sidebar and persistent database storage.

### Layout
- **Left sidebar (240px)**: AI chat panel with conversation history, collapsible
- **Main canvas**: Three-column Kanban board (To Do, In Progress, Completed) using CSS Grid
- **Header**: App title, task count stats, and "Add Task" button

### Kanban Board
- Three columns with task counts in headers
- Rich task cards with: title, description, priority (low/medium/high with color dots), due date, and category tags
- Drag-and-drop between columns using a drag library
- Card hover effects (subtle lift + shadow deepening)
- Add/edit/delete tasks via card actions or context menu
- Cool zinc/slate color palette per the design brief — no bright column colors

### AI Agent Sidebar
- Persistent right-side chat panel (togglable)
- Powered by Lovable AI (Gemini) via edge function
- Full agent capabilities:
  - **Read**: "What tasks are overdue?" / "Summarize my board"
  - **Write**: "Create a task called Research API with high priority" / "Move all high-priority tasks to In Progress"
  - **Organize**: "What should I focus on next?" / "Prioritize my To Do list"
- AI can parse commands and execute board mutations
- Streaming responses with markdown rendering
- Cmd+K shortcut to focus AI input

### Database (Lovable Cloud / Supabase)
- `tasks` table: id, title, description, status (todo/in_progress/completed), priority, due_date, category, position, created_at, updated_at
- `chat_messages` table: id, role, content, created_at (for AI conversation history)
- No auth — single user, all data persisted

### Design Direction
- Linear/Vercel-inspired: dense, clean, geometric (4px/8px radii)
- Zinc/slate neutral palette with blue accent only for AI states and focus rings
- Cards float with multi-layer shadows, no hard borders between columns
- Smooth transitions for drag, hover, and AI interactions
- Dark mode support

### Edge Functions
- `chat` function: Handles AI conversation with board context, tool-calling for task mutations
- AI receives current board state as context to answer questions and execute actions

