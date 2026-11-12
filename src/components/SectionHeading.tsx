type SectionHeadingProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
}: SectionHeadingProps) {
  return (
    <div className="max-w-2xl space-y-3">
      <p className="text-xs uppercase tracking-[0.4em] text-stone-500">
        {eyebrow}
      </p>
      <h2 className="font-display text-4xl text-stone-900 sm:text-5xl">{title}</h2>
      <p className="text-sm leading-7 text-stone-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}
