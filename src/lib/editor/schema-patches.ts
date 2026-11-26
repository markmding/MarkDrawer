// MARK#EZVE.COM
import { schemaTimerCtx } from '@milkdown/kit/core'
import { addTimer } from '@milkdown/kit/utils'
import { patchParagraphSerialization } from './serializer'
import { patchTaskList, patchTaskListRendering } from './task-list'

/**
 * Schema patches must run *after* every node schema is registered.
 *
 * `editor.config()` callbacks run in the ConfigReady phase, which `InitReady`
 * waits for — but the `$node` plugins that fill `nodesCtx` only run once
 * `InitReady` resolves. A `ctx.update(nodesCtx, …)` inside `config()` therefore
 * maps over an empty array and silently does nothing; whichever plugin
 * registers `paragraph` / `list_item` afterwards wins.
 *
 * `addTimer` registers a timer in `schemaTimerCtx`, which `SchemaReady` awaits
 * (schema.ts: `await ctx.waitTimers(schemaTimerCtx)`) right before it builds the
 * ProseMirror `Schema`. Registered last, this timer sees the fully populated
 * `nodesCtx` and its edits land in the schema the editor actually uses.
 */
export const nodeSchemaPatches = addTimer(
  async (ctx, _api, done) => {
    // Empty paragraphs must not serialize as `<br />`.
    patchParagraphSerialization(ctx)
    // Three-state task lists (`[~]`) plus the empty `[ ]` marker rescue.
    patchTaskList(ctx)
    // Runs after Crepe's own config so the wrapper can delegate to it.
    patchTaskListRendering(ctx)
    done()
  },
  schemaTimerCtx,
  'markupNodeSchemaPatches'
)
