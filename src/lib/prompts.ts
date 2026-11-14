import {
    FabricationCategory,
    FabricationSpec,
    SceneRouterAnalysis,
    SECOND_PASS_ISSUES,
    StyleSlotDefinition,
    StyleSlotId,
    STYLE_PHOTO_SLOTS,
} from '@/app/actions/types';

/**
 * Modular Prompt Engineering Registry for Railify (Nov 2026 Architecture)
 *
 * Centralizes all 6 pipeline prompts so model logic, Style Setup Wizard,
 * Scene Routing, Agentic Vision QA, and Admin Prompt Calibration share one
 * version-controlled source of truth.
 */

export const DEFAULT_SYNTHESIS_SYSTEM_INSTRUCTION = `**ROLE:** Architectural Handrail & Guardrail Visualization Expert (Photorealistic Renovation Simulator).

**PRIMARY OBJECTIVE:**
Generate ONE high-resolution architectural photograph showing the user's Target Staircase/Location (**IMAGE A**) retrofitted with the EXACT handrail system shown in the Style Reference Photos (**IMAGE B**, **IMAGE C**, and any **SLOT 2–7** close-ups) and any structured Fabrication Specification.

**NON-NEGOTIABLE EXECUTION RULES:**
1. **BACKGROUND & PERSPECTIVE LOCK:** Preserve the camera lens, angle, staircase treads, nosings, risers, stringers, walls, flooring, lighting, shadows, and surroundings of **IMAGE A** unchanged—EXCEPT for deleting any pre-existing old railing/balusters/posts/brackets and healing the underlying tread/wall surfaces.
2. **COMPLETE DEMOLITION (NO GHOSTING):** If **IMAGE A** contains an existing wood, iron, aluminum, or plastic railing, remove 100% of its handrail, posts, newels, balusters, caps, and wall brackets before installing the new railing. Never fuse new metal onto old wood posts or leave cut spindle stubs floating on treads.
3. **100% HARDWARE & PROFILE FIDELITY:** Replicate the reference style's exact material, color/sheen, top rail cross-section, infill geometry, bottom termination (shoe rail vs direct tread embed), end/wall returns, post-to-top-rail joint (direct weld vs stem reducer), and stair mounting hardware (side fascia 2-bolt vs top tread base flange vs wall bracket) while completely ignoring the reference photos' own stairs/backgrounds.
4. **MUTUALLY EXCLUSIVE BOTTOM TERMINATION — NEVER MIX SHOE RAIL & TREAD-MOUNT PICKETS:** Every railing uses EITHER (A) a continuous bottom shoe rail acting as a solid barrier where 100% of vertical infill pickets, spindles, and scrolls stop cleanly on the top face of the bottom shoe rail and NEVER pass through or extend beneath it onto the stair treads (ONLY main structural posts anchor to the steps/stringer, leaving clean open air under the shoe rail), OR (B) direct-to-tread pickets anchoring cleanly into bare treads with ZERO bottom rail—never both at the same time.
5. **PHYSICAL ENGINEERING REALISM:** Cast crisp ambient occlusion shadows onto treads and fascia bolts, align raked rails consistently parallel to the stair pitch line (standard ~34–38" code height), keep balusters plumb/vertical or infill parallel per style, and never occlude metal inside foreground plants improperly.
6. **OUTPUT ONLY THE FINAL EDITED PHOTOGRAPH.**`;

export interface PromptStageMeta {
    id: string;
    stageNumber: number;
    name: string;
    modelId: string;
    purpose: string;
    keyGuarantees: string[];
}

