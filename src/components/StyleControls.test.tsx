import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import StyleControls from './StyleControls'

describe('StyleControls', () => {
    const mockProps = {
        styleSource: 'preset' as const,
        setStyleSource: vi.fn(),
        styles: [
            { id: '1', name: 'Industrial', image_url: '/industrial.png' },
            { id: '2', name: 'Modern', image_url: '/modern.png' }
        ],
        selectedStyleIndex: 0,
        setSelectedStyleIndex: vi.fn(),
        customStyleFile: null,
        setCustomStyleFile: vi.fn(),
        error: null
    }

    it('renders preset styles correctly', () => {
        render(<StyleControls {...mockProps} />)
        expect(screen.getByText('Industrial')).toBeInTheDocument()
        expect(screen.getByText('Modern')).toBeInTheDocument()
    })

    it('switches to upload mode when clicked', () => {
        render(<StyleControls {...mockProps} />)
        const uploadTab = screen.getByText(/Custom Ref/i)
        fireEvent.click(uploadTab)
        expect(mockProps.setStyleSource).toHaveBeenCalledWith('upload')
    })
})
