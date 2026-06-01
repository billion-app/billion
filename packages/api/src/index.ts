import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";
import { appRouter } from "./root";
import { createTRPCContext } from "./trpc";

export type { VideoPost } from "./router/video";
export { getThumbnailForContent } from "./router/content";

// Google Civic API types
export type {
  Election,
  VoterInfoResponse,
  RepresentativesResponse,
  Representative,
  Official,
  Office,
  PollingLocation,
  Contest,
  Candidate,
  Source,
  MeasureCitationRef,
  MeasureArgumentRef,
} from "./lib/civic";

// Google Civic API client functions (for direct use outside tRPC)
export {
  getElections,
  getVoterInfo,
  getRepresentatives,
  getRepresentativesEnriched,
} from "./lib/civic";

// Google Places address autocomplete
export type { AddressSuggestion } from "./lib/places";
export { getAddressSuggestions } from "./lib/places";

// Open States API types
export type {
  OpenStatesBill,
  OpenStatesBillSearchResult,
  OpenStatesPerson,
  OpenStatesPersonSearchResult,
  OpenStatesVote,
  OpenStatesBillAction,
  OpenStatesBillSponsorship,
  OpenStatesBillVersion,
  OpenStatesBillDocument,
  GetBillsOptions,
  GetBillDetailsOptions,
  GetLegislatorsOptions,
} from "./clients/open-states";

// Open States API client functions (for California state legislation)
export {
  getBills,
  getBillDetails,
  getLegislators,
  getVotes,
  getCurrentSessions,
  getLegislatorById,
  getBillsBySponsor,
  openStatesClient,
} from "./clients/open-states";

// Legistar API for local government legislation (Santa Clara County area)
export {
  legistar,
  LegistarClient,
  LegistarError,
  JURISDICTIONS,
} from "./integrations/legistar";
export type {
  Jurisdiction,
  LegistarMeeting,
  LegistarMatter,
  LegistarVote,
  LegistarAgendaItem,
  LegistarAttachment,
  LegistarBody,
  DateRange,
  LegislationQuery,
} from "./integrations/legistar";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: number }
 **/
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 **/
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { createTRPCContext, appRouter };
export type { AppRouter, RouterInputs, RouterOutputs };