export const PROMPT_STAGE_DEFINITIONS: readonly PromptStageMeta[] = [
    {
        id: 'style_photo_validator',
        stageNumber: 1,
        name: 'Wizard Slot Photo Validator',
        modelId: 'gemini-3.8-flash',
        purpose: 'Checks each uploaded style photo during Style Setup (Slots 1–7) for blur, crop, framing, and slot relevance.',
        keyGuarantees: [
            'Verifies close-ups are truly close enough to inspect welds/bolts',
            'Rejects screenshots, extreme blur, or mismatched slots with actionable coaching',
        ],
    },
    {
        id: 'fab_spec_extractor',
        stageNumber: 2,
        name: 'Fabrication Spec Extractor & Conflict Auditor',
        modelId: 'gemini-3.8-flash',
        purpose: 'Extracts a structured FabricationSpec JSON across all uploaded labeled style photos and flags hardware contradictions.',
        keyGuarantees: [
            'Identifies material, finish, rail/post profiles, mount bolts, weld vs reducer joint, bottom rail, and end return',
            'Detects cross-photo conflicts (e.g., side mount in Hero vs top flange in Close-Up)',
        ],
    },
    {
        id: 'canonical_specimen',
        stageNumber: 3,
        name: 'Canonical Studio Specimen Generator (Optional)',
        modelId: 'gemini-nano-banana-2.1',
        purpose: 'Synthesizes an optional distractor-free #F4F5F7 studio specimen sheet from cluttered field photos.',
        keyGuarantees: [
            'Removes distracting homeowner stairs/decks from reference thumbnails',
            'Only replaces Image B at render time when explicitly approved by shop/admin',
        ],
    },
    {
        id: 'scene_router',
        stageNumber: 4,
        name: 'Scene Router & Geometry Inspector',
        modelId: 'gemini-3.8-flash',
        purpose: 'Analyzes customer staircase photo (Image A) for demolition needs, mounting surface, rake angle, and occlusions.',
        keyGuarantees: [
            'Detects old railings requiring full demolition + clean-plate caching',
            'Identifies exact stair stringer fascia vs tread surface vs drywall wall anchors',
        ],
    },
    {
        id: 'primary_synthesis',
        stageNumber: 5,
        name: 'Nano Banana 2.1 Railing Synthesis (2K + Medium Thinking)',
        modelId: 'gemini-nano-banana-2.1',
        purpose: 'Main architectural image edit replacing the railing onto Clean-Plated Image A using labeled Slots 1–7 + Fab Spec.',
        keyGuarantees: [
            'Outputs 2K photorealistic imagery with exact aspect-ratio lock & Pixel-Lock background compositing',
            'Preserves thoughtSignature for stateful multi-turn refinement when QA triggers Pass 2',
        ],
    },
    {
        id: 'vision_qa_refiner',
        stageNumber: 6,
        name: 'Agentic Vision QA & Conditional Multi-Turn Refiner',
        modelId: 'gemini-3.8-flash + gemini-nano-banana-2.1',
        purpose: 'Zooms in with codeExecution on Pass 1 output to catch hardware defects and triggers stateful Pass 2 automatically when needed.',
        keyGuarantees: [
            'Hidden from homeowners & tenants—runs seamlessly whenever QA flags a defect',
            'Passes thoughtSignature + original clean plate + exact Slot 2–5 close-ups for surgical repair',
        ],
    },
];

export function buildPhotoValidatorPrompt(
    slotDef: StyleSlotDefinition,
    category: FabricationCategory = 'stair_railing'
): string {
    const isWall = category === 'wall_handrail';
    const title = isWall && slotDef.wallHandrailTitle ? slotDef.wallHandrailTitle : slotDef.title;
    const rule =
        isWall && slotDef.wallHandrailShortInstruction
            ? `${slotDef.wallHandrailShortInstruction} (${slotDef.aiValidationRule})`
            : `${slotDef.shortInstruction} (${slotDef.aiValidationRule})`;

    return `You are a senior architectural railing fabrication inspector reviewing a single uploaded reference photograph for a style library setup wizard.

TARGET SLOT #${slotDef.slotNumber}: "${title}"
SYSTEM CATEGORY: "${category}"
SLOT REQUIREMENT: ${rule}

Evaluate this photo strictly and return valid JSON with exact keys:
{
  "valid": boolean,
  "qualityScore": number, // 0 to 100
  "slotMatch": boolean, // true if photo genuinely shows the requested slot subject
  "feedback": string, // 1 concise sentence explaining why it passed or what must be fixed
  "suggestions": string[] // up to 2 short coaching tips if anything can be improved
}

Rejection criteria (set valid: false):
- Severe motion blur, pixelation, watermark overlay, or UI screenshot bars
- Close-up slot (Slots 2, 3, 4, or 5) shot too far away (>5 ft) where joints/bolts/terminations cannot be visually inspected
- Completely wrong subject (e.g., uploading a garage floor or random stair without the requested hardware detail)
Set valid: true if the subject is recognizable and clear enough for visual replication.`;
}

