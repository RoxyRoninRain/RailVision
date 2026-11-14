import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BeforeAfterSlider from './ui/BeforeAfterSlider';

describe('BeforeAfterSlider', () => {
    it('defaults initial position to 35% so most of the new design is immediately visible', () => {
        render(
            <BeforeAfterSlider
                beforeImage="/before.jpg"
                afterImage="/after.jpg"
            />
        );

        const slider = screen.getByRole('slider', { name: /before and after comparison slider/i });
        expect(slider).toHaveAttribute('aria-valuenow', '35');

        const beforeImg = screen.getByAltText('Original Before');
        expect(beforeImg).toHaveStyle({ clipPath: 'inset(0 65% 0 0)' });
    });

    it('shows Drag to Compare badge initially and hides it after user interaction', () => {
        render(
            <BeforeAfterSlider
                beforeImage="/before.jpg"
                afterImage="/after.jpg"
            />
        );

        expect(screen.getByText('Drag to Compare')).toBeInTheDocument();

        const slider = screen.getByRole('slider', { name: /before and after comparison slider/i });
        fireEvent.keyDown(slider, { key: 'ArrowRight' });

        expect(slider).toHaveAttribute('aria-valuenow', '39');
        expect(screen.queryByText('Drag to Compare')).not.toBeInTheDocument();
    });
});
