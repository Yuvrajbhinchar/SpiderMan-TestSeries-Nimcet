import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  access: {},
  loading: true,
  initialized: false,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    setAuth(state, action) {
      state.user = action.payload.user;
      state.access = action.payload.access || {};
      state.loading = false;
      state.initialized = true;
    },

    clearAuth(state) {
      state.user = null;
      state.access = {};
      state.loading = false;
      state.initialized = true;
    },

    setAuthLoading(state, action) {
      state.loading = action.payload;
    },
  },
});

export const {
  setAuth,
  clearAuth,
  setAuthLoading,
} = authSlice.actions;

export default authSlice.reducer;