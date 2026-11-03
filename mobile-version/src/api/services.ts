/**
 * Mobile service layer. Each object calls the same REST paths as the web client.
 * Screens import the modules they render; this file is the full map.
 */
export { activityAPI } from './activity';
export { adminAPI } from './admin';
export { adviceAPI } from './advice';
export { aiGuidesAPI } from './aiGuides';
export { appearanceAPI } from './appearance';
export { authAPI } from './auth';
export { chatAPI } from './chat';
export { chatEngagementAPI } from './chatEngagement';
export { compatibilityAPI } from './compatibility';
export { confessionAPI } from './confession';
export { connectionJourneyAPI } from './connectionJourney';
export { connectionsAPI } from './connections';
export { dateMatchAPI } from './dateMatch';
export { discoverAPI } from './discover';
export { disinterestAPI } from './disinterest';
export { eventsAPI } from './events';
export { fashionAPI } from './fashion';
export { gamificationAPI } from './gamification';
export { guideHelpAPI } from './guideHelp';
export { guideProgramAPI } from './guideProgram';
export { healthAPI } from './health';
export { improvementAPI, coachVoteAPI, walletAPI, paymentAPI } from './improvement';
export { intimacyAPI } from './intimacy';
export { nearbyAPI } from './nearby';
export { personalSafetyAPI } from './personalSafety';
export { postsAPI } from './posts';
export { premiumAPI } from './premium';
export { profileAPI } from './profile';
export { ratingsAPI } from './ratings';
export { relationshipAPI } from './relationship';
export { reportsAPI } from './reports';
export { reviewsAPI } from './reviews';
export { safetyAPI } from './safety';
export { schoolAPI } from './school';
export { settingsAPI } from './settings';
export { singleAgainAPI } from './singleAgain';
export { speedDateAPI } from './speedDate';
export { stripeAPI } from './stripe';
export { textingHelpAPI } from './textingHelp';
export { verificationAPI } from './verification';
export { voiceRecordingAPI } from './voiceRecording';
export { walkMatchAPI } from './walkMatch';
