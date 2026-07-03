import { authRouter } from "./router/auth";
import { civicRouter } from "./router/civic";
import { contentRouter } from "./router/content";
import { feedbackRouter } from "./router/feedback";
import { legistarRouter } from "./router/legistar";
import { openStatesRouter } from "./router/open-states";
import { placesRouter } from "./router/places";
import { postRouter } from "./router/post";
import { userRouter } from "./router/user";
import { videoRouter } from "./router/video";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  civic: civicRouter,
  legistar: legistarRouter,
  openStates: openStatesRouter,
  places: placesRouter,
  post: postRouter,
  content: contentRouter,
  feedback: feedbackRouter,
  video: videoRouter,
  user: userRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;
