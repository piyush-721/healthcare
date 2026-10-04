import { combineReducers, configureStore } from "@reduxjs/toolkit";

import { api } from "@/lib/api/baseApi";

import authReducer from "./slices/authSlice";
import profileReducer from "./slices/profileSlice";
import toastReducer from "./slices/toastSlice";

/**
 * Redux holds genuinely global client state (session, active profile, toasts).
 * Server data lives in the RTK Query cache, which is keyed, deduplicated and
 * invalidated by tags — it is not copied into hand-written slices.
 */
export const rootReducer = combineReducers({
  auth: authReducer,
  profile: profileReducer,
  toasts: toastReducer,
  [api.reducerPath]: api.reducer,
});

export function makeStore(preloadedState?: Partial<RootState>) {
  return configureStore({
    reducer: rootReducer,
    preloadedState,
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });
}

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof makeStore>;
export type AppDispatch = AppStore["dispatch"];