export function buildFabSpecExtractorPrompt(
    slotDescriptions: { slotId: StyleSlotId; index: number }[],
    category: FabricationCategory = 'stair_railing',
    hints?: { name?: string; description?: string; postMount?: string | null; hasReducers?: boolean | null; hasBottomRail?: boolean | null }
): string {
    const slotList = slotDescriptions
        .map((s) => {
            const def = STYLE_PHOTO_SLOTS.find((d) => d.id === s.slotId);
            return `- Photo #${s.index + 1}: SLOT ${def?.slotNumber || '?'} (${def?.title || s.slotId})`;
        })
        .join('\n');

    return `You are an expert custom architectural stair & handrail fabricator inspecting a contractor's uploaded reference photo pack.

ATTACHED REFERENCE PHOTOS IN ORDER:
${slotList}

SHOP HINTS (treat photos as authoritative if they contradict hints, and note any conflict):
- Style Name: "${hints?.name || 'Custom Railing'}"
- Shop Description: "${hints?.description || 'None provided'}"
- Category Selection: "${category}"
- Legacy Flags (if any): postMount=${hints?.postMount ?? 'unspecified'}, hasReducers=${hints?.hasReducers ?? 'unspecified'}, hasBottomRail=${hints?.hasBottomRail ?? 'unspecified'}

Inspect EVERY attached photo carefully—especially close-up slots for post-to-top-rail welds/reducers, stair mount hardware, infill spacing, bottom termination (shoe rail vs direct tread), and end returns.

Return STRICT JSON matching this exact schema:
{
  "category": "stair_railing" | "wall_handrail" | "guardrail" | "hybrid",
  "material": string,
  "finish": string,
  "top_rail_profile": string,
  "post_profile": string,
  "post_mount_type": "top" | "side" | "wall" | "mixed",
  "bolt_pattern": string,
  "post_to_rail_joint": "direct_flush_weld" | "stem_reducer" | "bracket_saddle" | "wall_bracket",
  "infill_type": "vertical_pickets" | "horizontal_bars" | "horizontal_cable" | "tempered_glass" | "mesh_panel" | "custom_scroll" | "none_wall_only",
  "infill_profile_and_spacing": string,
  "has_bottom_rail": boolean,
  "bottom_termination": string,
  "handrail_return": string,
  "distinctive_features": string[],
  "conflicts_detected": string[],
  "confidence_notes": string
}

Be hyper-specific with real fabrication terminology (e.g., "1.5\\" x 0.75\\" molded iron cap rail", "2 vertically stacked hex lag bolts direct through post without plate", "3/8\\" solid round bar infill @ 4\\" OC"). If two photos disagree on mount type, color, or bottom rail, explain the disagreement clearly inside "conflicts_detected".`;
}

export function buildCanonicalSpecimenPrompt(fabSpec: FabricationSpec): string {
    return `Create a crystal-clear studio Architectural Fabrication Specimen Sheet of the EXACT railing design shown in the attached reference photographs.

TARGET SPECIMEN TO RENDER:
- Category: ${fabSpec.category}
- Material & Finish: ${fabSpec.material} in ${fabSpec.finish}
- Top Rail Profile: ${fabSpec.top_rail_profile}
- Post Profile & Mount: ${fabSpec.post_profile} (${fabSpec.post_mount_type} mount — ${fabSpec.bolt_pattern})
- Post-to-Rail Joint: ${fabSpec.post_to_rail_joint}
- Infill: ${fabSpec.infill_type} (${fabSpec.infill_profile_and_spacing})
- Bottom Termination: ${fabSpec.has_bottom_rail ? `With Bottom Shoe Rail: ${fabSpec.bottom_termination}` : `No Bottom Rail (Direct Mount): ${fabSpec.bottom_termination}`}
- End Return: ${fabSpec.handrail_return}

STAGING REQUIREMENTS:
- Isolate ONE complete 4-step inclined staircase section + short level landing turn mounted on a minimalist clean white-to-#F4F5F7 architectural display pedestal block.
- Pure neutral studio seamless backdrop (#F4F5F7), zero house walls, zero backyard foliage, zero furniture, zero text labels or dimension arrows.
- Keep lighting soft and diffused so black powder coat, brushed grain, welds, fasteners, and end caps remain tack-sharp.`;
}

