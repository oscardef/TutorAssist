// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MathfieldElement } from 'mathlive'
import 'react'

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          value?: string
          'virtual-keyboard-mode'?: 'auto' | 'manual' | 'off'
          'smart-mode'?: boolean
          ref?: React.Ref<MathfieldElement>
        },
        HTMLElement
      >
    }
  }
}
