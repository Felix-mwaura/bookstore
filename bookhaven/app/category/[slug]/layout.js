import { SITE_NAME, absoluteUrl } from "../../lib/site";

const DESCRIPTIONS = {
  "self-help": "Self-help books on habits, mindset and personal growth, delivered anywhere in Kenya.",
  finance: "Personal finance and investing books for Kenyan readers — from first savings to long-term wealth.",
  productivity: "Productivity and focus books to help you do meaningful work without burning out.",
  psychology: "Psychology books on how the mind works, why we decide the way we do, and how to decide better.",
  history: "History books that explain how the world — and Kenya — came to be the way it is.",
  philosophy: "Philosophy books on power, ethics, meaning and how to live well.",
  fiction: "Fiction from celebrated authors — novels and stories worth losing an evening to.",
  biography: "Biographies and memoirs from people who changed their corner of the world.",
};

function titleFromSlug(slug) {
  const known = Object.keys(DESCRIPTIONS).find((key) => key === slug);
  if (known) return known.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return String(slug || "").split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const name = titleFromSlug(slug);
  const description = DESCRIPTIONS[slug] || `Browse ${name} books at ${SITE_NAME}, delivered across Kenya.`;

  return {
    title: `${name} Books · ${SITE_NAME}`,
    description,
    alternates: { canonical: `/category/${slug}` },
    openGraph: {
      title: `${name} Books — ${SITE_NAME}`,
      description,
      url: absoluteUrl(`/category/${slug}`),
      siteName: SITE_NAME,
      type: "website",
    },
  };
}

export default function CategoryLayout({ children }) {
  return children;
}
