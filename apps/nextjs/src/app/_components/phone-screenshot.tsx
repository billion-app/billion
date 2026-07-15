import Image from "next/image";

export function PhoneScreenshot({
  src,
  alt,
  className,
  priority = false,
  sizes,
}: {
  src: string;
  alt: string;
  className: string;
  priority?: boolean;
  sizes: string;
}) {
  return (
    <div
      className={`${className} overflow-hidden rounded-[34px] border border-white/12 bg-[#070b1a] p-2 shadow-[0_26px_70px_rgba(0,0,0,0.38)]`}
    >
      <div className="relative aspect-[1179/2556] overflow-hidden rounded-[28px] bg-[#0e1530]">
        <Image
          src={src}
          alt={alt}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      </div>
    </div>
  );
}
