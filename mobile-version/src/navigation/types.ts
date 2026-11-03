export type AuthStackParamList = {
  Login: undefined;
};

export type MainTabParamList = {
  Connections: undefined;
  Feed: undefined;
  Chat: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  MainTabs: undefined;
  ChatThread: { otherUserId: string; name: string };
  Settings: undefined;
  Discover: undefined;
  DateMatch: undefined;
  Safety: undefined;
  Compatibility: undefined;
};
