import {
  UserCircle, User, Users, UsersThree, Crown, MaskHappy, Ghost, Skull, Star, Eye,
  Handshake, Shield, ShieldPlus, ShieldCheck, Person, Detective,
  MapPin, MapTrifold, CastleTurret, House, Mountains, Tree, Door, Compass, Globe, Island,
  Tent, Lighthouse, Church, Anchor, Warehouse, Boat,
  Backpack, Key, Diamond, Scroll, Flask, Fire, Lightning, Snowflake,
  Coins, Lock, Hammer, Knife, Package, Trophy, Sword, Axe,
  BookOpen, Book, Bell, Warning, Sparkle, Heart, Moon, Sun, Wind, Feather,
  Hourglass, Target, Flag, Question, Rainbow, Scales,
  Bug, Bird, Fish, PawPrint, Leaf, Binoculars, Guitar, Coffee,
} from '@phosphor-icons/react'

export const ICON_REGISTRY = [
  // People & Characters
  { name: 'UserCircle',  component: UserCircle,  keywords: ['character', 'person', 'npc', 'hero', 'villain', 'player', 'adventurer'] },
  { name: 'User',        component: User,        keywords: ['character', 'person', 'npc', 'individual', 'humanoid', 'mortal'] },
  { name: 'Users',       component: Users,       keywords: ['faction', 'group', 'party', 'band', 'fellowship', 'duo', 'pair'] },
  { name: 'UsersThree',  component: UsersThree,  keywords: ['faction', 'guild', 'council', 'trio', 'organization', 'group', 'alliance'] },
  { name: 'Crown',       component: Crown,       keywords: ['ruler', 'king', 'queen', 'royalty', 'noble', 'monarch', 'emperor', 'authority'] },
  { name: 'MaskHappy',   component: MaskHappy,   keywords: ['disguise', 'rogue', 'thief', 'spy', 'actor', 'secret', 'infiltrator'] },
  { name: 'Ghost',       component: Ghost,       keywords: ['undead', 'spirit', 'wraith', 'specter', 'haunting', 'ethereal', 'apparition'] },
  { name: 'Skull',       component: Skull,       keywords: ['death', 'undead', 'evil', 'demon', 'necromancer', 'dark', 'lich', 'monster'] },
  { name: 'Star',        component: Star,        keywords: ['hero', 'chosen', 'legend', 'famous', 'destiny', 'celestial', 'divine'] },
  { name: 'Eye',         component: Eye,         keywords: ['spy', 'watcher', 'seer', 'observer', 'secret', 'vision', 'oracle', 'beholder'] },
  { name: 'Handshake',   component: Handshake,   keywords: ['ally', 'treaty', 'deal', 'merchant', 'diplomat', 'trade', 'agreement'] },
  { name: 'Shield',      component: Shield,      keywords: ['warrior', 'fighter', 'guard', 'paladin', 'protector', 'defender', 'knight'] },
  { name: 'ShieldPlus',  component: ShieldPlus,  keywords: ['faction', 'order', 'knight', 'crest', 'heraldry', 'guild', 'emblem'] },
  { name: 'ShieldCheck', component: ShieldCheck, keywords: ['paladin', 'holy', 'guardian', 'sworn', 'justice', 'lawful', 'divine'] },
  { name: 'Person',      component: Person,      keywords: ['character', 'humanoid', 'commoner', 'mortal', 'figure', 'individual'] },
  { name: 'Detective',   component: Detective,   keywords: ['detective', 'investigator', 'spy', 'mystery', 'sleuth', 'inquisitor', 'rogue'] },

  // Places & Locations
  { name: 'MapPin',      component: MapPin,      keywords: ['location', 'place', 'landmark', 'destination', 'point', 'site', 'marker'] },
  { name: 'MapTrifold',  component: MapTrifold,  keywords: ['map', 'cartography', 'exploration', 'world', 'region', 'territory', 'journey'] },
  { name: 'CastleTurret', component: CastleTurret, keywords: ['castle', 'fortress', 'stronghold', 'keep', 'dungeon', 'tower', 'citadel'] },
  { name: 'House',       component: House,       keywords: ['house', 'home', 'inn', 'tavern', 'town', 'village', 'dwelling', 'shop'] },
  { name: 'Mountains',   component: Mountains,   keywords: ['mountain', 'peak', 'highland', 'cave', 'wilderness', 'dwarven', 'range'] },
  { name: 'Tree',        component: Tree,        keywords: ['forest', 'woods', 'nature', 'wilderness', 'grove', 'druid', 'elf', 'fey'] },
  { name: 'Door',        component: Door,        keywords: ['entrance', 'portal', 'dungeon', 'room', 'passage', 'gateway', 'threshold'] },
  { name: 'Compass',     component: Compass,     keywords: ['navigation', 'exploration', 'travel', 'direction', 'journey', 'expedition'] },
  { name: 'Globe',       component: Globe,       keywords: ['world', 'realm', 'kingdom', 'empire', 'planet', 'sphere', 'cosmic'] },
  { name: 'Island',      component: Island,      keywords: ['island', 'coast', 'sea', 'tropical', 'isolated', 'archipelago', 'shore'] },
  { name: 'Tent',        component: Tent,        keywords: ['camp', 'wilderness', 'travel', 'nomad', 'barbarian', 'expedition', 'ranger'] },
  { name: 'Lighthouse',  component: Lighthouse,  keywords: ['lighthouse', 'port', 'coast', 'harbor', 'beacon', 'sea', 'navigation'] },
  { name: 'Church',      component: Church,      keywords: ['temple', 'church', 'shrine', 'holy', 'religious', 'divine', 'cathedral', 'sanctuary'] },
  { name: 'Anchor',      component: Anchor,      keywords: ['port', 'harbor', 'sea', 'naval', 'docks', 'pirate', 'ship', 'sailing'] },
  { name: 'Warehouse',   component: Warehouse,   keywords: ['warehouse', 'storage', 'guild', 'merchant', 'trade', 'depot', 'vault', 'stockpile'] },
  { name: 'Boat',        component: Boat,        keywords: ['boat', 'ship', 'sea', 'river', 'naval', 'sailing', 'pirate', 'voyage'] },

  // Items & Artifacts
  { name: 'Backpack',    component: Backpack,    keywords: ['item', 'bag', 'travel', 'adventurer', 'pack', 'gear', 'equipment'] },
  { name: 'Key',         component: Key,         keywords: ['key', 'unlock', 'secret', 'access', 'lock', 'treasure', 'mystery'] },
  { name: 'Diamond',     component: Diamond,     keywords: ['gem', 'jewel', 'treasure', 'rare', 'valuable', 'crystal', 'gemstone'] },
  { name: 'Scroll',      component: Scroll,      keywords: ['scroll', 'spell', 'map', 'document', 'rune', 'magic', 'writing', 'prophecy'] },
  { name: 'Flask',       component: Flask,       keywords: ['potion', 'flask', 'alchemy', 'poison', 'brew', 'magic', 'elixir', 'experiment'] },
  { name: 'Fire',        component: Fire,        keywords: ['fire', 'flame', 'magic', 'destruction', 'dragon', 'elemental', 'pyromancer'] },
  { name: 'Lightning',   component: Lightning,   keywords: ['lightning', 'storm', 'magic', 'thunder', 'electric', 'power', 'tempest'] },
  { name: 'Snowflake',   component: Snowflake,   keywords: ['ice', 'cold', 'frost', 'winter', 'blizzard', 'frozen', 'magic', 'elemental'] },
  { name: 'Coins',       component: Coins,       keywords: ['gold', 'money', 'wealth', 'treasure', 'merchant', 'reward', 'economy'] },
  { name: 'Lock',        component: Lock,        keywords: ['lock', 'secret', 'vault', 'hidden', 'dungeon', 'prison', 'sealed', 'forbidden'] },
  { name: 'Hammer',      component: Hammer,      keywords: ['smith', 'craft', 'forge', 'dwarf', 'weapon', 'build', 'construction'] },
  { name: 'Knife',       component: Knife,       keywords: ['dagger', 'knife', 'rogue', 'assassin', 'weapon', 'blade', 'stealth', 'backstab'] },
  { name: 'Package',     component: Package,     keywords: ['chest', 'crate', 'loot', 'cargo', 'trade', 'merchant', 'goods', 'reward'] },
  { name: 'Trophy',      component: Trophy,      keywords: ['victory', 'champion', 'achievement', 'glory', 'conquest', 'quest', 'reward'] },
  { name: 'Sword',       component: Sword,       keywords: ['sword', 'weapon', 'warrior', 'fighter', 'combat', 'blade', 'knight', 'battle'] },
  { name: 'Axe',         component: Axe,         keywords: ['axe', 'weapon', 'warrior', 'barbarian', 'dwarf', 'battle', 'combat', 'berserker'] },

  // Story & Events
  { name: 'BookOpen',    component: BookOpen,    keywords: ['story', 'lore', 'history', 'legend', 'chronicle', 'knowledge', 'scholar', 'bard'] },
  { name: 'Book',        component: Book,        keywords: ['book', 'tome', 'spell', 'knowledge', 'library', 'scholar', 'wizard', 'study'] },
  { name: 'Bell',        component: Bell,        keywords: ['event', 'alarm', 'warning', 'announcement', 'alert', 'signal', 'call'] },
  { name: 'Warning',     component: Warning,     keywords: ['danger', 'threat', 'warning', 'hazard', 'enemy', 'evil', 'caution'] },
  { name: 'Sparkle',     component: Sparkle,     keywords: ['magic', 'special', 'divine', 'mystical', 'enchanted', 'blessed', 'arcane'] },
  { name: 'Heart',       component: Heart,       keywords: ['love', 'romance', 'loyalty', 'devotion', 'bond', 'companion', 'relationship'] },
  { name: 'Moon',        component: Moon,        keywords: ['night', 'magic', 'mystery', 'darkness', 'lunar', 'werewolf', 'celestial'] },
  { name: 'Sun',         component: Sun,         keywords: ['light', 'day', 'holy', 'divine', 'celestial', 'paladin', 'radiance', 'dawn'] },
  { name: 'Wind',        component: Wind,        keywords: ['wind', 'air', 'speed', 'storm', 'elemental', 'ranger', 'druid', 'swift'] },
  { name: 'Feather',     component: Feather,     keywords: ['feather', 'bird', 'light', 'aerial', 'elf', 'druid', 'writing', 'bard'] },
  { name: 'Hourglass',   component: Hourglass,   keywords: ['time', 'countdown', 'ancient', 'prophecy', 'fate', 'deadline', 'eternal'] },
  { name: 'Target',      component: Target,      keywords: ['assassination', 'quest', 'goal', 'objective', 'hunt', 'combat', 'ranger'] },
  { name: 'Flag',        component: Flag,        keywords: ['faction', 'banner', 'kingdom', 'nation', 'allegiance', 'war', 'conquest'] },
  { name: 'Question',    component: Question,    keywords: ['mystery', 'unknown', 'quest', 'riddle', 'secret', 'investigation', 'enigma'] },
  { name: 'Rainbow',     component: Rainbow,     keywords: ['rainbow', 'magic', 'illusion', 'wonder', 'fairy', 'enchantment', 'color'] },
  { name: 'Scales',      component: Scales,      keywords: ['justice', 'law', 'balance', 'paladin', 'judge', 'order', 'neutral', 'merchant'] },

  // Nature & Creatures
  { name: 'Bug',         component: Bug,         keywords: ['curse', 'plague', 'vermin', 'druid', 'nature', 'disease', 'insect', 'swarm'] },
  { name: 'Bird',        component: Bird,        keywords: ['messenger', 'scout', 'druid', 'sky', 'freedom', 'familiar', 'raven', 'owl'] },
  { name: 'Fish',        component: Fish,        keywords: ['sea', 'river', 'fishing', 'coast', 'druid', 'water', 'aquatic', 'merfolk'] },
  { name: 'PawPrint',    component: PawPrint,    keywords: ['animal', 'beast', 'druid', 'ranger', 'familiar', 'companion', 'wolf', 'bear'] },
  { name: 'Leaf',        component: Leaf,        keywords: ['nature', 'druid', 'forest', 'elf', 'wilderness', 'growth', 'plant', 'herbalist'] },
  { name: 'Binoculars',  component: Binoculars,  keywords: ['scout', 'ranger', 'spy', 'lookout', 'watch', 'search', 'hunt', 'explore'] },
  { name: 'Guitar',      component: Guitar,      keywords: ['bard', 'music', 'tavern', 'performance', 'entertainment', 'art', 'song'] },
  { name: 'Coffee',      component: Coffee,      keywords: ['tavern', 'inn', 'rest', 'food', 'merchant', 'trade', 'town', 'civilization'] },
]

export const getIcon = (name) => ICON_REGISTRY.find(i => i.name === name)?.component

export const recommendIcons = (label, count = 8) => {
  if (!label.trim()) return []
  const words = label.toLowerCase().split(/\W+/).filter(Boolean)
  return ICON_REGISTRY
    .map(icon => ({
      ...icon,
      score: words.reduce((s, word) =>
        s + icon.keywords.filter(kw => kw.includes(word) || word.includes(kw)).length, 0
      ),
    }))
    .filter(i => i.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
}
