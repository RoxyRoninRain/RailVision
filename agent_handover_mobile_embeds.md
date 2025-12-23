# Agent Handover: Mobile Embed Optimization

## Context
This application (Railify) includes a **Design Studio** (`DesignStudio.tsx`) that tenants embed on their own websites via an `iframe`.
We have identified a UI issue on **mobile devices**:
- When the 3-step visualization process is complete (Step 3: Result), the action buttons ("Back", "Restart", "Share", "Save") are displayed below the generated image.
- On small screens (especially within an iframe), these buttons overflow vertically or are cut off because the row is too wide.

## Objective
**Optimize the "Action Bar" in the Design Studio for mobile/embedded views.**

## Specific Tasks
### 1. Optimize DesignStudio Action Buttons
**Target File**: `src/components/design-studio/DesignStudio.tsx`
**Location**: Step 3 Render Logic (approx line 778).

**Requirements**:
- The buttons ("Back", "Restart", "Share", "Save") currently have text labels and padding that take up too much horizontal space.
- **On Mobile (small screens)**:
    - Hide the text labels. Show **ICONS ONLY**.
    - Reduce padding to make them compact.
    - Ensure they fit in a single row without wrapping or overflowing.
- **On Desktop/Larger Screens**:
    - Keep the current text labels ("Back", "Restart", "Share", "Save").

**Implementation Suggestion**:
- Use Tailwind responsive classes (e.g., `hidden md:inline` for text spans).
- Ensure the button container uses `flex-wrap` or `justify-center` effectively if space permits, but strictly prevent overflow.

## Future Considerations
- If space is still tight, consider combining "Share" and "Save" into a standardized "Export" menu, but for now, simple icon-only buttons should suffice.

## Reference Code
Current Button Structure:
```tsx
<button ... className="... flex items-center gap-2 ...">
   <Icon className="w-4 h-4" /> 
   <span>Label</span> {/* Needs to be hidden on mobile */}
</button>
```
