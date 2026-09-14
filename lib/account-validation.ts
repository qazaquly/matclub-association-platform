import { z } from "zod";

export const emailAddressSchema = z.string().trim().toLowerCase()
  .min(1, "Электрондық поштаңызды енгізіңіз.")
  .email("Электрондық пошта мекенжайын дұрыс енгізіңіз.")
  .max(180, "Электрондық пошта мекенжайы тым ұзын.");

export const passwordSchema = z.string()
  .min(7, "Құпиясөз кемінде 7 таңбадан тұруы керек.")
  .max(128, "Құпиясөз тым ұзын.");

export const registrationSchema = z.object({
  email: emailAddressSchema,
  password: passwordSchema,
  passwordConfirmation: z.string().min(1, "Құпиясөзді қайталап енгізіңіз."),
}).superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirmation"], message: "Құпиясөздер бірдей емес." });
  }
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, "Қалпына келтіру сілтемесі жарамсыз."),
  password: passwordSchema,
  passwordConfirmation: z.string().min(1, "Құпиясөзді қайталап енгізіңіз."),
}).superRefine((value, context) => {
  if (value.password !== value.passwordConfirmation) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["passwordConfirmation"], message: "Құпиясөздер бірдей емес." });
  }
});

export function validationErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
