import { ArrowShapeUtil } from 'tldraw'
import type { ArrowShapeOptions } from 'tldraw'

/**
 * Dependency arrows, BUILD.md §5.5 and §7 Stage 4: ink-3, 1px, small solid
 * head, never pigmented.
 *
 * Neither half of that is reachable through the shape's props. theme.ts
 * collapses every named tldraw color to solid ink so the palette can never
 * introduce a hue we did not choose — which also means no `color` value
 * resolves to ink-3. And width is computed in JS as
 * `theme.strokeWidth (2) * STROKE_SIZES[size]`, where the smallest size is 1,
 * so 2px is the thinnest a prop can ask for.
 *
 * Restyling in CSS works on canvas and silently fails on export: the exporter
 * renders through toSvg without the document stylesheet applied to shape
 * internals, so exported plates would carry 2px near-black arrows while the
 * canvas showed 1px ink-3. Overriding the display values fixes both paths from
 * one place, which is the only version of this that survives §10.
 */

const INK_3 = '#6b5a4c'

export class DependencyArrowUtil extends ArrowShapeUtil {
  // `options` is a class field on the parent, so it is neither reachable via
  // `super` nor initialized in time for a field initializer here. Amending it
  // in the constructor is the one point where the defaults exist and can still
  // be narrowed. Only the two display values change.
  constructor(...args: ConstructorParameters<typeof ArrowShapeUtil>) {
    super(...args)
    const options: ArrowShapeOptions = {
      ...this.options,
      // fillColor paints the solid head; without it the head keeps the palette's
      // ink and reads a shade darker than its own line.
      getCustomDisplayValues: () => ({
        strokeColor: INK_3,
        strokeWidth: 1,
        fillColor: INK_3,
      }),
    }
    this.options = options
  }
}
