export const portalUrl = import.meta.env.PUBLIC_PORTAL_URL ?? "http://127.0.0.1:5173";

export const images = {
  hero: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1600&q=80",
  portraitA: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=1400&q=80",
  portraitB: "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=1400&q=80",
} as const;

export const faqs: { question: string; answer: string; open?: boolean }[] = [
  {
    question: "How do I book?",
    answer: "Choose a published doctor and a date, then open one of the free times. Sign in to confirm it. A time on this page is not held until that confirmation.",
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
