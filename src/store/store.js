import { configureStore } from "@reduxjs/toolkit";

import authReducer from "./authSlice";
import testLibraryReducer from "./testLibrarySlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,

    testLibrary:
      testLibraryReducer,
  },
});