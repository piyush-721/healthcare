import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { User } from "@/types/api";

/**
 * Authentication state. The access token lives only in memory; the refresh
 * token is an HttpOnly cookie the JavaScript runtime can never read.
 */
export type AuthStatus = "unknown" | "authenticated" | "anonymous";

export type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  user: User | null;
};

const initialState: AuthState = {
  status: "unknown",
  accessToken: null,
  accessTokenExpiresAt: null,
  user: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    sessionEstablished(
      state,
      action: PayloadAction<{ access_token: string; access_token_expires_at: string; user: User }>,
    ) {
      state.status = "authenticated";
      state.accessToken = action.payload.access_token;
      state.accessTokenExpiresAt = action.payload.access_token_expires_at;
      state.user = action.payload.user;
    },
    userUpdated(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
    signedOut() {
      return { ...initialState, status: "anonymous" as const };
    },
  },
});

export const { sessionEstablished, userUpdated, signedOut } = authSlice.actions;
export default authSlice.reducer;
