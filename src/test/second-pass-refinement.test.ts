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
});

describe('SECOND_PASS_ISSUES constant definition', () => {
    it('contains reducers, shoe_rail, and side_mount issues', () => {
        const ids = SECOND_PASS_ISSUES.map(i => i.id);
        expect(ids).toContain('reducers');
        expect(ids).toContain('shoe_rail');
        expect(ids).toContain('side_mount');
    });
});
