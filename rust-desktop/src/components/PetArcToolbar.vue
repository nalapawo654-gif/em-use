<script lang="ts">
import { defineComponent, Fragment, h, isVNode, type VNode } from 'vue'
import { arcButtonStyle, arcSegment } from '../shared/petArc'
import type { Scene } from '../shared/types'
import type { PropType } from 'vue'
import '../pet-arc.css'

// Preserve the caller's action handlers, disabled state and accessible names.
// Flatten only slot fragments; never traverse a component's private children.
function buttons(nodes: VNode[]): VNode[] {
  return nodes.flatMap(node => node.type === Fragment && Array.isArray(node.children)
    ? buttons(node.children.filter(isVNode)) : node.type === 'button' ? [node] : [])
}
export default defineComponent({
  name: 'PetArcToolbar',
  props: { scene: { type: String as PropType<Scene>, required: true }, label: { type: String, required: true }, blocked: Boolean },
  setup(props, { slots }) {
    const renderButtons = (nodes: VNode[], start: number, end: number, kind: string, roundEnd = false) => nodes.map((node, i) => {
      return h('button', {
        ...node.props,
        class: ['pet-arc-button', `pet-arc-${kind}`],
        style: arcButtonStyle(i, nodes.length, start, end, { start: kind === 'control' && i === 0, end: roundEnd && i === nodes.length - 1 }),
        title: node.props?.title ?? node.props?.['aria-label'],
        type: 'button',
      }, [h('span', { class: 'pet-arc-content' }, node.children as VNode[])])
    })
    return () => {
      const controls = buttons(slots.controls?.() ?? []), quick = buttons(slots.default?.() ?? [])
      return h('nav', { class: ['pet-arc', { 'is-blocked': props.blocked }], 'data-scene': props.scene, 'data-pet-gesture': '', 'aria-label': `${props.label}环抱操作栏` }, [
        h('span', { class: 'pet-arc-name' }, props.label),
        h('div', { class: 'pet-arc-full' }, [
          h('span', { class: 'pet-arc-track', style: arcSegment(-76, 40, 0, { start: true, end: true }), 'aria-hidden': 'true' }),
          ...renderButtons(controls, -76, -28, 'control'),
          ...renderButtons(quick, -28, 40, 'quick', true),
        ]),
        h('div', { class: 'pet-arc-mini' }, [
          h('span', { class: 'pet-arc-track', style: arcSegment(-76, 40, 0, { start: true, end: true }), 'aria-hidden': 'true' }),
          ...renderButtons(controls, -76, 40, 'control', true),
        ]),
      ])
    }
  },
})
</script>
