import { FlowpointOptions } from './types';

export function flowpoint(options: FlowpointOptions): void {
    const g = globalThis.__EXECBRO__ ?? globalThis.__RN_AI_DEVTOOLS__;
    if (!g || typeof g.addFlowpoint !== 'function') {
        return;
    }
    g.addFlowpoint(options);
}
