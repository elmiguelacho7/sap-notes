import { redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function LegacyActivitiesRedirect(props: PageProps) {
  const params = await Promise.resolve(props.params);
  redirect(`/projects/${params.id}/planning/activities`);
}