export function buildSceneRouterPrompt(): string {
    return `You are a structural site-survey computer-vision analyzer inspecting a customer's staircase or porch photo (IMAGE A) before an architectural handrail retrofit render.

Inspect IMAGE A carefully and return STRICT JSON matching this schema:
{
  "scene_category": "interior_stairs" | "exterior_deck_porch" | "concrete_steps" | "balcony_loft" | "commercial_ramp",
  "stair_geometry": string, // Describe step count, L-turns, landings, openness of stringers/fascia, and open vs walled edges
  "preferred_rake_direction": "left_to_right_ascending" | "right_to_left_ascending" | "flat_run" | "mixed",
  "existing_railing_present": boolean,
  "existing_railing_description": string, // Detail old wood posts, spindles, cables, wall rails, or brackets to demolish (empty if none)
  "demolition_required": boolean,
  "mounting_surface": "wood_fascia_stringer" | "wood_treads" | "carpeted_treads" | "concrete_masonry" | "metal_stringer" | "drywall_wall",
  "recommended_mount_note": string, // Explain where posts or wall brackets physically anchor in this photo
  "lighting_direction": string, // Warm indoor tungsten, crisp outdoor sunlight angle, cool overcast, etc.
  "camera_elevation": string, // Eye-level straight on, low 3/4 view looking up, etc.
  "occlusions_to_preserve": string[], // Plants, furniture, front columns, pendant lights in foreground
  "structural_anchors": string[] // Bottom nosing, stringer apron, upper corner newel location, landing fascia
}`;
}

export function buildCleanPlateDemolitionPrompt(sceneAnalysis?: SceneRouterAnalysis | null): string {
    const existingDesc =
        sceneAnalysis?.existing_railing_description ||
        'any existing handrail, newel posts, vertical balusters/spindles, mounting brackets, and top rail';

    return `ARCHITECTURAL PRE-RENOVATION DEMOLITION PASS (CLEAN PLATE):
Inspect the target photograph (**IMAGE A**). Remove 100% of the existing railing system (${existingDesc}) cleanly from the staircase, deck, landing, and walls.

CRITICAL RULES:
1. Restore clean, continuous, natural bare textures where posts, base plates, balusters, and wall brackets used to be: reconstruct untouched stair treads, wood nosings, carpet weave, painted stringers, siding, or drywall seamlessly.
2. Do NOT install any new railing yet. Leave the open edges, treads, and stringer fascia completely bare and ready for new fabrication installation.
3. Keep 100% of the lighting, shadows, walls, steps, camera framing, foreground objects, and background architecture identical pixel-for-pixel.`;
}

export interface RailingSynthesisPromptInput {
    styleDescription: string;
    specs: {
        hasBottomRail?: boolean;
        postMount?: 'top' | 'side' | null;
        hasReducers?: boolean | null;
        customPrompt?: string;
        fabricationSpec?: FabricationSpec | null;
    };
    sceneAnalysis?: SceneRouterAnalysis | null;
    hasCleanPlate?: boolean;
    hasDetailPhotos?: boolean;
    customMasterTemplate?: string | null;
}

/**
 * Builds the primary Nano Banana 2.1 systemInstruction and synthesis user prompt.
 * Guarantees exact compatibility with all legacy prompt test invariants while
 * removing square-post bias, fixing `{{image}}`/`{{style}}` substitution, and
 * injecting structured FabricationSpec & SceneRouter guidance when present.
 */
