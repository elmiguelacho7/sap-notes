"use client";

import { useEffect, useMemo, useState, useRef, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { supabase } from "@/lib/supabaseClient";
import { handleSupabaseError } from "@/lib/supabaseError";
import { getCountryDisplayName } from "@/lib/countryStateCity";
import {
  FORM_FOOTER_ACTIONS_CLASS,
  FORM_PAGE_BLOCK_CLASS,
  FORM_PAGE_SHELL_CLASS,
  FORM_PAGE_SUBTITLE_CLASS,
  FORM_PAGE_TITLE_BLOCK_CLASS,
  FORM_PAGE_TITLE_CLASS,
  FORM_SECTION_DIVIDER_CLASS,
  FORM_SECTION_HELPER_CLASS,
  FORM_SECTION_TITLE_CLASS,
} from "@/components/layout/formPageClasses";

type Client = {
  id: string;
  name: string;
  display_name?: string | null;
  country: string | null;
};

type Module = {
  id: string;
  code: string;
  name: string;
};

type ScopeItem = {
  id: string;
  code: string;
  name: string;
  module_id: string | null;
  scope_type: string;
};

const NOTE_TYPE_KEYS = [
  "incident",
  "configuration",
  "functional",
  "technical",
  "process",
  "idea",
  "other",
] as const;
type NoteTypeKey = (typeof NOTE_TYPE_KEYS)[number];

const SYSTEM_TYPE_KEYS = ["ecc", "s4op", "s4public", "s4private", "bw", "other"] as const;

const inputClass =
  "w-full rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))]/95 px-3.5 py-2.5 text-sm text-[rgb(var(--rb-text-primary))] placeholder:text-[rgb(var(--rb-text-muted))] focus:border-[rgb(var(--rb-brand-primary))]/35 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--rb-brand-ring))]/35";
const labelClass = "mb-1.5 block text-sm font-medium text-[rgb(var(--rb-text-primary))]";
const sectionTitleClass = FORM_SECTION_TITLE_CLASS;

export default function NewNotePage() {
  const t = useTranslations("notes.new");
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromQuick = searchParams?.get("from") === "quick";
  const projectIdFromQuery = searchParams?.get("projectId") ?? "";
  const isProjectMode = projectIdFromQuery.trim().length > 0;

  const [showCreandoBanner, setShowCreandoBanner] = useState(fromQuick);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (fromQuick) {
      const timer = setTimeout(() => setShowCreandoBanner(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && titleInputRef.current) {
      const timer = setTimeout(() => titleInputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [fromQuick]);

  useEffect(() => {
    if (fromQuick && projectIdFromQuery) {
      router.replace(`/notes/new?projectId=${projectIdFromQuery}`);
    }
  }, [fromQuick, projectIdFromQuery, router]);

  useEffect(() => {
    if (isProjectMode) return;
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      if (cancelled) return;
      const data = await res.json().catch(() => ({ permissions: { manageGlobalNotes: false } }));
      const perms = (data as { permissions?: { manageGlobalNotes?: boolean } }).permissions;
      if (!perms?.manageGlobalNotes) {
        router.replace("/notes");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isProjectMode, router]);

  const [title, setTitle] = useState("");
  const [noteTypeKey, setNoteTypeKey] = useState<NoteTypeKey>("incident");

  const [systemTypeKey, setSystemTypeKey] = useState<string>("");

  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<string>("");

  const [modules, setModules] = useState<Module[]>([]);
  const [scopeItems, setScopeItems] = useState<ScopeItem[]>([]);
  const [moduleId, setModuleId] = useState<string>("");
  const [scopeItemId, setScopeItemId] = useState<string>("");

  const [transactionCode, setTransactionCode] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const [body, setBody] = useState("");

  const [webLink1, setWebLink1] = useState("");
  const [webLink2, setWebLink2] = useState("");
  const [extraInfo, setExtraInfo] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setErrorMsg(null);
      const [
        { data: clientData, error: clientError },
        { data: moduleData, error: moduleError },
        { data: scopeData, error: scopeError },
      ] = await Promise.all([
        supabase.from("clients").select("id, name, display_name, country").order("name", { ascending: true }),
        supabase.from("modules").select("id, code, name").order("code", { ascending: true }),
        supabase
          .from("scope_items")
          .select("id, code, name, module_id, scope_type")
          .order("code", { ascending: true }),
      ]);

      if (clientError) {
        handleSupabaseError("clients", clientError);
        setClients([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setClients(clientData ?? []);
      }

      if (moduleError) {
        handleSupabaseError("modules", moduleError);
        setModules([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setModules(moduleData ?? []);
      }

      if (scopeError) {
        handleSupabaseError("scope_items", scopeError);
        setScopeItems([]);
        setErrorMsg("Part of the project data could not be loaded. Please try again later.");
      } else {
        setScopeItems((scopeData ?? []) as ScopeItem[]);
      }
    };

    loadData();
  }, []);

  const filteredScopeItems = useMemo(
    () => scopeItems.filter((s) => (moduleId ? s.module_id === moduleId : true)),
    [scopeItems, moduleId]
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg(t("errors.titleRequired"));
      return;
    }

    setSaving(true);

    try {
      const selectedModule = modules.find((m) => m.id === moduleId) || null;
      const selectedScopeItem = scopeItems.find((s) => s.id === scopeItemId) || null;

      if (projectIdFromQuery.trim()) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`/api/projects/${projectIdFromQuery.trim()}/notes`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim() || null,
            module: selectedModule ? `${selectedModule.code} - ${selectedModule.name}` : null,
            scope_items: selectedScopeItem
              ? [`${selectedScopeItem.code} - ${selectedScopeItem.name}`]
              : [],
            error_code: errorCode.trim() || null,
            web_link_1: webLink1.trim() || null,
            web_link_2: webLink2.trim() || null,
            extra_info: extraInfo.trim() || null,
            is_knowledge_base: false,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setErrorMsg(
            (data as { error?: string; details?: string }).error ??
              (data as { details?: string }).details ??
              t("errors.createFailed")
          );
          setSaving(false);
          return;
        }
        router.push(`/projects/${projectIdFromQuery.trim()}/notes`);
        return;
      }

      const selectedClient = clients.find((c) => c.id === clientId) || null;
      const sysKey = systemTypeKey as (typeof SYSTEM_TYPE_KEYS)[number] | "";
      const systemLabel =
        sysKey && SYSTEM_TYPE_KEYS.includes(sysKey) ? t(`systemTypes.${sysKey}`) : null;

      const payload = {
        title: title.trim(),
        body: body.trim() || null,

        client: selectedClient ? selectedClient.name : null,
        client_id: selectedClient ? selectedClient.id : null,

        module: selectedModule ? `${selectedModule.code} - ${selectedModule.name}` : null,
        module_id: selectedModule ? selectedModule.id : null,

        scope_item: selectedScopeItem ? `${selectedScopeItem.code} - ${selectedScopeItem.name}` : null,
        scope_item_id: selectedScopeItem ? selectedScopeItem.id : null,

        system_type: systemLabel,
        transaction: transactionCode.trim() || null,
        error_code: errorCode.trim() || null,
        note_type: t(`noteTypes.${noteTypeKey}`) || null,

        web_link_1: webLink1.trim() || null,
        web_link_2: webLink2.trim() || null,
        extra_info: extraInfo.trim() || null,

        project_id: null,
        created_by: null,
      };

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) (payload as Record<string, unknown>).created_by = user.id;

      const { error } = await supabase.from("notes").insert([payload]);

      if (error) {
        handleSupabaseError("notes insert", error);
        setErrorMsg((error as { message?: string })?.message || t("errors.createFailed"));
        setSaving(false);
        return;
      }

      router.push("/notes");
    } catch (err) {
      handleSupabaseError("notes new submit", err);
      setErrorMsg(t("errors.unexpected"));
      setSaving(false);
    }
  };

  const isProject = isProjectMode && projectIdFromQuery.trim().length > 0;
  return (
    <div className="min-h-full w-full min-w-0 bg-[rgb(var(--rb-shell-bg))]">
      <div className={FORM_PAGE_SHELL_CLASS}>
        <div className={`${FORM_PAGE_BLOCK_CLASS} space-y-6`}>
          {showCreandoBanner && (
            <div className="rounded-xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] px-3 py-2 text-xs text-[rgb(var(--rb-text-muted))] shadow-sm transition-opacity duration-300">
              {t("creatingBanner")}
            </div>
          )}

          <header className={FORM_PAGE_TITLE_BLOCK_CLASS}>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className={FORM_PAGE_TITLE_CLASS}>{t("title")}</h1>
              {isProject && (
                <span className="inline-flex items-center rounded-lg border border-[rgb(var(--rb-brand-primary))]/28 bg-[rgb(var(--rb-brand-primary))]/10 px-2.5 py-0.5 text-xs font-medium text-[rgb(var(--rb-brand-primary))]">
                  {t("projectNoteBadge")}
                </span>
              )}
            </div>
            <p className={FORM_PAGE_SUBTITLE_CLASS}>
              {isProject ? t("subtitleProject") : t("subtitleGlobal")}
            </p>
          </header>
        </div>

        <div className={`${FORM_PAGE_BLOCK_CLASS} rounded-2xl border border-[rgb(var(--rb-surface-border))]/70 bg-[rgb(var(--rb-surface))] p-6 shadow-md md:p-8`}>
          {errorMsg && (
            <div className="mb-6 rounded-xl border border-red-200/90 bg-red-50 px-4 py-3 text-sm text-red-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-0">
            <section className="space-y-4">
              <h2 className={sectionTitleClass}>{t("sectionMain")}</h2>
              <div>
                <label className={labelClass}>
                  {t("fieldTitle")} <span className="text-red-600">*</span>
                </label>
                <input
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("titlePlaceholder")}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>{t("fieldDescription")}</label>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder={t("descriptionPlaceholder")}
                  className={`${inputClass} min-h-[100px] resize-y`}
                />
                <p className="mt-1.5 text-xs text-[rgb(var(--rb-text-secondary))]">{t("descriptionHint")}</p>
                {isProject && (
                  <p className="mt-0.5 text-xs text-[rgb(var(--rb-text-secondary))]">{t("descriptionHintProject")}</p>
                )}
              </div>
            </section>

            <section className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={sectionTitleClass}>{t("sectionSap")}</h2>
              {!isProjectMode && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div>
                    <label className={labelClass}>{t("fieldNoteType")}</label>
                    <select
                      value={noteTypeKey}
                      onChange={(e) => setNoteTypeKey(e.target.value as NoteTypeKey)}
                      className={inputClass}
                    >
                      {NOTE_TYPE_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {t(`noteTypes.${key}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>{t("fieldSystem")}</label>
                    <select
                      value={systemTypeKey}
                      onChange={(e) => setSystemTypeKey(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">{t("systemUnspecified")}</option>
                      {SYSTEM_TYPE_KEYS.map((key) => (
                        <option key={key} value={key}>
                          {t(`systemTypes.${key}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              {!isProjectMode && (
                <div>
                  <label className={labelClass}>{t("fieldClient")}</label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("clientGeneric")}</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.display_name || client.name}
                        {client.country ? ` · ${getCountryDisplayName(client.country)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("fieldModule")}</label>
                  <select
                    value={moduleId}
                    onChange={(e) => {
                      setModuleId(e.target.value);
                      setScopeItemId("");
                    }}
                    className={inputClass}
                  >
                    <option value="">{t("optionalUnspecified")}</option>
                    {modules.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} · {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>{t("fieldScopeItem")}</label>
                  <select
                    value={scopeItemId}
                    onChange={(e) => setScopeItemId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("optionalUnspecified")}</option>
                    {filteredScopeItems.map((si) => (
                      <option key={si.id} value={si.id}>
                        {si.code} · {si.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {!isProjectMode && (
                  <div>
                    <label className={labelClass}>{t("fieldTransaction")}</label>
                    <input
                      type="text"
                      value={transactionCode}
                      onChange={(e) => setTransactionCode(e.target.value)}
                      placeholder={t("transactionPlaceholder")}
                      className={inputClass}
                    />
                  </div>
                )}
                <div>
                  <label className={labelClass}>{t("fieldErrorCode")}</label>
                  <input
                    type="text"
                    value={errorCode}
                    onChange={(e) => setErrorCode(e.target.value)}
                    placeholder={t("errorCodePlaceholder")}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            <section className={`space-y-4 ${FORM_SECTION_DIVIDER_CLASS}`}>
              <h2 className={sectionTitleClass}>{t("sectionRefs")}</h2>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className={labelClass}>{t("fieldLink1")}</label>
                  <input
                    type="url"
                    value={webLink1}
                    onChange={(e) => setWebLink1(e.target.value)}
                    placeholder={t("linkPlaceholder")}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>{t("fieldLink2")}</label>
                  <input
                    type="url"
                    value={webLink2}
                    onChange={(e) => setWebLink2(e.target.value)}
                    placeholder={t("link2Placeholder")}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>{t("fieldExtraInfo")}</label>
                <textarea
                  value={extraInfo}
                  onChange={(e) => setExtraInfo(e.target.value)}
                  rows={3}
                  placeholder={t("extraInfoPlaceholder")}
                  className={`${inputClass} min-h-[72px] resize-y`}
                />
              </div>
            </section>

            <div className={FORM_FOOTER_ACTIONS_CLASS}>
              <button
                type="button"
                onClick={() =>
                  router.push(projectIdFromQuery.trim() ? `/projects/${projectIdFromQuery.trim()}/notes` : "/notes")
                }
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[rgb(var(--rb-text-secondary))] transition-colors hover:bg-[rgb(var(--rb-surface))]/80 hover:text-[rgb(var(--rb-text-primary))]"
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl border border-transparent bg-[rgb(var(--rb-brand-primary))] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--rb-brand-primary-hover))] active:bg-[rgb(var(--rb-brand-primary-active))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--rb-brand-ring))]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--rb-shell-bg))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? t("saving") : t("saveNote")}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
