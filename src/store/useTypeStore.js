import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getIcon } from '../nodes/iconRegistry'

const DEFAULT_TYPES = {
  character: { label: 'Character', color: '#7C3AED', iconName: 'UserCircle' },
  location:  { label: 'Location',  color: '#16A34A', iconName: 'MapPin' },
  item:       { label: 'Item',      color: '#EA580C', iconName: 'Backpack' },
  faction:    { label: 'Faction',   color: '#2563EB', iconName: 'ShieldPlus' },
  story:      { label: 'Story',     color: '#9CA3AF', iconName: 'BookOpen' },
}

export const useTypeStore = create(
  persist(
    (set) => ({
      types: DEFAULT_TYPES,
      addType: (key, { label, color, iconName }) =>
        set((state) => ({
          types: { ...state.types, [key]: { label, color, iconName } },
        })),
    }),
    { name: 'dnd-node-types' }
  )
)

export const useNodeTypes = () => {
  const types = useTypeStore((s) => s.types)
  return Object.fromEntries(
    Object.entries(types).map(([key, { label, color, iconName }]) => [
      key,
      { label, color, icon: getIcon(iconName) },
    ])
  )
}
