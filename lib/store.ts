import { configureStore, createAction, createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Game, User } from "./game";

export type Profile = {
    username: string; name: string; email: string | null; provider: string;
    best: number; coins: number; games: number; mfaEnabled: boolean;
};
type ProfileError = { message: string; unauthenticated: boolean };
type AccountState = {
    user: User | null;
    profile: Profile | null;
    profileStatus: "idle" | "loading" | "succeeded" | "failed" | "unauthenticated";
    profileError: string;
    profileRequestId: string | null;
};
const initialAccount: AccountState = {
    user: null, profile: null, profileStatus: "idle", profileError: "", profileRequestId: null,
};
export const clearSession = createAction("session/cleared");
export const fetchProfile = createAsyncThunk<Profile, void, { rejectValue: ProfileError }>(
    "account/fetchProfile",
    async (_, { signal, rejectWithValue }) => {
        try {
            const response = await fetch("/api/profile", { cache: "no-store", signal });
            if (response.status === 401) return rejectWithValue({ message: "Please log in to view your profile.", unauthenticated: true });
            const data = await response.json() as { profile?: Profile; error?: string };
            if (!response.ok || !data.profile) return rejectWithValue({ message: data.error || "Your profile could not be loaded.", unauthenticated: false });
            return data.profile;
        } catch (error) {
            return rejectWithValue({ message: error instanceof Error ? error.message : "Your profile could not be loaded.", unauthenticated: false });
        }
    },
);
const accountSlice = createSlice({
    name: "account",
    initialState: initialAccount,
    reducers: {
        setCurrentUser(state, action: PayloadAction<User | null>) {
            // A sign-in or session refresh replaces the account snapshot.
            // It also invalidates requests started for an earlier session.
            return { ...initialAccount, user: action.payload };
        },
    },
    extraReducers: builder => {
        builder.addCase(clearSession, () => ({ ...initialAccount }))
            .addCase(fetchProfile.pending, (state, action) => {
                state.profileRequestId = action.meta.requestId;
                state.profileStatus = "loading";
                state.profileError = "";
            })
            .addCase(fetchProfile.fulfilled, (state, action) => {
                if (state.profileRequestId !== action.meta.requestId) return;
                state.profile = action.payload;
                const { name, best, games, coins } = action.payload;
                state.user = { name, best, games, coins };
                state.profileStatus = "succeeded";
                state.profileRequestId = null;
            })
            .addCase(fetchProfile.rejected, (state, action) => {
                if (state.profileRequestId !== action.meta.requestId) return;
                state.profile = null;
                state.profileStatus = action.payload?.unauthenticated ? "unauthenticated" : "failed";
                state.profileError = action.payload?.message || "Your profile could not be loaded.";
                state.profileRequestId = null;
                if (action.payload?.unauthenticated) state.user = null;
            });
    },
});
const gameSlice = createSlice({
    name: "game",
    initialState: { current: null as Game | null },
    reducers: {
        setCurrentGame(state, action: PayloadAction<Game | null>) { state.current = action.payload; },
    },
    extraReducers: builder => { builder.addCase(clearSession, state => { state.current = null; }); },
});
export const { setCurrentUser } = accountSlice.actions;
export const { setCurrentGame } = gameSlice.actions;

// A fresh store for each app instance prevents sharing account data across SSR requests.
export function makeStore() {
    return configureStore({
        reducer: { account: accountSlice.reducer, game: gameSlice.reducer },
        devTools: process.env.NODE_ENV !== "production",
    });
}
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
