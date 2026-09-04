import EditorShell from "@/components/editor/EditorShell";

export default function ProjectPage({ params }: { params: { id: string } }) {
  return <EditorShell projectId={params.id} />;
}
