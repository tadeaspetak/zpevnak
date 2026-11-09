import { router } from '../../trpc/trpc.ts';
import { list } from './users.list.ts';
import { setRole } from './users.setRole.ts';

export const usersRouter = router({ list, setRole });
