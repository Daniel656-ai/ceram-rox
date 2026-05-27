import { dbClient } from "./client";

export const auth = {
  getUser: () => dbClient.auth.getUser(),
  getSession: () => dbClient.auth.getSession(),
  signInWithPassword: (creds: { email: string; password: string }) =>
    dbClient.auth.signInWithPassword(creds),
  signUp: (creds: Parameters<typeof dbClient.auth.signUp>[0]) => dbClient.auth.signUp(creds),
  signOut: () => dbClient.auth.signOut(),
  signInWithOAuth: (params: Parameters<typeof dbClient.auth.signInWithOAuth>[0]) =>
    dbClient.auth.signInWithOAuth(params),
  onAuthStateChange: (cb: Parameters<typeof dbClient.auth.onAuthStateChange>[0]) =>
    dbClient.auth.onAuthStateChange(cb),
  resetPasswordForEmail: (email: string, options?: Parameters<typeof dbClient.auth.resetPasswordForEmail>[1]) =>
    dbClient.auth.resetPasswordForEmail(email, options),
  updateUser: (attrs: Parameters<typeof dbClient.auth.updateUser>[0]) => dbClient.auth.updateUser(attrs),
};