export function buildRailingSynthesisPrompts(input: RailingSynthesisPromptInput): {
    systemInstruction: string;
    promptText: string;
} {
    const {
        styleDescription,
        specs,
        sceneAnalysis,
        hasCleanPlate,
        hasDetailPhotos,
        customMasterTemplate,
    } = input;

    const effectiveHasBottomRail = specs.hasBottomRail ?? specs.fabricationSpec?.has_bottom_rail;
    const effectivePostMount: 'top' | 'side' | null | undefined =
        specs.postMount ??
        (specs.fabricationSpec?.post_mount_type === 'side' || specs.fabricationSpec?.post_mount_type === 'top'
            ? specs.fabricationSpec.post_mount_type
            : null);
    const effectiveHasReducers: boolean | null | undefined =
        specs.hasReducers ??
        (specs.fabricationSpec?.post_to_rail_joint === 'stem_reducer'
            ? true
            : specs.fabricationSpec?.post_to_rail_joint === 'direct_flush_weld'
              ? false
              : null);

    let bottomRailRule = '';
    if (effectiveHasBottomRail === false) {
        bottomRailRule = `**CRITICAL: NO BOTTOM RAIL / DIRECT TREAD MOUNT:** This design MUST NOT have a bottom horizontal shoe rail or bar along the stairs. All vertical spindles/balusters MUST extend straight down and anchor directly into the individual stair treads and landing floor.`;
    } else if (effectiveHasBottomRail === true) {
        bottomRailRule = `**BOTTOM SHOE RAIL REQUIRED (SOLID BARRIER — NO PICKET PASS-THROUGH):** Include a continuous bottom horizontal shoe rail/channel connecting the bottom of all infill spindles cleanly (parallel to the handrail slope) above the stair nosings. **100% of vertical spindles, pickets, and decorative scrolls MUST terminate cleanly at the top surface of this bottom shoe rail and NEVER pass through, poke beneath, or extend down onto the stair treads.** ONLY the main structural posts reach down to anchor to the steps or fascia, leaving clean open air beneath the bottom shoe rail.`;
    } else {
        bottomRailRule = `**BOTTOM TERMINATION FORENSIC LOCK (MUTUALLY EXCLUSIVE — NEVER MIX SHOE RAIL & TREAD PICKETS):** Inspect the bottom of the infill in **IMAGE B** before rendering: (A) If **IMAGE B** has a continuous bottom horizontal shoe rail, treat that bottom rail as a solid barrier—stop 100% of vertical pickets/scrolls cleanly on the top face of the bottom rail and NEVER extend infill pickets below it onto the steps (ONLY structural posts touch the stairs, leaving open air under the bottom rail). (B) If **IMAGE B** has NO bottom rail, omit the bottom rail completely and anchor each picket directly into the stair treads. NEVER render both a bottom shoe rail and direct-mount pickets at the same time.`;
    }

    let postMountInstructionStep = '';
    if (effectivePostMount === 'side') {
        postMountInstructionStep = `1b. **POST MOUNTING (SIDE / FASCIA MOUNT - DIRECT 2-BOLT ATTACHMENT, NO PLATES):**
- The user requires **Side Mount (Fascia Mount)** posts.
- Inspect **IMAGE C** closely for the exact post-to-stringer mounting detail.
- **DIRECT 2-BOLT FASTENING:** Every post (bottom newel, intermediate stair posts, and landing posts) must mount directly flat against the outer side face / exterior stringer / side fascia of the staircase using **2 through-bolts (vertically stacked)** passing directly through the post body into the wood stringer or deck rim joist.
- **STRICTLY NO MOUNTING PLATES OR BRACKETS:** Do NOT generate mounting plates, bracket collars, standoff saddles, or external mounting tabs. The post tube/bar must sit directly flat against the stringer face with only the 2 bolt heads visible, exactly as shown in **IMAGE C**.
- Posts must extend downward along the outside edge of the stairs; do NOT mount post bases onto the top horizontal surface of the stair treads. Keep the tread walking surface completely open and clear of post bases.`;
    } else if (effectivePostMount === 'top') {
        postMountInstructionStep = `1b. **POST MOUNTING (TOP / SURFACE MOUNT REQUIRED):**
- The user requires **Top Mount (Surface Mount)** posts.
- Every post base must mount directly onto the top horizontal surface of the stair treads or landing floor using surface-mounted base plates / flange shoes anchored vertically down into the tread/deck floor.
- Posts must stand upright directly on top of the steps or landing flooring, NOT attached to the exterior side fascia or outer stringer edge.`;
    } else if (specs.fabricationSpec?.post_mount_type === 'wall') {
        postMountInstructionStep = `1b. **WALL-MOUNTED HANDRAIL BRACKETS:**
- This is a wall-mounted handrail without stair posts. Mount the handrail along the wall at ergonomic rake height using stand-off wall brackets & escutcheon rosettes matching **${specs.fabricationSpec.bolt_pattern}** and end with **${specs.fabricationSpec.handrail_return}**.`;
    }

    let reducerInstructionStep = '';
    if (effectiveHasReducers !== undefined && effectiveHasReducers !== null) {
        if (effectiveHasReducers === true) {
            reducerInstructionStep = `1c. **POST-TO-RAIL JUNCTION (REDUCER FITTINGS REQUIRED):**
- The style requires reducer fittings: Pay extra close attention to the post-to-rail connection point in both **IMAGE B** and **IMAGE C**.
- Posts connect to the top rail using post-top stem reducers / transition collars at the top of each post.`;
        } else {
            reducerInstructionStep = `1c. **POST-TO-RAIL JOINT (DIRECT SEAMLESS WELD):**
- Exactly match the seamless joint shown in **IMAGE B** and **IMAGE C**.
- Every structural post (including the bottom newel post, intermediate stair posts, and landing posts) is a single continuous tube that reaches all the way to touch the underside of the top handrail.
- The top of each post meets the handrail directly with the handrail resting directly on top of each post. Direct solid metal-to-metal fusion throughout.
- There is zero space, zero gap, and zero connecting pin between the post and the handrail; the two pieces of metal are welded directly together into a single continuous solid joint.`;
        }
    }

    const fab = specs.fabricationSpec;
    const fabSpecBlock = fab
        ? `\n### STRUCTURED FABRICATION BLUEPRINT (MANDATORY HARDWARE CONSTRAINTS):\n` +
          `- **Category:** ${fab.category}\n` +
          `- **Material & Finish:** ${fab.material} — ${fab.finish}\n` +
          `- **Top Rail Profile:** ${fab.top_rail_profile}\n` +
          `- **Post Profile:** ${fab.post_profile}\n` +
          `- **Mount Hardware:** ${fab.post_mount_type} (${fab.bolt_pattern})\n` +
          `- **Post-to-Rail Joint:** ${fab.post_to_rail_joint}\n` +
          `- **Infill System:** ${fab.infill_type} (${fab.infill_profile_and_spacing})\n` +
          `- **Bottom Termination:** ${fab.has_bottom_rail ? fab.bottom_termination : 'Direct tread/floor mount (NO bottom shoe rail)'}\n` +
          `- **End Return / Cap:** ${fab.handrail_return}\n` +
          (fab.distinctive_features?.length
              ? `- **Distinctive Signature Details:** ${fab.distinctive_features.join('; ')}\n`
              : '')
        : '';

    const sceneBlock = sceneAnalysis
        ? `\n### TARGET SCENE GEOMETRY & LIGHTING BRIEF (FROM SITE SURVEY):\n` +
          `- **Scene Type:** ${sceneAnalysis.scene_category} (${sceneAnalysis.stair_geometry})\n` +
          `- **Rake Slope & Direction:** ${sceneAnalysis.preferred_rake_direction}\n` +
          `- **Mounting Substrate:** ${sceneAnalysis.mounting_surface} (${sceneAnalysis.recommended_mount_note})\n` +
          `- **Lighting & Shadows:** ${sceneAnalysis.lighting_direction}\n` +
          (sceneAnalysis.occlusions_to_preserve?.length
              ? `- **Foreground Elements to Preserve:** ${sceneAnalysis.occlusions_to_preserve.join(', ')}\n`
              : '') +
          (hasCleanPlate
              ? `- **Pre-Renovation Clean Plate:** Existing old railing has been cleared on **IMAGE A**; mount cleanly onto the exposed treads/stringers.\n`
              : sceneAnalysis.demolition_required
              ? `- **Demolition Alert:** Remove existing "${sceneAnalysis.existing_railing_description}" completely before installing.\n`
              : '')
        : '';

    const defaultPromptText = `Perform a seamless architectural renovation on the Target Staircase (**IMAGE A**):

### PHASE 1: DEMOLITION
* Inspect **IMAGE A**. If there is an existing handrail, spindle, post, wall bracket, or banister anywhere on the staircase or landing, COMPLETELY REMOVE it.
* Inpaint and restore the underlying stair treads, risers, walls, stringers, and deck surfaces cleanly so it looks like a bare, open staircase before new fabrication.
* **CRITICAL:** Leave no remnant ghost posts, old base plates, or stub shadows from the original railing.

### PHASE 2: DESIGN REPLICATION FROM REFERENCE PACK
* Install a brand new custom railing matching **IMAGE B** (Hero Style Reference)${hasDetailPhotos ? ', **IMAGE C** & attached **CLOSE-UP HARDWARE SLOTS**' : ' and any **IMAGE C** hardware details'} onto the bare staircase of **IMAGE A**.
* Replicate ALL visual traits: material, texture, sheen, color finish, top rail cap profile, infill pattern, post spacing, joint construction, and end return—while 100% ignoring the reference images' own stairs or backgrounds.
${bottomRailRule}
${postMountInstructionStep ? `\n${postMountInstructionStep}` : ''}
${reducerInstructionStep ? `\n${reducerInstructionStep}` : ''}
${fabSpecBlock}${sceneBlock}
${specs.customPrompt ? `\n* **ARCHITECTURAL CONTEXT / USER NOTES:** "${specs.customPrompt}"` : ''}

### PHASE 3: STRUCTURAL INTEGRATION & PHOTOREALISM
* Align rails evenly parallel with the stair pitch line (~34–38" code height), keep vertical posts and spindles plumb, and match the perspective focal length and lighting shadows of **IMAGE A** seamlessly.
* Return ONE crisp photorealistic architectural photograph.`;

    const trimmedTemplate = customMasterTemplate?.trim() || '';
    const isMinimalStub = trimmedTemplate.length > 0 && trimmedTemplate.length < 180;

    let promptText = defaultPromptText;
    if (trimmedTemplate && !isMinimalStub) {
        promptText = trimmedTemplate;

        if (promptText.includes('{{style}}')) {
            promptText = promptText.replaceAll('{{style}}', styleDescription);
        } else {
            promptText += `\n\nTarget Style Description: "${styleDescription}"`;
        }

        if (promptText.includes('{{image}}')) {
            promptText = promptText.replaceAll(
                '{{image}}',
                'IMAGE A (the attached Target Staircase photo)'
            );
        }

        const usedMountingPlaceholder = promptText.includes('{{mounting_logic}}');
        if (usedMountingPlaceholder) {
            promptText = promptText.replaceAll(
                '{{mounting_logic}}',
                [bottomRailRule, postMountInstructionStep].filter(Boolean).join('\n\n')
            );
        }

        const usedReducersPlaceholder = promptText.includes('{{reducers_logic}}');
        if (usedReducersPlaceholder) {
            promptText = promptText.replaceAll('{{reducers_logic}}', reducerInstructionStep);
        }

        if (!usedMountingPlaceholder && bottomRailRule) {
            promptText += `\n\n### BOTTOM RAIL MANDATE:\n${bottomRailRule}`;
        }
        if (!usedMountingPlaceholder && postMountInstructionStep) {
            promptText += `\n\n${postMountInstructionStep}`;
        }
        if (!usedReducersPlaceholder && reducerInstructionStep) {
            promptText += `\n\n${reducerInstructionStep}`;
        }
        if (fabSpecBlock) {
            promptText += `\n${fabSpecBlock}`;
        }
        if (sceneBlock) {
            promptText += `\n${sceneBlock}`;
        }
        if (specs.customPrompt) {
            promptText += `\n\nUser Custom Request: "${specs.customPrompt}"`;
        }
    } else if (trimmedTemplate && isMinimalStub) {
        // Admin stored a short style/note override rather than a full Phase 1-3 template:
        // keep the structured phases intact and inject the style description + short override cleanly.
        promptText = `Target Style Description: "${styleDescription}"\nAdmin Custom Guidance: "${trimmedTemplate}"\n\n${defaultPromptText}`;
    } else {
        promptText = `Target Style Description: "${styleDescription}"\n\n${defaultPromptText}`;
    }

    return {
        systemInstruction: DEFAULT_SYNTHESIS_SYSTEM_INSTRUCTION,
        promptText,
    };
}

