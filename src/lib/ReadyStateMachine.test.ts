import { describe, it, expect } from 'bun:test';
import { createReadyStateMachine } from './ReadyStateMachine';

describe('createReadyStateMachine', () => {
  it('transitions through states and notifies watchers', () => {
    const rsm = createReadyStateMachine();
    const states: string[] = [];
    rsm.watchReady((s) => states.push(s));
    rsm.setStatus('loading');
    rsm.setStatus('ready');
    expect(states).toEqual(['loading', 'ready']);
  });

  it('handles error state', () => {
    const rsm = createReadyStateMachine();
    const states: string[] = [];
    rsm.watchReady((s) => states.push(s));
    rsm.setStatus('loading');
    rsm.setStatus('error');
    expect(states).toEqual(['loading', 'error']);
  });

  it('whenReady resolves when state becomes ready', async () => {
    const rsm = createReadyStateMachine();
    const ready = rsm.whenReady();
    rsm.setStatus('loading');
    rsm.setStatus('ready');
    await expect(ready).resolves.toBeUndefined();
  });

  it('whenReady rejects when state becomes error', async () => {
    const rsm = createReadyStateMachine();
    const ready = rsm.whenReady();
    rsm.setStatus('loading');
    rsm.setStatus('error');
    await expect(ready).rejects.toThrow('Ready state machine failed to initialize');
  });

  it('already ready resolves immediately', async () => {
    const rsm = createReadyStateMachine();
    rsm.setStatus('ready');
    await expect(rsm.whenReady()).resolves.toBeUndefined();
  });

  it('unsubscribe stops notifications', () => {
    const rsm = createReadyStateMachine();
    const states: string[] = [];
    const unsub = rsm.watchReady((s) => states.push(s));
    unsub();
    rsm.setStatus('ready');
    expect(states).toEqual([]);
  });

  it('supports multiple watchers', () => {
    const rsm = createReadyStateMachine();
    const a: string[] = [];
    const b: string[] = [];
    rsm.watchReady((s) => a.push(s));
    rsm.watchReady((s) => b.push(s));
    rsm.setStatus('ready');
    expect(a).toEqual(['ready']);
    expect(b).toEqual(['ready']);
  });
});
