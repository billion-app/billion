/* eslint-disable @next/next/no-img-element -- headshots come from an external people export */

export interface Sponsor {
  name: string;
  initials: string;
  role?: string;
  party?: string;
  state?: string;
  district?: string;
  imageUrl?: string;
}

/** Who formally sponsored the bill. Not a link: a sponsor page is not part of web Browse yet. */
export function SponsorCard({ sponsor, isStateBill }: { sponsor: Sponsor; isStateBill: boolean }) {
  const meta = [
    sponsor.role,
    sponsor.party,
    isStateBill && sponsor.district ? `District ${sponsor.district}` : sponsor.state,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="bg-slate border-hair-1 flex items-center gap-3 rounded-[14px] border p-3" data-testid="bill-sponsor-card">
      {sponsor.imageUrl ? (
        <img src={sponsor.imageUrl} alt="" className="bg-surface h-11 w-11 rounded-full object-cover" />
      ) : (
        <span className="bg-surface flex h-11 w-11 items-center justify-center rounded-full font-sans text-[14px] font-bold">
          {sponsor.initials}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-quiet font-sans text-[11px] font-semibold tracking-[0.06em] uppercase">Sponsored by</p>
        <p className="truncate font-sans text-[15px] font-bold">{sponsor.name}</p>
        {meta ? <p className="text-quiet truncate font-sans text-[12.5px]">{meta}</p> : null}
      </div>
    </div>
  );
}
