export const SpaceButton = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="group container p-0 m-0 z-10 sticky border border-stone-800/20 max-w-min overflow-hidden rounded-full top-4 bg-transparent shadow-inner shadow-stone-200 dark:shadow-stone-800 *:transition-colors">
      <div className="absolute inset-0 blurry container-pad bg-teal-800 group-hover:bg-fd-foreground/60" />
      <button className=" w-full px-4 py-2 noisey rounded-full inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
        {children}
      </button>
    </div>
  );
};
