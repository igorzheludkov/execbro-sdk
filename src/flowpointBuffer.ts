import { FlowpointEntry, FlowpointOptions, FlowpointSnapshot } from './types';

function randomId(length: number): string {
    let id = '';
    while (id.length < length) {
        id += Math.random().toString(36).slice(2);
    }
    return id.slice(0, length);
}

export class FlowpointBuffer {
    readonly contextId: string = randomId(8);
    private entries: FlowpointEntry[] = [];
    private maxSize: number;
    private seqCounter = 0;
    private currentRuns: Map<string, string> = new Map();

    constructor(maxSize: number = 500) {
        this.maxSize = maxSize;
    }

    add(options: FlowpointOptions): void {
        const { name, step, meta, level, begin } = options;
        if (begin || !this.currentRuns.has(name)) {
            this.currentRuns.set(name, randomId(4));
        }
        const entry: FlowpointEntry = {
            seq: ++this.seqCounter,
            t: Date.now(),
            name,
            step,
            run: this.currentRuns.get(name)!,
            level: level ?? 'info',
        };
        if (meta !== undefined) {
            entry.meta = meta;
        }
        if (this.entries.length >= this.maxSize) {
            this.entries.shift();
        }
        this.entries.push(entry);
    }

    getAll(): FlowpointEntry[] {
        return [...this.entries];
    }

    getSnapshot(): FlowpointSnapshot {
        return { contextId: this.contextId, entries: [...this.entries] };
    }

    clear(): number {
        const count = this.entries.length;
        this.entries = [];
        this.currentRuns.clear();
        return count;
    }
}
