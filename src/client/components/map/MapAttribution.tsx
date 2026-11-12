import { Fragment } from "react";
import { cn } from "cn";
import { MAP_ATTRIBUTION } from "@/lib/map/source";

/**
 * The data credit, always open in a corner of every map. It sits on `surface` in `soft` text, which
 * keeps its contrast in every palette. Inside a preview (one big button) the names are plain text,
 * since a link cannot live in a button; full-screen maps link them.
 */
export function MapAttribution({ links, className }: { links: boolean; className?: string }) {
  return (
    <p
      data-slot="map-attribution"
      className={cn(
        "rounded-full bg-surface px-2.5 py-1 text-[11px] leading-none whitespace-nowrap text-soft",
        className,
      )}
    >
      {MAP_ATTRIBUTION.map((item, index) => (
        <Fragment key={item.text}>
          {index > 0 ? " · " : null}
          {links ? (
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-2"
            >
              {item.text}
            </a>
          ) : (
            item.text
          )}
        </Fragment>
      ))}
    </p>
  );
}
