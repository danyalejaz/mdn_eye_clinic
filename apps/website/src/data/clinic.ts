export const portalUrl = import.meta.env.PUBLIC_PORTAL_URL ?? "http://127.0.0.1:5173";
export const launchMode = import.meta.env.PUBLIC_CLINIC_LAUNCH === "true";

export const faqs: { question: string; answer: string; open?: boolean }[] = [
  {
    question: "How do I book?",
    answer: "Choose a doctor and date, then select an available time. Sign in to confirm it. The time is not held until your booking is confirmed.",
    open: true,
  },
  {
    question: "Can I come without a booking?",
    answer: "Scheduled visits come first. Ask reception about a same-day opening when you call.",
  },
  {
    question: "How do I move or cancel?",
    answer: "Sign in with the patient account that made the booking, then choose another open time or cancel. The change is saved only when the clinic accepts it.",
  },
  {
    question: "What should I bring?",
    answer: "Your booking reference, a list of current medicines, and any earlier eye reports you already have. Arrive a few minutes early.",
  },
] as const;
