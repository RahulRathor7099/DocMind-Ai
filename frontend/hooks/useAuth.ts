"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import { User } from "@/lib/types";

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, otp?: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const response = await api.auth.login({ email, password });
      const { access_token, user } = response;
      
      if (typeof window !== "undefined") {
        localStorage.setItem("docmind_token", access_token);
        localStorage.setItem("docmind_user", JSON.stringify(user));
      }
      
      set({ user, token: access_token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  register: async (name: string, email: string, password: string, otp?: string) => {
    set({ isLoading: true });
    try {
      const response = await api.auth.register({ name, email, password, otp });
      const { access_token, user } = response;
      
      if (typeof window !== "undefined") {
        localStorage.setItem("docmind_token", access_token);
        localStorage.setItem("docmind_user", JSON.stringify(user));
      }
      
      set({ user, token: access_token, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("docmind_token");
      localStorage.removeItem("docmind_user");
    }
    set({ user: null, token: null, isAuthenticated: false });
    window.location.href = "/login";
  },

  loadUser: async () => {
    if (typeof window === "undefined") return;
    
    const token = localStorage.getItem("docmind_token");
    const storedUser = localStorage.getItem("docmind_user");
    
    if (!token) {
      set({ isAuthenticated: false });
      return;
    }

    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        set({ user, token, isAuthenticated: true });
      } catch {
        // ignore parse error
      }
    }

    try {
      const user = await api.auth.me();
      if (typeof window !== "undefined") {
        localStorage.setItem("docmind_user", JSON.stringify(user));
      }
      set({ user, token, isAuthenticated: true });
    } catch {
      set({ isAuthenticated: false });
    }
  },

  setUser: (user: User) => {
    set({ user });
  },
}));

// Hook alias
export function useAuth() {
  return useAuthStore();
}
