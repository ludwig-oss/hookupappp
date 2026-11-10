export type WidgetId =
  | 'activity'
  | 'compatibility'
  | 'connections'
  | 'highlights'
  | 'lovefeed'
  | 'advice'
  | 'confession'
  | 'chat'
  | 'events'
  | 'help'
  | 'safety'
  | 'datematch'
  | 'scout'
  | 'settings';

export type MainTab = 'Connections' | 'Feed' | 'Communications' | 'Profile';

export const RELATIONSHIP_LOCKED: WidgetId[] = ['activity', 'connections', 'highlights', 'datematch'];

export function tabForWidget(id: WidgetId): MainTab {
  switch (id) {
    case 'lovefeed':
      return 'Feed';
    case 'chat':
    case 'advice':
    case 'confession':
    case 'activity':
      return 'Communications';
    case 'compatibility':
    case 'highlights':
    case 'safety':
    case 'help':
    case 'settings':
      return 'Profile';
    default:
      return 'Connections';
  }
}

export function tabHomeWidget(tab: MainTab, inRelationship: boolean): WidgetId | null {
  if (tab === 'Feed') return 'lovefeed';
  if (tab === 'Communications') return 'chat';
  if (tab === 'Profile') return null;
  return inRelationship ? null : 'connections';
}
