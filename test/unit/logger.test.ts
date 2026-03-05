import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { makeLogger, noopLogger } from '../../src/utils/logger';

describe('makeLogger', () => {
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    spy.mockRestore();
  });

  it('logs info messages', () => {
    const log = makeLogger();
    log('info', 'hello');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('logs success messages', () => {
    const log = makeLogger();
    log('success', 'done');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('logs warn messages', () => {
    const log = makeLogger();
    log('warn', 'careful');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('logs error messages', () => {
    const log = makeLogger();
    log('error', 'boom');
    expect(spy).toHaveBeenCalledOnce();
  });

  it('suppresses debug messages when debug=false (default)', () => {
    const log = makeLogger(false);
    log('debug', 'hidden');
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs debug messages when debug=true', () => {
    const log = makeLogger(true);
    log('debug', 'visible');
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe('noopLogger', () => {
  it('does nothing and returns undefined', () => {
    expect(noopLogger('info', 'test')).toBeUndefined();
  });
});
