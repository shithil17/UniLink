import { z } from "zod";
import { reasonCategory } from "../../../shared/schemas/common";
import { ruleName, type ModQueueItem, type ModQueuePost } from "../../../shared/schemas/moderation";
import type { Db } from "../../db/client";
import { redactText } from "../../moderation/rules";
import { moderatedPostTypes, type ModeratedPostTypes } from "../../moderation/postTypes";
import { moderatedPostsRepo } from "../../repos/moderatedPosts";
import { reportsRepo } from "../../repos/reports";
import { toModReports } from "./reportView";

/** Where the next page starts: a source (a post type, then reports) and the last id read from it. */
const CURSOR = /^(\d{1,3})\.([1-9]\d{0,15})$/;

const flagList = z.array(ruleName);

type Source = {
  /** Up to `limit` items with an id above `afterId`, oldest first. */
  load(afterId: number, limit: number): Promise<{ id: number; item: ModQueueItem }[]>;
  count(): Promise<number>;
};

function postSource(db: Db, targetType: string, postTypes: ModeratedPostTypes): Source {
  const type = postTypes[targetType];
  const repo = moderatedPostsRepo(db, type.table);
  return {
    count: () => repo.heldCount(),
    async load(afterId, limit) {
      return (await repo.heldPage(afterId, limit)).map((p) => {
        let flags: z.infer<typeof flagList> = [];
        try {
          const parsed = flagList.safeParse(p.flags === null ? [] : JSON.parse(p.flags));
          if (parsed.success) flags = parsed.data;
        } catch {
          // A malformed flag list shows as none rather than failing the queue.
        }
        return {
          id: p.id,
          item: {
            kind: "post",
            targetType,
            id: p.id,
            // Student IDs and card numbers can sit in a rejected post that was sent to the queue.
            text: type.screenedText(p.row).map(redactText),
            author: p.username,
            category: reasonCategory.catch("fine").parse(p.category),
            confidence: p.confidence,
            flags,
            model: p.model,
            appealed: p.appealedAt !== null,
          } satisfies ModQueuePost,
        };
      });
    },
  };
}

function reportSource(db: Db): Source {
  const repo = reportsRepo(db);
  return {
    count: () => repo.countOpen(),
    async load(afterId, limit) {
      const rows = await repo.listPage("open", limit, afterId === 0 ? null : afterId);
      return (await toModReports(db, rows)).map((r) => ({
        id: r.id,
        item: { ...r, kind: "report" as const },
      }));
    },
  };
}

export type QueuePage = { items: ModQueueItem[]; nextCursor: string | null; total: number };

/**
 * The review queue: held posts and open reports in one list. Held posts come first, one post type after
 * another, then reports; each source runs oldest first by id, so every page is an indexed range read
 * (`(status, id)` for posts and reports). The cursor is `source.lastId`. `total` is the whole queue.
 *
 * ceiling: the order is by source, not by time, because post tables carry no shared timestamp. Revisit
 * if mods want strict oldest-first across posts and reports.
 *
 * Returns null for a cursor that does not belong to this queue.
 */
export async function modQueue(
  db: Db,
  params: { cursor: string | undefined; size: number },
  opts: { postTypes?: ModeratedPostTypes } = {},
): Promise<QueuePage | null> {
  const postTypes = opts.postTypes ?? moderatedPostTypes;
  const sources = [
    ...Object.keys(postTypes).map((t) => postSource(db, t, postTypes)),
    reportSource(db),
  ];

  let start = 0;
  let afterId = 0;
  if (params.cursor !== undefined) {
    const m = CURSOR.exec(params.cursor);
    if (!m || Number(m[1]) >= sources.length) return null;
    start = Number(m[1]);
    afterId = Number(m[2]);
  }

  // One extra item says whether there is a next page.
  const wanted = params.size + 1;
  const collected: { source: number; id: number; item: ModQueueItem }[] = [];
  for (let i = start; i < sources.length && collected.length < wanted; i++) {
    const rows = await sources[i].load(i === start ? afterId : 0, wanted - collected.length);
    for (const r of rows) collected.push({ source: i, ...r });
  }

  const page = collected.slice(0, params.size);
  const last = page.at(-1);
  const total = (await Promise.all(sources.map((s) => s.count()))).reduce((a, b) => a + b, 0);
  return {
    items: page.map((p) => p.item),
    nextCursor: collected.length > params.size && last ? `${last.source}.${last.id}` : null,
    total,
  };
}
