export interface SessionUserDto {
  id: string;
  athleteId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "athlete" | "coach" | "head_coach" | "admin";
  primarySport: string;
}

export async function signInWithEmail(
  email: string,
  password: string,
): Promise<{ data: { user: SessionUserDto | null }; error: { message: string } | null }> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: SessionUserDto;
      error?: string;
    };

    if (!res.ok || !json.ok || !json.user) {
      return {
        data: { user: null },
        error: { message: json.error ?? "ایمیل یا رمز عبور صحیح نیست." },
      };
    }

    return { data: { user: json.user }, error: null };
  } catch {
    return {
      data: { user: null },
      error: { message: "ارتباط با سرور برقرار نشد. لطفاً اتصال اینترنت خود را بررسی کنید." },
    };
  }
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}): Promise<{ data: { user: SessionUserDto | null }; error: { message: string } | null }> {
  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "include",
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      user?: SessionUserDto;
      error?: string;
    };

    if (!res.ok || !json.ok || !json.user) {
      return {
        data: { user: null },
        error: { message: json.error ?? "ثبت‌نام انجام نشد. لطفاً دوباره تلاش کنید." },
      };
    }

    return { data: { user: json.user }, error: null };
  } catch {
    return {
      data: { user: null },
      error: { message: "ارتباط با سرور برقرار نشد. لطفاً دوباره تلاش کنید." },
    };
  }
}

/**
 * Retained for backward compatibility: `/api/auth/register` now creates
 * the user and athlete profile atomically in a single server request.
 */
export async function ensureProfile(
  _userId: string,
  _input: { firstName: string; lastName: string; phone: string },
): Promise<{ error: null }> {
  return { error: null };
}

export async function createAthleteProfile(_userId: string): Promise<{ error: null }> {
  return { error: null };
}

export async function getCurrentUser(): Promise<{
  user: SessionUserDto | null;
  error: { message: string } | null;
}> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
    });
    if (!res.ok) {
      return { user: null, error: { message: "UNAUTHENTICATED" } };
    }
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      authenticated?: boolean;
      user?: SessionUserDto | null;
    };
    if (!json.ok || !json.authenticated || !json.user) {
      return { user: null, error: { message: "UNAUTHENTICATED" } };
    }
    return { user: json.user, error: null };
  } catch {
    return { user: null, error: { message: "NETWORK_ERROR" } };
  }
}

export async function signOut(): Promise<{ error: { message: string } | null }> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    return { error: null };
  } catch {
    return { error: { message: "خطا در خروج از حساب کاربری." } };
  }
}
