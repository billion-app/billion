import Image from "next/image";
import Link from "next/link";

const TEAM = [
  { name: "Bryan Hu", initials: "BH", role: "Co-Founder", photo: null },
  {
    name: "Jun Jiang",
    initials: "JJ",
    role: "Co-Founder",
    photo: "/team/jun-jiang.jpg",
  },
  {
    name: "Nacho Nandish",
    initials: "NN",
    role: "Founding Developer",
    photo: null,
  },
  {
    name: "Yohaan Narayanan",
    initials: "YN",
    role: "Founding Developer",
    photo: null,
  },
];

export function TeamSection() {
  return (
    <section
      id="team"
      tabIndex={-1}
      className="cinematic-team"
      aria-labelledby="team-heading"
    >
      <div className="cinematic-team-inner">
        <header className="cinematic-team-header">
          <h2 id="team-heading" className="cinematic-team-heading">
            Meet the team.
          </h2>
          <p className="cinematic-team-intro">
            Building a clearer picture of what government is doing.
          </p>
        </header>
        <div className="cinematic-team-people">
          {(["Co-Founder", "Founding Developer"] as const).map((role) => (
            <ul
              key={role}
              aria-label={
                role === "Co-Founder" ? "Co-founders" : "Founding developers"
              }
              className={`cinematic-team-grid ${role === "Co-Founder" ? "cinematic-team-founders" : "cinematic-team-developers"}`}
            >
              {TEAM.filter((member) => member.role === role).map((member) => (
                <li key={member.name}>
                  <div className="cinematic-team-portrait">
                    {member.photo ? (
                      <Image
                        src={member.photo}
                        alt={`Portrait of ${member.name}`}
                        fill
                        sizes="(max-width: 600px) 42vw, 280px"
                      />
                    ) : (
                      <span aria-hidden="true">{member.initials}</span>
                    )}
                  </div>
                  <h3>{member.name}</h3>
                  <p className="cinematic-team-role">{member.role}</p>
                </li>
              ))}
            </ul>
          ))}
        </div>

        <footer className="cinematic-team-footer">
          <span>© 2026 Bryan Hu</span>
          <nav aria-label="Footer">
            <Link href="/support">Support</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
          </nav>
        </footer>
      </div>
    </section>
  );
}
