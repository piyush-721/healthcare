import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import { signedOut } from "./authSlice";

/**
 * Which person's health information the user is currently viewing (themselves,
 * a dependent, or someone they care for). `null` means "my own profile".
 */
type ProfileState = { activeProfileId: string | null };

const initialState: ProfileState = { activeProfileId: null };

const profileSlice = createSlice({
  name: "profile",
  initialState,
  reducers: {
    activeProfileChanged(state, action: PayloadAction<string | null>) {
      state.activeProfileId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(signedOut, () => initialState);
  },
});

export const { activeProfileChanged } = profileSlice.actions;
export default profileSlice.reducer;
