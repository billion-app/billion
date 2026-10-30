import { z } from "zod/v4";

export * from "./bill-brief";
export * from "./bill-status";
export * from "./court-brief";

export const unused = z.string().describe(
  `This lib is currently not used as we use drizzle-zod for simple schemas
   But as your application grows and you need other validators to share
   with back and frontend, you can put them in here
  `,
);
export * from "./candidate-brief";

export * from "./proposition-consequences";
export * from "./measure-relationships";
export * from "./budget-context";
export * from "./candidate-research";
export * from "./candidate-research-collection";
export * from "./california-candidate-roster";
export * from "./candidate-evidence-dossier";
export * from "./proposition-context";
export * from "./trillion";
export * from "./official-title";
