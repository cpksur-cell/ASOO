import {
  Building2, CreditCard, ExternalLink, FileText, Globe, LayoutGrid,
  Map, Scale, Users, UserCheck, type LucideIcon,
} from 'lucide-react'

/**
 * Icon names are stored as data (CMS block config, external link records), so
 * they must be resolved from a string. The map is an explicit allow-list —
 * a CMS editor cannot introduce an arbitrary icon, and an unknown name
 * degrades to a sensible default rather than crashing the page.
 *
 * One icon family, one stroke weight, throughout. ui-ux-pro-max §4.
 */
const registry: Record<string, LucideIcon> = {
  'building-2': Building2,
  'credit-card': CreditCard,
  'external-link': ExternalLink,
  'file-text': FileText,
  globe: Globe,
  'layout-grid': LayoutGrid,
  map: Map,
  scale: Scale,
  users: Users,
  'user-check': UserCheck,
}

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = registry[name] ?? Globe
  return <Cmp className={className} aria-hidden strokeWidth={1.75} />
}
