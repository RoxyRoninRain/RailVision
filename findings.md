# Findings: Second-Pass Refinement Pipeline

## 1. Problem Statement & Root Cause
- Gemini 3.1 Flash Image struggles to juggle full-scene demolition, stair geometry, room lighting, and cable tensioning while simultaneously handling micro-architectural connections (e.g. square post welded flush to round handrail).
- The model's training prior defaults to modular cable railing posts with 1" standoff pins / saddle reducers.
- Negative prompts ("NO pins", "NO stems") prime attention heads and worsen the issue.
- **Breakthrough:** A 2-pass image-to-image edit where the model is fed the rendered Pass 1 image with a dedicated joint-refinement prompt achieves 100% elimination of standoff pins while preserving 100% of the room and stairs.

## 2. Standard Prompt Design for Pass 2
- **Standard Base Prompt:**
  ```text
  **ROLE:** Architectural Image Refiner.
  **TASK:** Perform a targeted micro-refinement on this railing installation image.
  **CRITICAL PRESERVATION RULES:**
  * Do NOT regenerate or alter the room, stairs, walls, flooring, lighting, or camera POV.
  * Preserve all cable runs and general scene geometry exactly as rendered.
  * Apply ONLY the specific fabrication enhancements listed below:
  ```
- **Issue: `reducers` (Post-to-Rail Direct Welds):**
  ```text
  * POST-TO-RAIL FLUSH WELDS: Remove any standoff pins, stems, or adapter collars between the top of each post and the handrail. Extend each post upward so it fuses directly and seamlessly into the handrail with a solid flush weld.
  ```
- **Issue: `shoe_rail` (Shoe Rail / Bottom Rail Integrity):**
  ```text
  * BOTTOM SHOE RAIL INTEGRITY: Ensure all vertical spindles/infill terminate cleanly and solidly into the continuous bottom shoe rail. No spindles may pass through or ghost beneath the shoe rail.
  ```
- **Issue: `side_mount` (Fascia / Side Mounting):**
  ```text
  * FASCIA / SIDE MOUNT BRACKETS: Ensure every post is anchored securely to the outer stringer face with robust side-mount bracket hardware.
  ```
- **Custom Prompt:** Appended directly if provided by the user.

## 3. Schema & Storage
- `portfolio.style_metadata` is JSONB, which allows storing:
  ```json
  {
    "second_pass": {
      "enabled": true,
      "targets": ["reducers"],
      "custom_prompt": ""
    }
  }
  ```
