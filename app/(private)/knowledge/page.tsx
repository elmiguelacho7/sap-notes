"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, FolderOpen, FileText, Search } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { logSupabaseError } from "@/lib/logSupabaseError";
import {
  listSpaces,
  createSpace,
  listPages,
  createPage,
} from "@/lib/knowledgeService";
import type { KnowledgeSpace, KnowledgePage } from "@/lib/types/knowledge";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "@/components/ui/Modal";

export default function KnowledgePage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<KnowledgeSpace[]>([]);
  const [pages, setPages] = useState<KnowledgePage[]>([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalSpace, setModalSpace] = useState(false);
  const [modalPage, setModalPage] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceDesc, setNewSpaceDesc] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listSpaces(supabase, { projectId: null });
      setSpaces(list);
      if (list.length > 0 && !selectedSpaceId) {
        setSelectedSpaceId(list[0].id);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar espacios.");
      setSpaces([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSpaceId]);

  const loadPages = useCallback(async () => {
    if (!selectedSpaceId) {
      setPages([]);
      return;
    }
    try {
      const list = await listPages(supabase, selectedSpaceId);
      setPages(list);
    } catch {
      setPages([]);
    }
  }, [selectedSpaceId]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  // Temporary: sanity ping to surface Supabase/RLS errors for knowledge_spaces
  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      console.log("Supabase URL hostname:", url ? new URL(url).hostname : "MISSING");

      const { data: _ping, error: pingError } = await supabase
        .from("knowledge_spaces")
        .select("id")
        .limit(1);
      if (pingError) {
        logSupabaseError("knowledge/page.tsx sanity ping knowledge_spaces", pingError);
      }
    })();
  }, []);

  const handleCreateSpace = async (e: FormEvent) => {
    e.preventDefault();
    const name = newSpaceName.trim();
    if (!name) return;
    setSaving(true);
    setSaveError(null);
    try {
      const space = await createSpace(supabase, {
        projectId: null,
        name,
        description: newSpaceDesc.trim() || null,
      });
      setSpaces((prev) => [...prev, space]);
      setSelectedSpaceId(space.id);
      setNewSpaceName("");
      setNewSpaceDesc("");
      setModalSpace(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al crear espacio.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePage = async (e: FormEvent) => {
    e.preventDefault();
    const title = newPageTitle.trim();
    if (!title || !selectedSpaceId) return;
    setSaving(true);
    setSaveError(null);
    try {
      const page = await createPage(supabase, selectedSpaceId, title);
      setPages((prev) => [page, ...prev]);
      setNewPageTitle("");
      setModalPage(false);
      router.push(`/knowledge/${page.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al crear página.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Knowledge"
        actions={
          <>
            <Link href="/knowledge/search">
              <Button variant="secondary">
                <Search className="h-4 w-4" />
                Buscar
              </Button>
            </Link>
            <Button variant="secondary" onClick={() => { setSaveError(null); setModalSpace(true); }}>
              <Plus className="h-4 w-4" />
              New Space
            </Button>
            <Button
              disabled={!selectedSpaceId}
              onClick={() => { setSaveError(null); setModalPage(true); }}
            >
              <Plus className="h-4 w-4" />
              New Page
            </Button>
          </>
        }
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Spaces
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {loading ? (
              <p className="text-sm text-slate-500 px-2 py-4">Cargando…</p>
            ) : spaces.length === 0 ? (
              <p className="text-sm text-slate-500 px-2 py-4">
                No hay espacios. Crea uno con «New Space».
              </p>
            ) : (
              <ul className="space-y-0.5">
                {spaces.map((space) => (
                  <li key={space.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSpaceId(space.id)}
                      className={`w-full flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                        selectedSpaceId === space.id
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <FolderOpen className="h-4 w-4 shrink-0" />
                      <span className="truncate">{space.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 overflow-hidden">
          <CardHeader className="border-b border-slate-200 bg-slate-50/50">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Pages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            {!selectedSpaceId ? (
              <p className="text-sm text-slate-500">
                Selecciona un espacio para ver sus páginas.
              </p>
            ) : pages.length === 0 ? (
              <p className="text-sm text-slate-500">
                No hay páginas en este espacio. Crea una con «New Page».
              </p>
            ) : (
              <ul className="space-y-1">
                {pages.map((page) => (
                  <li key={page.id}>
                    <Link
                      href={`/knowledge/${page.id}`}
                      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="font-medium">{page.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {modalSpace && (
        <Modal onClose={() => !saving && setModalSpace(false)}>
          <form onSubmit={handleCreateSpace}>
            <ModalHeader>
              <ModalTitle>New Space</ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
                <Input
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                  placeholder="e.g. SAP Configuration"
                  disabled={saving}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Description (optional)</label>
                <textarea
                  value={newSpaceDesc}
                  onChange={(e) => setNewSpaceDesc(e.target.value)}
                  rows={2}
                  className="h-auto w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400"
                  placeholder="Brief description"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setModalSpace(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !newSpaceName.trim()}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}

      {modalPage && (
        <Modal onClose={() => !saving && setModalPage(false)}>
          <form onSubmit={handleCreatePage}>
            <ModalHeader>
              <ModalTitle>New Page</ModalTitle>
            </ModalHeader>
            <ModalBody className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
                <Input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="e.g. How to configure variant valuation"
                  disabled={saving}
                />
              </div>
              {saveError && <p className="text-sm text-red-600">{saveError}</p>}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="secondary" onClick={() => setModalPage(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !newPageTitle.trim()}>
                {saving ? "Creating…" : "Create"}
              </Button>
            </ModalFooter>
          </form>
        </Modal>
      )}
    </PageShell>
  );
}
