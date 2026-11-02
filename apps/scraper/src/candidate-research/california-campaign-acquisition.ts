import type {
  CaliforniaRaceTarget,
  CampaignOwnershipProof,
  ResearchSource,
} from "@acme/validators";
import {
  campaignOwnershipDigest,
  currentCampaignContactUrl,
  currentGovernorContact,
  qualifiedPartyListUrl,
  qualifiedPartyRegistryUrl,
  qualifiedPartyWebsite,
  validateCampaignOwnership,
} from "@acme/api/lib/campaign-ownership";
import {
  campaignArchiveHash,
  validateCampaignRenderSources,
} from "@acme/api/lib/campaign-render-archive";
import { formatCampaignHtml } from "@acme/api/lib/campaign-source-html";

import type {
  CampaignBrowserConfiguration,
  CampaignRenderBudget,
} from "../research/campaign-browser.js";
import {
  admittedCampaignShell,
  renderCampaignSource,
} from "../research/campaign-browser.js";

export type CampaignDocumentReader = (
  url: string,
  publisher: string,
  format?: ResearchSource["format"],
  id?: string,
  archiveHtml?: boolean,
) => Promise<ResearchSource>;
export async function prepareGovernorCampaign(input: {
  race: CaliforniaRaceTarget;
  member: CaliforniaRaceTarget["members"][number];
  roster: ResearchSource;
  read: CampaignDocumentReader;
  sources(): ResearchSource[];
  register(sources: ResearchSource[]): void;
  budget: CampaignRenderBudget;
  configuration?: CampaignBrowserConfiguration;
  render?: typeof renderCampaignSource;
}) {
  if (
    input.race.officeFamily !== "statewide" ||
    input.race.office !== "Governor" ||
    input.race.electionDate !== "2026-11-03"
  )
    return undefined;
  const contact = await input.read(
    currentCampaignContactUrl,
    "California Secretary of State",
    "pdf",
  );
  const official = currentGovernorContact(
    contact,
    input.race.members,
    input.member.candidateId,
  );
  if (!official || official.status === "withheld")
    throw new Error(
      "Current Governor candidate website is unresolved or withheld",
    );
  let proof: CampaignOwnershipProof;
  if (official.status === "listed") {
    proof = {
      kind: "current_sos_campaign_v1",
      contactSourceId: contact.id,
      contactExcerpt: official.excerpt,
      listedUrl: official.url,
      destinationSourceId: `source-${campaignArchiveHash(official.url).slice(0, 24)}`,
    };
  } else {
    if (input.member.party !== "Democratic") return undefined;
    const registry = await input.read(
      qualifiedPartyRegistryUrl,
      "California Secretary of State",
      "html",
      undefined,
      true,
    );
    const list = await input.read(
      qualifiedPartyListUrl,
      "California Democratic Party",
      "html",
      undefined,
      true,
    );
    const website = qualifiedPartyWebsite(registry, list, input.member.name);
    proof = {
      kind: "qualified_party_campaign_v1",
      currentContactSourceId: contact.id,
      contactExcerpt: official.excerpt,
      registrySourceId: registry.id,
      partyListSourceId: list.id,
      partyName: "Democratic Party",
      partyWebsiteAnchor: website.partyWebsiteAnchor,
      candidateAnchor: website.candidateAnchor,
      listedUrl: website.url,
      destinationSourceId: `source-${campaignArchiveHash(website.url).slice(0, 24)}`,
      legalOwner: "",
    };
  }
  const rootProof = proof;
  let rootPending: Promise<ResearchSource> | undefined;
  let rendered: ResearchSource[] | undefined;
  let qualified = false;
  const merge = (additional: ResearchSource[]) => [
    ...new Map(
      [...input.sources(), ...additional].map((source) => [source.id, source]),
    ).values(),
  ];
  const validate = (additional: ResearchSource[]) => {
    const sources = merge(additional);
    validateCampaignOwnership({
      identity: input.member.identity,
      name: input.member.name,
      officeFamily: input.race.officeFamily,
      sources,
      campaignOwnershipProof: proof,
    });
    validateCampaignRenderSources(sources, {
      candidateId: input.member.candidateId,
      ownershipDigest: campaignOwnershipDigest(proof),
    });
  };
  const root = () =>
    (rootPending ??= (async () => {
      let source = await input.read(
        rootProof.listedUrl,
        new URL(rootProof.listedUrl).hostname,
        "html",
        rootProof.destinationSourceId,
        true,
      );
      if (admittedCampaignShell(source)) {
        if (proof.kind !== "current_sos_campaign_v1")
          throw new Error(
            "Party discovery cannot activate a missing current-contact renderer",
          );
        rendered = await (input.render ?? renderCampaignSource)({
          initial: source,
          candidateId: input.member.candidateId,
          ownershipDigest: campaignOwnershipDigest(proof),
          configuration: input.configuration,
          budget: input.budget,
        });
        source = rendered.find(
          (candidate) => candidate.id === proof.destinationSourceId,
        )!;
        if (!source)
          throw new Error(
            "Rendered campaign root does not match its official source identity",
          );
      }
      if (proof.kind === "qualified_party_campaign_v1") {
        if (!source.binaryBase64)
          throw new Error("Party-linked campaign HTML archive is missing");
        const disclosures = formatCampaignHtml(
          Buffer.from(source.binaryBase64, "base64").toString("utf8"),
          source.url,
        ).disclosures;
        const surname = input.member.name.split(/\s+/).at(-1)!;
        const owner = disclosures.find(
          (value) =>
            value.toLocaleLowerCase() ===
              `Paid for by ${surname} for Governor 2026`.toLocaleLowerCase() ||
            value.toLocaleLowerCase() ===
              `Paid for by ${input.member.name} for Governor 2026`.toLocaleLowerCase(),
        );
        if (!owner)
          throw new Error(
            "Party-linked campaign legal publisher is unresolved",
          );
        proof = { ...proof, legalOwner: owner };
      }
      validate(rendered ?? [source]);
      input.register(rendered ?? [source]);
      qualified = true;
      return source;
    })());
  return {
    website: proof.listedUrl,
    proof: () => (qualified ? proof : undefined),
    discovery: () =>
      proof.kind === "current_sos_campaign_v1"
        ? {
            sourceId: contact.id,
            anchorText: official.status === "listed" ? official.anchor : "",
            relation: "official_contact" as const,
          }
        : {
            sourceId: proof.partyListSourceId,
            anchorText: proof.candidateAnchor,
            relation: "qualified_party_discovery" as const,
          },
    async read(
      url: string,
      publisher: string,
      format: ResearchSource["format"] = "html",
      id?: string,
    ) {
      const parsed = new URL(url),
        listed = new URL(rootProof.listedUrl);
      if (
        format !== "html" ||
        parsed.hostname.replace(/^www\./, "") !==
          listed.hostname.replace(/^www\./, "")
      )
        return input.read(url, publisher, format, id);
      const parent = await root();
      if (url === rootProof.listedUrl || url === parent.url) return parent;
      const prepared = rendered?.find((source) => source.url === url);
      if (prepared) return prepared;
      if (
        parsed.origin !== new URL(parent.url).origin ||
        !parent.text.split("\n").some((line) => line.endsWith(" => " + url))
      )
        throw new Error(
          "Campaign child page is not an actually observed same-origin link",
        );
      return input.read(url, publisher, format, id);
    },
    async qualify() {
      await root();
      return proof;
    },
  };
}