export function buildVisionQaPrompt(
    specs: {
        hasBottomRail?: boolean;
        postMount?: 'top' | 'side' | null;
        hasReducers?: boolean | null;
        fabricationSpec?: FabricationSpec | null;
    },
    availableDetailSlotIds: string[] = []
): string {
    const validTargets = SECOND_PASS_ISSUES.map((i) => i.id).join(', ');
    const effectiveHasBottomRail = specs.hasBottomRail ?? specs.fabricationSpec?.has_bottom_rail;
    const effectivePostMount = specs.postMount ?? specs.fabricationSpec?.post_mount_type;
    const effectiveHasReducers =
        specs.hasReducers ??
        (specs.fabricationSpec?.post_to_rail_joint === 'stem_reducer'
            ? true
            : specs.fabricationSpec?.post_to_rail_joint === 'direct_flush_weld'
              ? false
              : undefined);
    const fabSummary = specs.fabricationSpec
        ? JSON.stringify(specs.fabricationSpec, null, 2)
        : 'None provided — rely on Style Reference photos.';

    return `You are an autonomous Architectural Railing QA Inspector. Use your Python code-execution image-cropping ability (if needed) to zoom into post-to-top-rail joints, stair stringer mounts, bottom tread interfaces, and end returns in the RENDERED DESIGN (the final attached image) and compare them rigorously against:
1) ORIGINAL / CLEAN TARGET STAIRCASE (first attached image) — background, lighting, walls, stair treads, nosings, plants/furniture MUST remain unchanged, and 100% of any old railing must be gone with zero ghost spindles.
2) STYLE HERO & DETAIL CLOSE-UPS (middle attached images) — metal color, profile, joint type, mount hardware, bottom termination, and infill spacing MUST match.

EXPLICIT USER / STYLE CONSTRAINTS:
- Expected Post Mount: ${effectivePostMount ?? 'match reference photos'}
- Expected Bottom Rail: ${effectiveHasBottomRail === false ? 'NO bottom rail (direct into treads)' : effectiveHasBottomRail === true ? 'Continuous bottom shoe rail required' : 'match reference photos strictly (NEVER mix bottom shoe rail with direct-to-tread pickets)'}
- Expected Post-to-Rail Joint: ${effectiveHasReducers === true ? 'Stem reducer collars required' : effectiveHasReducers === false ? 'Direct flush weld (ZERO reducer pin/gap)' : 'match reference'}
- Structured Fabrication Spec: ${fabSummary}
- Available Close-Up Targets: [${availableDetailSlotIds.join(', ')}]

Inspect systematically:
1. Are there ANY floating/ghost spindles, un-demolished old wood posts, or double railings?
2. Does post mounting match (${effectivePostMount === 'side' ? '2 vertical bolts direct flat on outer fascia, ZERO base plates' : effectivePostMount === 'top' ? 'top flange base plates on stair treads' : 'reference photos'})?
3. Does post-to-rail joint match (${effectiveHasReducers === false ? 'direct flush solid weld with zero pins/stems' : effectiveHasReducers === true ? 'clean reducer collars' : 'reference photos'})?
4. Does bottom termination match (${effectiveHasBottomRail === false ? 'direct tread mount with zero bottom rail' : effectiveHasBottomRail === true ? 'clean bottom shoe rail where 100% of pickets stop at the top of the bottom rail and ZERO pickets extend below onto steps' : 'either clean bottom shoe rail with ZERO pickets passing below it, OR direct-to-tread pickets with ZERO bottom rail—matching reference photos'})?
5. Are background pixels, stair steps, lighting, and perspective faithful to IMAGE A?

CRITICAL AUTOMATIC FAIL RULE (HYBRID BOTTOM RAIL + PICKET PASS-THROUGH): Inspect beneath any bottom horizontal shoe rail! If the rendered image shows BOTH a bottom shoe rail AND vertical infill pickets/spindles extending below that bottom rail onto the stair steps (or ghosting through it), you MUST set "passed": false and "railing_fidelity_score" <= 55. Compare against the Style Reference photo: if the Style Reference uses a bottom shoe rail, include "shoe_rail" in "suggested_targets" and instruct Pass 2 to erase all picket segments below the bottom rail so ONLY structural posts touch the steps; if the Style Reference uses direct-to-tread pickets with no bottom rail, include "direct_mount" in "suggested_targets" and instruct Pass 2 to remove the unwanted bottom shoe rail.

Return STRICT JSON only:
{
  "passed": boolean, // true ONLY if no noticeable fabrication or demolition defects remain (score >= 82)
  "confidence": number, // 0 to 100
  "defects_found": string[], // Concrete visible issues (empty if passed)
  "suggested_targets": string[], // Subset of [${validTargets}] matching detected issues
  "surgical_fix_instructions": string, // Exact visual surgical instruction for Pass 2 multi-turn repair (empty if passed)
  "background_preservation_ok": boolean,
  "railing_fidelity_score": number // 0 to 100
}`;
}
