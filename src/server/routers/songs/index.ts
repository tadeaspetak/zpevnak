import { router } from '../../trpc/trpc.ts';
import { byId } from './songs.byId.ts';
import { create } from './songs.create.ts';
import { queue } from './songs.queue.ts';
import { reject } from './songs.reject.ts';
import { sync } from './songs.sync.ts';
import { update } from './songs.update.ts';
import { verify } from './songs.verify.ts';

export const songsRouter = router({ sync, byId, create, update, verify, reject, queue });
