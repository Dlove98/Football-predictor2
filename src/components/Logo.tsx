import Image from "next/image";

export default function Logo({ size = 44 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative shrink-0 overflow-hidden rounded-xl" style={{ width: size, height: size }}>
        <Image src="/images/logo.png" alt="Football Predictor by DTech" fill sizes={`${size}px`} className="object-cover" priority />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold uppercase tracking-wide text-white sm:text-base">
          Football Predictor
        </p>
        <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400 sm:text-xs">
          by DTech
        </p>
      </div>
    </div>
  );
}
