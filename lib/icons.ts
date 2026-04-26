// lib/icons.ts
// Maps event_type / flag_type / agent_name to a lucide-react icon component.
// Importing icons individually keeps tree-shaking working.

import {
  Megaphone, Footprints, Building2, Scale, HeartHandshake, HandHeart,
  Users, BookOpen, Flame, Flower2, Wrench, Stethoscope, Zap, Palette,
  Ticket, ShoppingBag, PartyPopper, MapPin,
  ShieldAlert, Shield, CornerDownRight, AlertTriangle, AlertOctagon,
  HelpCircle, Plus, Home, Package, Ban, Car,
  Target, Telescope, Antenna, Eye, Link2, Star, Music2, Cog,
  Sparkles, Calendar,
  type LucideIcon,
} from 'lucide-react';

export const EVENT_TYPE_ICON: Record<string, LucideIcon> = {
  protest: Megaphone,
  march: Footprints,
  rally: Megaphone,
  town_hall: Building2,
  public_hearing: Scale,
  volunteer_opportunity: HandHeart,
  mutual_aid_distribution: HeartHandshake,
  community_meeting: Users,
  teach_in: BookOpen,
  vigil: Flame,
  commemoration: Flower2,
  skill_share: Wrench,
  clinic: Stethoscope,
  direct_action: Zap,
  cultural_event: Palette,
  free_public_program: Ticket,
  community_market: ShoppingBag,
  block_party: PartyPopper,
  other: MapPin,
};

export const FLAG_TYPE_ICON: Record<string, LucideIcon> = {
  ice_presence: ShieldAlert,
  police_presence: Shield,
  route_change: CornerDownRight,
  counter_protest: AlertTriangle,
  dispersal_warning: AlertOctagon,
  disinfo: HelpCircle,
  medical_aid: Plus,
  safe_space: Home,
  supplies_needed: Package,
  signup_full: Ban,
  transport_offer: Car,
  other: MapPin,
};

export const AGENT_ICON: Record<string, LucideIcon> = {
  intent_parse: Target,
  discovery: Telescope,
  harvester: Antenna,
  vision_extractor: Eye,
  dedup: Link2,
  recommender: Star,
  curator: Sparkles,
  scheduler: Calendar,
  safety_review: Shield,
  submission_audit: ShieldAlert,
  orchestrator: Music2,
};

export function getEventIcon(type: string): LucideIcon {
  return EVENT_TYPE_ICON[type] ?? MapPin;
}

export function getFlagIcon(type: string): LucideIcon {
  return FLAG_TYPE_ICON[type] ?? MapPin;
}

export function getAgentIcon(name: string): LucideIcon {
  return AGENT_ICON[name] ?? Cog;
}
