import type { z } from 'zod';
import type { Application } from '../app/bootstrap.js';
import type { HostExec } from '../platform/dsh/host-bridge.js';
export type RegisterTool = <T>(name: string, description: string, schema: z.ZodType<T>, handler: (args: T, exec?: HostExec) => Promise<unknown>) => void;
export interface ToolContext { root: string; getApp: () => Promise<Application>; reset: () => void; approve: (exec: HostExec | undefined, name: string, reason: string) => Promise<boolean> }
