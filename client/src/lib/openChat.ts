/** Open Communications with a user (ChatWidget + Dashboard listen for this). */
export function openChatWithUser(userId: string) {
  if (!userId) return;
  localStorage.setItem('chatSelectedUserId', userId);
  window.dispatchEvent(new CustomEvent('chat:open', { detail: { userId } }));
  window.dispatchEvent(new CustomEvent('chat:refresh'));
}
