import { supabase } from "./supabase";

export async function signInWithEmail(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}) {
  return supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
      },
    },
  });
}

export async function ensureProfile(userId: string, input: {
  firstName: string;
  lastName: string;
  phone: string;
}) {
  return supabase.from("profiles").upsert({
    user_id: userId,
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
  });
}

export async function createAthleteProfile(userId: string) {
  return supabase.from("athletes").upsert(
    {
      user_id: userId,
      primary_sport: "crossfit",
      experience: "beginner",
    },
    { onConflict: "user_id" },
  );
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { user: null, error };
  return { user: data.user, error: null };
}

export async function signOut() {
  return supabase.auth.signOut();
}
