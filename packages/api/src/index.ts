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
} from "./lib/civic";

// Google Civic API client functions (for direct use outside tRPC)
export {
  getElections,
  getVoterInfo,
  getRepresentatives,
  getRepresentativesEnriched,
} from "./lib/civic";

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

// California Secretary of State Election Results API
export {
  CASOSClient,
  CASOSError,
  CA_COUNTIES,
  getCASOSClient,
  createCASOSClient,
} from "./clients/ca-sos";
export type {
  Election as CAElection,
  Contest as CAContest,
  Candidate as CACandidate,
  ContestResult,
  ContestResultWithCounties,
  CountyResult,
  VoteTotal,
  ElectionStatus,
  ElectionType,
  ContestType as CAContestType,
  CountyCode,
  CASOSClientConfig,
} from "./clients/ca-sos";

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
