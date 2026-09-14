"use client";

import { useState } from "react";
import { PasswordInput } from "@/app/components/PasswordInput";

export function RegistrationForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      const result = await response.json() as { url?: string; errors?: Record<string, string>; message?: string };
      if (response.ok && result.url) return window.location.assign(result.url);
      setErrors({ ...(result.errors ?? {}), ...(result.message ? { form: result.message } : {}) });
    } catch {
      setErrors({ form: "Тіркелу мүмкін болмады. Интернет байланысын тексеріңіз." });
    } finally {
      setSubmitting(false);
    }
  }

  return <form className="login-form" onSubmit={submit} noValidate>
    <p className="eyebrow dark">Тіркелу</p>
    <h2>Тұрақты тіркелгі жасау</h2>
    <p>Мүшелік өтінішін кейін, электрондық пошта расталған соң толтырасыз.</p>
    {errors.form && <div className="form-alert" role="alert">{errors.form}</div>}
    <label className={errors.email ? "field-invalid" : undefined}>Электрондық пошта
      <input type="email" name="email" required autoComplete="email" placeholder="name@example.kz" aria-invalid={Boolean(errors.email)} />
      {errors.email && <small className="field-error">{errors.email}</small>}
    </label>
    <PasswordInput label="Құпиясөз" name="password" autoComplete="new-password" error={errors.password} />
    <PasswordInput label="Құпиясөзді қайталау" name="passwordConfirmation" autoComplete="new-password" error={errors.passwordConfirmation} />
    <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Тіркелуде…" : "Тіркелгі жасау"}</button>
    <small>Тіркелу мүшелікке өтініш жібермейді. Бір аккаунт бір тұрақты профильге байланысады.</small>
  </form>;
}

