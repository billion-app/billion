import { authRouter } from "./router/auth";
import { civicRouter } from "./router/civic";
import { contentRouter } from "./router/content";
import { electionsRouter } from "./router/elections";
import { legistarRouter } from "./router/legistar";
import { postRouter } from "./router/post";
import { videoRouter } from "./router/video";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  civic: civicRouter,
  legistar: legistarRouter,
  post: postRouter,
  content: contentRouter,
  video: videoRouter,
  caElections: electionsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
