import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '#server/routers/index.ts';

const links = [httpBatchLink({ url: '/trpc' })];

/** Hooks for components: trpc.songs.queue.useQuery(…). */
export const trpc = createTRPCReact<AppRouter>();
export const trpcReactClient = trpc.createClient({ links });

/** Plain calls outside React (the catalog sync). */
export const trpcClient = createTRPCClient<AppRouter>({ links });
