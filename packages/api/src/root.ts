import { authRouter } from "./router/auth";
import { contentRouter } from "./router/content";
import { postRouter } from "./router/post";
import { videoRouter } from "./router/video";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  content: contentRouter,
  video: videoRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
