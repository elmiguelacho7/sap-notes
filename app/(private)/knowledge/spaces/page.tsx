"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect legacy "Spaces & Pages" route to Documents.
 * The section was renamed to "Documents"; internal concept of spaces/pages is unchanged.
 */
export default function KnowledgeSpacesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/knowledge/documents");
  }, [router]);
  return null;
}
