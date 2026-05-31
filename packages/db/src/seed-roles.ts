import { db } from "./client";
import { RoleDescriptionRecord } from "./schema";

const SEED_DATA: { role: string; level: string | null; description: string }[] =
  [
    // Federal
    {
      role: "headOfState",
      level: "country",
      description:
        "The President serves as head of state and commander-in-chief, signs or vetoes legislation, issues executive orders, and leads foreign policy.",
    },
    {
      role: "headOfGovernment",
      level: "country",
      description:
        "The President serves as head of state and commander-in-chief, signs or vetoes legislation, issues executive orders, and leads foreign policy.",
    },
    {
      role: "legislatorUpperBody",
      level: "country",
      description:
        "U.S. Senators serve 6-year terms, confirm presidential appointments, ratify treaties, and vote on federal legislation. Each state has two senators.",
    },
    {
      role: "legislatorLowerBody",
      level: "country",
      description:
        "U.S. Representatives serve 2-year terms, introduce and vote on federal legislation, and control federal spending. They represent roughly 760,000 people each.",
    },
    {
      role: "highestCourtJudge",
      level: "country",
      description:
        "Supreme Court Justices serve lifetime appointments, interpret the Constitution, and make final rulings on federal law that affect the entire country.",
    },

    // State
    {
      role: "headOfGovernment",
      level: "administrativeArea1",
      description:
        "The Governor leads the state executive branch, signs or vetoes state legislation, manages the state budget, and commands the state National Guard.",
    },
    {
      role: "deputyHeadOfGovernment",
      level: "administrativeArea1",
      description:
        "The Lieutenant Governor serves as second-in-command, presides over the state senate, and assumes the governorship if the office is vacated.",
    },
    {
      role: "legislatorUpperBody",
      level: "administrativeArea1",
      description:
        "State Senators draft and vote on state laws covering education, healthcare, transportation, and criminal justice. They typically represent several hundred thousand residents.",
    },
    {
      role: "legislatorLowerBody",
      level: "administrativeArea1",
      description:
        "State Assembly or House members draft and vote on state legislation. They represent smaller districts than senators, keeping them closer to local concerns.",
    },
    {
      role: "governmentOfficer",
      level: "administrativeArea1",
      description:
        "This statewide officer oversees a specific function of state government, such as elections, finances, or legal affairs.",
    },

    // County
    {
      role: "headOfGovernment",
      level: "administrativeArea2",
      description:
        "The County Executive or Board Chair manages county services including public health, roads, law enforcement, and social services for unincorporated areas.",
    },
    {
      role: "legislatorUpperBody",
      level: "administrativeArea2",
      description:
        "County supervisors or commissioners set county policy, approve budgets, and oversee departments like public health, sheriff, and land use planning.",
    },
    {
      role: "legislatorLowerBody",
      level: "administrativeArea2",
      description:
        "County council members vote on local ordinances, approve budgets for county services, and represent residents in county government decisions.",
    },

    // City / locality
    {
      role: "headOfGovernment",
      level: "locality",
      description:
        "The Mayor serves as chief executive of the city, sets policy priorities, proposes budgets, and represents the city in regional and state affairs.",
    },
    {
      role: "legislatorLowerBody",
      level: "locality",
      description:
        "City council members represent neighborhoods, vote on local ordinances, approve city budgets, and oversee municipal services like parks, transit, and public safety.",
    },
    {
      role: "legislatorUpperBody",
      level: "locality",
      description:
        "City council members represent neighborhoods, vote on local ordinances, approve city budgets, and oversee municipal services like parks, transit, and public safety.",
    },

    // Special purpose (no level)
    {
      role: "schoolBoard",
      level: null,
      description:
        "School board members set education policy for the district, hire the superintendent, approve budgets, and make decisions about curriculum, facilities, and student programs.",
    },
    {
      role: "specialPurposeOfficer",
      level: null,
      description:
        "This official oversees a special-purpose district such as water, fire protection, transit, or utilities, making decisions that directly affect local services and rates.",
    },
    {
      role: "judge",
      level: null,
      description:
        "Judges interpret and apply the law, preside over civil and criminal cases, and issue rulings that can set legal precedent in their jurisdiction.",
    },
    {
      role: "highestCourtJudge",
      level: null,
      description:
        "This judge serves on the highest court in the jurisdiction, making final rulings on appeals and constitutional questions.",
    },
  ];

async function seed() {
  console.log("Seeding role descriptions...");

  for (const row of SEED_DATA) {
    await db
      .insert(RoleDescriptionRecord)
      .values({
        role: row.role,
        level: row.level,
        description: row.description,
        source: "seed",
      })
      .onConflictDoUpdate({
        target: [RoleDescriptionRecord.role, RoleDescriptionRecord.level],
        set: { description: row.description, source: "seed" },
      });
  }

  console.log(`Seeded ${SEED_DATA.length} role descriptions.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
