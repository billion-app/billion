import type { VoterInfoResponse } from "@acme/api";

export function electionsTabModel(
  query: { data?: VoterInfoResponse; isFetching: boolean; isError: boolean },
  editing: boolean,
  requestedElectionId?: string,
) {
  const mismatch =
    !query.isFetching &&
    !query.isError &&
    !editing &&
    !!requestedElectionId &&
    !!query.data &&
    query.data.election.id !== requestedElectionId;
  const data =
    query.isFetching || query.isError || editing || mismatch
      ? undefined
      : query.data;
  return {
    data,
    mismatch,
    candidates:
      data?.contests?.filter((contest) => !contest.referendumTitle) ?? [],
    measures:
      data?.contests?.filter((contest) => contest.referendumTitle) ?? [],
  };
}
