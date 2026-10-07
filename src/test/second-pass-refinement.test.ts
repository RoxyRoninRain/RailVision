import { describe, it, expect, vi, beforeEach } from 'vitest';
import { assembleRefinementPrompt } from '@/lib/vertex';
import { SECOND_PASS_ISSUES } from '@/app/actions/types';

describe('Second-Pass Refinement Prompt Assembly', () => {
    it('returns empty string when no targets or custom prompt are provided', () => {
        expect(assembleRefinementPrompt({ targets: [] })).toBe('');
        expect(assembleRefinementPrompt({})).toBe('');
    });

    it('assembles base preservation prompt with reducers issue', () => {
        const prompt = assembleRefinementPrompt({ targets: ['reducers'] });
        expect(prompt).toContain('Perform a targeted micro-refinement on this railing photograph');
        expect(prompt).toContain('Preserve the room, walls, stair treads, background, lighting');
        expect(prompt).toContain('POST-TO-RAIL FLUSH WELDS');
        expect(prompt).toContain('Remove any standoff pins, stems, or adapter collars');
        expect(prompt).toContain('solid flush weld');
    });

    it('assembles multiple issue targets correctly', () => {
        const prompt = assembleRefinementPrompt({ targets: ['reducers', 'shoe_rail'] });
        expect(prompt).toContain('POST-TO-RAIL FLUSH WELDS');
        expect(prompt).toContain('BOTTOM SHOE RAIL INTEGRITY');
        expect(prompt).toContain('Ensure all vertical spindles/infill terminate cleanly');
    });

    it('appends custom refinement prompt when provided', () => {
        const prompt = assembleRefinementPrompt({
            targets: ['reducers'],
            custom_prompt: 'Ensure all post tops are level with the top tread'
        });
        expect(prompt).toContain('POST-TO-RAIL FLUSH WELDS');
        expect(prompt).toContain('CUSTOM REFINEMENT: Ensure all post tops are level with the top tread');
    });

    it('assembles side_mount issue target correctly', () => {
        const prompt = assembleRefinementPrompt({ targets: ['side_mount'] });
        expect(prompt).toContain('DIRECT 2-BOLT SIDE MOUNT (STRICTLY NO PLATES)');
        expect(prompt).toContain('Ensure every side-mount post attaches directly flat against the outer stair stringer');
        expect(prompt).toContain('2 through-bolts (vertically stacked)');
    });

    it('assembles top_mount issue target correctly', () => {
        const prompt = assembleRefinementPrompt({ targets: ['top_mount'] });
        expect(prompt).toContain('TOP / SURFACE MOUNT BASE PLATES');
        expect(prompt).toContain('anchored solidly onto the top horizontal surface of the stair treads');
    });

    it('auto-reinforces post_mount in refinement prompt when passed in config', () => {
        const sidePrompt = assembleRefinementPrompt({ post_mount: 'side' });
        expect(sidePrompt).toContain('DIRECT 2-BOLT SIDE MOUNT (STRICTLY NO PLATES)');

        const topPrompt = assembleRefinementPrompt({ post_mount: 'top' });
        expect(topPrompt).toContain('TOP / SURFACE MOUNT BASE PLATES');
    });
});

describe('SECOND_PASS_ISSUES constant definition', () => {
    it('contains reducers, shoe_rail, side_mount, and top_mount issues', () => {
        const ids = SECOND_PASS_ISSUES.map(i => i.id);
        expect(ids).toContain('reducers');
        expect(ids).toContain('shoe_rail');
        expect(ids).toContain('side_mount');
        expect(ids).toContain('top_mount');
    });
});
