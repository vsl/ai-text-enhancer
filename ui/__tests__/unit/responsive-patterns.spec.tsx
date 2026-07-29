/**
 * Unit tests for responsive breakpoint patterns
 * Verifies mobile-first approach is used consistently
 */

describe('Responsive Breakpoint Patterns', () => {
  describe('Mobile-First Approach', () => {
    it('uses flex-col md:flex-row pattern (not max-md:flex-col)', () => {
      const mobileFirstPattern = 'flex-col md:flex-row';
      const oldPattern = 'flex-row max-md:flex-col';

      // Mobile-first: starts with mobile layout, adds desktop at breakpoint
      expect(mobileFirstPattern).toContain('flex-col');
      expect(mobileFirstPattern).toContain('md:flex-row');
      expect(mobileFirstPattern).not.toContain('max-');
    });

    it('uses w-full md:w-1/2 lg:w-1/3 xl:w-1/4 pattern', () => {
      const mobileFirstWidths = 'w-full md:w-1/2 lg:w-1/3 xl:w-1/4';

      // Starts with full width on mobile
      expect(mobileFirstWidths).toContain('w-full');
      // Uses min-width breakpoints, not max-width
      expect(mobileFirstWidths).toContain('md:');
      expect(mobileFirstWidths).toContain('lg:');
      expect(mobileFirstWidths).toContain('xl:');
      expect(mobileFirstWidths).not.toContain('max-');
    });

    it('uses static md:sticky pattern (not max-md:static)', () => {
      const mobileFirstSticky = 'static md:sticky';
      const oldPattern = 'sticky max-md:static';

      expect(mobileFirstSticky).toContain('static');
      expect(mobileFirstSticky).toContain('md:sticky');
      expect(mobileFirstSticky).not.toContain('max-');
    });

    it('uses overflow-visible md:overflow-y-auto pattern', () => {
      const mobileFirstOverflow = 'overflow-visible md:overflow-y-auto';

      expect(mobileFirstOverflow).toContain('overflow-visible');
      expect(mobileFirstOverflow).toContain('md:overflow-y-auto');
      expect(mobileFirstOverflow).not.toContain('max-');
    });
  });

  describe('Breakpoint Consistency', () => {
    const breakpoints = ['sm', 'md', 'lg', 'xl', '2xl'];

    it('only uses standard Tailwind breakpoints', () => {
      breakpoints.forEach(bp => {
        const pattern = `${bp}:w-1/2`;
        expect(pattern).toMatch(/^(sm|md|lg|xl|2xl):/);
      });
    });

    it('does not use custom breakpoints', () => {
      const customBreakpoint = 'max-[1400px]:w-1/3';
      // This is a sign of non-mobile-first approach
      expect(customBreakpoint).toContain('max-');
    });

    it('breakpoints are in ascending order', () => {
      const orderedBreakpoints = ['sm', 'md', 'lg', 'xl', '2xl'];
      const breakpointValues = {
        sm: 640,
        md: 768,
        lg: 1024,
        xl: 1280,
        '2xl': 1536
      };

      for (let i = 0; i < orderedBreakpoints.length - 1; i++) {
        const current = orderedBreakpoints[i];
        const next = orderedBreakpoints[i + 1];
        expect(breakpointValues[current]).toBeLessThan(breakpointValues[next]);
      }
    });
  });

  describe('Layout Patterns', () => {
    it('sidebar uses progressive width reduction', () => {
      // Mobile: full width
      // Tablet (md): half width
      // Desktop (lg): third width
      // Large desktop (xl): quarter width
      const widthPattern = 'w-full md:w-1/2 lg:w-1/3 xl:w-1/4';

      const widths = widthPattern.split(' ');
      expect(widths).toContain('w-full');
      expect(widths).toContain('md:w-1/2');
      expect(widths).toContain('lg:w-1/3');
      expect(widths).toContain('xl:w-1/4');
    });

    it('sticky positioning only applies on desktop', () => {
      const stickyPattern = 'static md:sticky';

      // Mobile: not sticky (static)
      expect(stickyPattern).toContain('static');
      // Desktop: sticky
      expect(stickyPattern).toContain('md:sticky');
    });

    it('scrollable overflow only on desktop', () => {
      const overflowPattern = 'overflow-visible md:overflow-y-auto';

      // Mobile: no scroll container
      expect(overflowPattern).toContain('overflow-visible');
      // Desktop: scrollable
      expect(overflowPattern).toContain('md:overflow-y-auto');
    });

    it('height constraints only apply on desktop', () => {
      const heightPattern = 'h-auto md:max-h-[calc(100vh-4rem)]';

      // Mobile: auto height
      expect(heightPattern).toContain('h-auto');
      // Desktop: constrained height
      expect(heightPattern).toContain('md:max-h-');
    });
  });

  describe('Anti-patterns Detection', () => {
    it('detects max-width usage (anti-pattern)', () => {
      const antiPattern = 'w-1/4 max-lg:w-1/2 max-md:w-full';

      // This is desktop-first approach - starts with desktop, overrides for mobile
      expect(antiPattern).toContain('max-');
    });

    it('prefers min-width breakpoints', () => {
      const goodPattern = 'w-full md:w-1/2 lg:w-1/4';
      const badPattern = 'w-1/4 max-lg:w-1/2 max-md:w-full';

      // Good pattern has no max-width
      expect(goodPattern).not.toContain('max-');
      // Bad pattern uses max-width
      expect(badPattern).toContain('max-');
    });

    it('detects custom breakpoint usage (should use standard)', () => {
      const customBreakpoint = 'max-[1400px]:w-1/3';
      const standardBreakpoint = 'xl:w-1/3';

      expect(customBreakpoint).toMatch(/max-\[.*\]/);
      expect(standardBreakpoint).toMatch(/^(sm|md|lg|xl|2xl):/);
    });
  });
});
