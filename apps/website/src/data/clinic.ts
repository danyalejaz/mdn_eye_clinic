export const portalUrl = import.meta.env.PUBLIC_PORTAL_URL ?? "http://127.0.0.1:5173";

export const images = {
  consult:
    "https://lh3.googleusercontent.com/aida/ALJJyrAmnjUHG0UPC4r0CujMboET7P-ezpHXl0SFmbY0IRwCq4YGcWkwjl1zci5K9L4lYOahxr2_nz8V06SGCvTMouJv_QUIYzj1PdK3Knd0cltGUYczwM50h67eibsDxBwGIKgxmGmyGTKPu2QWs2_z2sbNQVqgHAx7f8C657ejLQLBqOPMatRANuNkAMBqe1KggJSTZn3syg-ZUfJmEtLP1qLH0igfNgCjbyUj0ET8K4_t86_GO7uH5X0Uy2XihMGduGMeUi1VMvWz3w",
  waiting:
    "https://lh3.googleusercontent.com/aida/ALJJyrDTmLU4kBO8cg6LgBKHBH30vQN0KzyW4lrsLkLZ8ZXlN9pDISWIiTnbDSlunvM1w_Jh9V8dT2kepCdXTbKuiInUWplGO56Vi8J3Qf6yvVyIDrC1hx5wlaP2RdC1h2q-K-PGUn5sq0RZ0F88hAyiNSe3Rs6KpN14LYwjaUQuStnbuZn22m7Nq1LN8HpOuNxnO4uhVosIaCjYkwrObcLLvIUp4u0zlG2IorRPquvG1nh28xSWG12yDN_C1DfVo1WP",
  entrance:
    "https://lh3.googleusercontent.com/aida/ALJJyrBKo7JYQAsq9r2Lv68rHyH2wpZKdihHBVhlmEt2MFC8wg3Zo2IP00iIv5q63jazQr-DFT4X1Hh4oxZmc-N3M3wcVtGhXgnelcll09f2UItQRn9LUr46S4rlZNWMfJ58IlEUZhTLR85zYp9aoYFY5SjpTkKZMsvKu7n-S-joSVWbFUC-X7GXAzRUXkGWH_akOAmvYOevNJwy1qCVmTpPVUy1oWCck_9GuvRCYxbwfUs5hj-sU_dZx2Os4eBatJ1BfKE9pWynKm8k",
  doctorA:
    "https://lh3.googleusercontent.com/aida/ALJJyrB0eTvcADPBTj0aSmF2PZkZKn5Bbuidc4OUTR-god_xa4noeTxCAvTKmgU7J7vPlJzhGgu2CMXvKbGg6gWeLS6rqKO0zN_vLV6OEdlJgcLPKrXcPVvniXMqtIQocquvMWCAiYrE2Vbs0vDIrr4oD-LSdOxpEHWqtj4O_UnJn7xcGXkLG947QDYLIk28ZHTUVZNwRQsrm0M1VuSHXqM_TT4f_kGIzrXid8gc2-UItp2o7w4PGDLCF0knOJQ0vts",
  doctorB:
    "https://lh3.googleusercontent.com/aida/ALJJyrB9wGnfiSIhcr8t4bXf8gDSrbvepRE_57jAjLOcoQbcvWPN6cI7cvNAS06vrt15rWTVsAQLwIiDQ07Q12M9zLECvr0pitoZQaKywvY0-eEgGwp3axzocJHjtO9bQ28fQ_Jt5v1eyti2OBPsLvQDnX1BrxT1D8JBiY7JugT1AsPRcnSeRPx1M61Ygsf34pcWIqopHfDv6gSwg0mBeWdlmxvVU3kddFegJscD9XsVcShkKKfOKBjkAdwNbqzlYCvdIQ",
} as const;

export const doctors = [
  {
    name: "Demo Doctor A",
    specialty: "General Medicine · Qualification placeholder",
    hours: "Mon–Sat · 9:00 AM – 2:00 PM · Rs. 1,500",
    image: images.doctorA,
    alt: "Portrait of Demo Doctor A",
  },
  {
    name: "Demo Doctor B",
    specialty: "Family Medicine · Qualification placeholder",
    hours: "Mon–Fri · 2:00 PM – 7:00 PM · Rs. 1,500",
    image: images.doctorB,
    alt: "Portrait of Demo Doctor B",
  },
  {
    name: "Demo Doctor C",
    specialty: "Preventive Care · Qualification placeholder",
    hours: "Tue, Thu, Sat · 10:00 AM – 4:00 PM · Rs. 1,500",
    image: images.consult,
    alt: "Portrait of Demo Doctor C",
  },
] as const;

export const services = [
  {
    id: "01",
    title: "General Medicine",
    summary:
      "Comprehensive primary outpatient evaluations, acute illness care, and everyday health guidance.",
    image: images.waiting,
  },
  {
    id: "02",
    title: "Specialist Consultations",
    summary:
      "Focused clinical assessments for chronic blood pressure, diabetes, and respiratory conditions.",
    image: images.consult,
  },
  {
    id: "03",
    title: "Preventive Healthcare",
    summary: "Routine wellness reviews, risk screening, and practical long-term health planning.",
    image: images.waiting,
  },
  {
    id: "04",
    title: "Follow-up Care",
    summary: "Structured progress checks, medication adjustments, and released visit summaries.",
    image: images.doctorA,
  },
] as const;

export const faqs: { question: string; answer: string; open?: boolean }[] = [
  {
    question: "How do I book an appointment?",
    answer:
      "Use the booking bar above to choose a doctor and preferred date, or call our reception desk during opening hours.",
    open: true,
  },
  {
    question: "Can I visit without an appointment?",
    answer:
      "Walk-in visits are accommodated when same-day slots are open, though scheduled appointments are prioritized.",
  },
  {
    question: "How do I reschedule my appointment?",
    answer:
      "Sign in to the Patient Portal to select a new available slot, or contact reception with your booking reference.",
  },
  {
    question: "What should I bring to my consultation?",
    answer:
      "Please bring your booking reference, any prior prescriptions or medication list, and arrive 15 minutes early.",
  },
  {
    question: "How do I access my prescriptions?",
    answer:
      "Doctor-approved prescriptions and released visit summaries are available in the Patient Portal once finalized.",
  },
  {
    question: "Where is the clinic located & what are the opening hours?",
    answer:
      "Clinic Name is located in Mardan, Pakistan and is open Monday to Saturday from 9:00 AM to 8:00 PM.",
  },
] as const;
