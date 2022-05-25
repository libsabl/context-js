import { comment } from './util';

describe('comment', () => {
  describe('single line', () => {
    it('comments line', () => {
      const result = comment('hello');
      expect(result).toBe('// hello');
    });

    it('preserves leading spaces', () => {
      const result = comment('    hello');
      expect(result).toBe('    // hello');
    });

    it('leaves commented lines', () => {
      const result = comment('  // already commented');
      expect(result).toBe('  // already commented');
    });
  });
});
