import { describe, it, expect, beforeEach } from '@jest/globals';
import { FlowpointBuffer } from '../src/flowpointBuffer';
import { FlowpointOptions } from '../src/types';

function makeOptions(overrides: Partial<FlowpointOptions> = {}): FlowpointOptions {
    return { name: 'add-to-cart', step: 'start', ...overrides };
}

describe('FlowpointBuffer', () => {
    let buffer: FlowpointBuffer;

    beforeEach(() => {
        buffer = new FlowpointBuffer(5);
    });

    it('stores entries with defaults applied', () => {
        buffer.add(makeOptions({ step: 'cleared', meta: { removed: 3 } }));
        const entries = buffer.getAll();
        expect(entries).toHaveLength(1);
        expect(entries[0].name).toBe('add-to-cart');
        expect(entries[0].step).toBe('cleared');
        expect(entries[0].level).toBe('info');
        expect(entries[0].meta).toEqual({ removed: 3 });
        expect(typeof entries[0].t).toBe('number');
    });

    it('assigns monotonically increasing seq, not reset by clear', () => {
        buffer.add(makeOptions({ step: 'a' }));
        buffer.add(makeOptions({ step: 'b' }));
        expect(buffer.getAll().map((e) => e.seq)).toEqual([1, 2]);
        buffer.clear();
        buffer.add(makeOptions({ step: 'c' }));
        expect(buffer.getAll()[0].seq).toBe(3);
    });

    it('passes level through', () => {
        buffer.add(makeOptions({ step: 'failed', level: 'error' }));
        expect(buffer.getAll()[0].level).toBe('error');
    });

    it('evicts oldest when full', () => {
        for (let i = 0; i < 6; i++) {
            buffer.add(makeOptions({ step: `step-${i}` }));
        }
        const entries = buffer.getAll();
        expect(entries).toHaveLength(5);
        expect(entries.map((e) => e.step)).not.toContain('step-0');
        expect(entries[0].step).toBe('step-1');
    });

    it('clears and returns count, and resets the run map', () => {
        buffer.add(makeOptions());
        buffer.add(makeOptions({ step: 'done' }));
        const runBefore = buffer.getAll()[0].run;
        expect(buffer.clear()).toBe(2);
        expect(buffer.getAll()).toHaveLength(0);
        buffer.add(makeOptions({ step: 'again' }));
        expect(buffer.getAll()[0].run).not.toBe(runBefore);
    });

    it('getAll returns a copy, not a reference', () => {
        buffer.add(makeOptions());
        const first = buffer.getAll();
        const second = buffer.getAll();
        expect(first).not.toBe(second);
        expect(first).toEqual(second);
    });

    describe('runs', () => {
        it('same-name points share a run id (lazy fallback, no begin)', () => {
            buffer.add(makeOptions({ step: 'a' }));
            buffer.add(makeOptions({ step: 'b' }));
            const [a, b] = buffer.getAll();
            expect(a.run).toBe(b.run);
            expect(a.run).toMatch(/^[a-z0-9]{4}$/);
        });

        it('begin rotates the run id for that flow', () => {
            buffer.add(makeOptions({ step: 'a' }));
            buffer.add(makeOptions({ step: 'a', begin: true }));
            const [first, second] = buffer.getAll();
            expect(second.run).not.toBe(first.run);
        });

        it('different flow names get independent runs', () => {
            buffer.add(makeOptions({ name: 'flow-a' }));
            buffer.add(makeOptions({ name: 'flow-b' }));
            const [a, b] = buffer.getAll();
            expect(a.run).not.toBe(b.run);
        });
    });

    describe('snapshot', () => {
        it('returns a stable contextId and a copy of entries', () => {
            buffer.add(makeOptions());
            const snap1 = buffer.getSnapshot();
            const snap2 = buffer.getSnapshot();
            expect(snap1.contextId).toBe(snap2.contextId);
            expect(snap1.contextId).toMatch(/^[a-z0-9]{8}$/);
            expect(snap1.entries).not.toBe(snap2.entries);
            expect(snap1.entries).toEqual(buffer.getAll());
        });

        it('contextId differs between buffer instances', () => {
            expect(new FlowpointBuffer().contextId).not.toBe(new FlowpointBuffer().contextId);
        });
    });
});
