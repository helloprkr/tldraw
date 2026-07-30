import { modulate, useEditor, useUniqueSafeId, suffixSafeId } from 'tldraw'
import type { TLGridProps } from 'tldraw'

/**
 * A hairline grid, not grid dots. README permits "hairline grids for diagrams";
 * a field of dots is a whiteboard convention and reads as one.
 *
 * Same geometry as tldraw's default — the same step ladder, the same fade-in as
 * you zoom — drawn as ruled lines in bone at 40%.
 */
export function HairlineGrid({ x, y, z, size }: TLGridProps) {
  const id = useUniqueSafeId('grid')
  const editor = useEditor()
  const { gridSteps } = editor.options

  return (
    <svg className="tl-grid" version="1.1" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        {gridSteps.map(({ min, mid, step }, i) => {
          const s = step * size * z
          const xo = 0.5 + x * z
          const yo = 0.5 + y * z
          const gxo = xo > 0 ? xo % s : s + (xo % s)
          const gyo = yo > 0 ? yo % s : s + (yo % s)
          const opacity = z < mid ? modulate(z, [min, mid], [0, 1]) : 1

          return (
            <pattern
              key={i}
              id={suffixSafeId(id, `${step}`)}
              width={s}
              height={s}
              patternUnits="userSpaceOnUse"
            >
              <path
                className="essay-grid-rule"
                d={`M ${gxo} 0 V ${s} M 0 ${gyo} H ${s}`}
                opacity={opacity}
              />
            </pattern>
          )
        })}
      </defs>
      {gridSteps.map(({ step }, i) => (
        <rect key={i} width="100%" height="100%" fill={`url(#${suffixSafeId(id, `${step}`)})`} />
      ))}
    </svg>
  )
}
