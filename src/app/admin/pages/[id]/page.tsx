"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type {
  Product,
  ProductPage,
  KeyPoint,
  SpecItem,
  ProcessStep,
  FigmaEmbed,
} from "@/lib/supabase/types";
import { dbInsert, dbUpdate } from "@/lib/db";
import {
  ArrowLeft,
  Save,
  Eye,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  ChevronDown,
  ChevronUp,
  Figma,
  Upload,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor"), { ssr: false });

const ICON_OPTIONS = [
  "shield",
  "flame",
  "thermometer",
  "leaf",
  "star",
  "zap",
  "droplet",
  "box",
  "check-circle",
  "award",
  "heart",
  "sun",
];

const emptyKeyPoint: KeyPoint = { icon: "star", title: "", description: "" };
const emptySpec: SpecItem = { label: "", value: "" };
const emptyStep: ProcessStep = { step: 1, title: "", description: "" };

export default function ProductDetailEditorPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>("hero");

  // Form state
  const [form, setForm] = useState({
    hero_images: [] as string[],
    subtitle: "",
    feature_title: "",
    feature_description: "",
    feature_images: [] as string[],
    key_points: [{ ...emptyKeyPoint }] as KeyPoint[],
    specs: [{ ...emptySpec }] as SpecItem[],
    detail_description: "",
    detail_images: [] as string[],
    process_title: "",
    process_steps: [{ ...emptyStep }] as ProcessStep[],
    gallery_images: [] as string[],
    figma_urls: [] as FigmaEmbed[],
    is_published: false,
  });
  const [showImportModal, setShowImportModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const DEFAULT_SECTION_ORDER = ["hero", "feature", "keypoints", "specs", "detail", "process", "gallery", "figma"];
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_SECTION_ORDER);

  const SECTION_LABELS: Record<string, string> = {
    hero: "히어로 섹션",
    feature: "특장점 섹션",
    keypoints: "키포인트",
    specs: "제품 스펙",
    detail: "상세 설명",
    process: "공정/선택 안내",
    gallery: "갤러리",
    figma: "Figma 디자인",
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIdx = items.indexOf(active.id as string);
        const newIdx = items.indexOf(over.id as string);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  }
  const [otherPages, setOtherPages] = useState<{ id: string; product_id: string; product_name: string; hero_images: string[]; subtitle: string | null; updated_at: string }[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // track which field is uploading
  const [dragOver, setDragOver] = useState<string | null>(null); // 드래그 오버 상태

  async function uploadImage(
    file: File,
    fieldKey: string
  ): Promise<string | null> {
    setUploading(fieldKey);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `pages/${id}/${fieldKey}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("logos")
        .upload(fileName, file, { upsert: true });
      if (error) {
        alert(`업로드 실패: ${error.message}`);
        return null;
      }
      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);
      return urlData.publicUrl;
    } finally {
      setUploading(null);
    }
  }

  // 드래그앤드롭 + 클릭 업로드 드롭존
  function DropZone({ fieldKey, onUploaded }: { fieldKey: string; onUploaded: (url: string) => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const isUploading = uploading === fieldKey;
    const isDragOver = dragOver === fieldKey;

    function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragOver(fieldKey); }
    function handleDragLeave() { setDragOver(null); }
    async function handleDrop(e: React.DragEvent) {
      e.preventDefault();
      setDragOver(null);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
      for (let i = 0; i < files.length; i++) {
        const u = await uploadImage(files[i], `${fieldKey}-${i}`);
        if (u) onUploaded(u);
      }
    }
    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
      const files = Array.from(e.target.files || []);
      for (let i = 0; i < files.length; i++) {
        const u = await uploadImage(files[i], `${fieldKey}-${i}`);
        if (u) onUploaded(u);
      }
      e.target.value = "";
    }

    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`py-6 rounded-xl border-2 border-dashed text-sm flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
          isDragOver
            ? "border-accent bg-accent/10 text-accent"
            : "border-border text-text-muted hover:border-primary hover:text-primary hover:bg-primary/5"
        }`}
      >
        {isUploading ? (
          <><Loader2 size={20} className="animate-spin" /> 업로드 중...</>
        ) : (
          <><Upload size={20} /> 이미지를 드래그하거나 클릭하여 업로드</>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
      </div>
    );
  }

  const fetchData = useCallback(async () => {
    setLoading(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const { data: prod } = await db
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (!prod) {
      router.push("/admin/products");
      return;
    }
    setProduct(prod);

    const { data: page } = await db
      .from("product_pages")
      .select("*")
      .eq("product_id", id)
      .maybeSingle();

    if (page) {
      setPageId(page.id);
      // hero_images: 새 배열 필드 우선, 없으면 기존 단일 필드에서 변환
      const heroImgs = page.hero_images?.length > 0
        ? page.hero_images
        : page.hero_image ? [page.hero_image] : [];
      const featureImgs = page.feature_images?.length > 0
        ? page.feature_images
        : page.feature_image ? [page.feature_image] : [];
      setForm({
        hero_images: heroImgs,
        subtitle: page.subtitle || "",
        feature_title: page.feature_title || "",
        feature_description: page.feature_description || "",
        feature_images: featureImgs,
        key_points:
          page.key_points?.length > 0
            ? page.key_points
            : [{ ...emptyKeyPoint }],
        specs: page.specs?.length > 0 ? page.specs : [{ ...emptySpec }],
        detail_description: page.detail_description || "",
        detail_images: page.detail_images || [],
        process_title: page.process_title || "",
        process_steps:
          page.process_steps?.length > 0
            ? page.process_steps
            : [{ ...emptyStep }],
        gallery_images: page.gallery_images || [],
        figma_urls: page.figma_urls || [],
        is_published: page.is_published || false,
      });
      // 섹션 순서 복원
      if (page.section_order?.length > 0) {
        setSectionOrder(page.section_order);
      }
    }

    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSave() {
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const filteredHeroImages = form.hero_images.filter(Boolean);
    const filteredFeatureImages = form.feature_images.filter(Boolean);
    const payload = {
      product_id: id,
      hero_image: filteredHeroImages[0] || null,
      hero_images: filteredHeroImages,
      subtitle: form.subtitle || null,
      feature_title: form.feature_title || null,
      feature_description: form.feature_description || null,
      feature_image: filteredFeatureImages[0] || null,
      feature_images: filteredFeatureImages,
      key_points: form.key_points.filter((kp) => kp.title),
      specs: form.specs.filter((s) => s.label),
      detail_description: form.detail_description || null,
      detail_images: form.detail_images.filter(Boolean),
      process_title: form.process_title || null,
      process_steps: form.process_steps.filter((ps) => ps.title),
      gallery_images: form.gallery_images.filter(Boolean),
      figma_urls: form.figma_urls.filter((f) => f.url),
      section_order: sectionOrder,
      is_published: form.is_published,
    };

    if (pageId) {
      await dbUpdate("product_pages", payload, { id: pageId });
    } else {
      const { data } = await dbInsert("product_pages", payload);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = (Array.isArray(data) ? data[0] : data) as any;
      if (row) setPageId(row.id);
    }

    setSaving(false);
    alert("저장되었습니다!");
  }

  function toggleSection(section: string) {
    setActiveSection((prev) => (prev === section ? null : section));
  }

  // --- Key Points ---
  function addKeyPoint() {
    setForm((prev) => ({
      ...prev,
      key_points: [...prev.key_points, { ...emptyKeyPoint }],
    }));
  }
  function removeKeyPoint(idx: number) {
    setForm((prev) => ({
      ...prev,
      key_points: prev.key_points.filter((_, i) => i !== idx),
    }));
  }
  function updateKeyPoint(idx: number, field: keyof KeyPoint, value: string) {
    setForm((prev) => ({
      ...prev,
      key_points: prev.key_points.map((kp, i) =>
        i === idx ? { ...kp, [field]: value } : kp
      ),
    }));
  }

  // --- Specs ---
  function addSpec() {
    setForm((prev) => ({
      ...prev,
      specs: [...prev.specs, { ...emptySpec }],
    }));
  }
  function removeSpec(idx: number) {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.filter((_, i) => i !== idx),
    }));
  }
  function updateSpec(idx: number, field: keyof SpecItem, value: string) {
    setForm((prev) => ({
      ...prev,
      specs: prev.specs.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    }));
  }

  // --- Process Steps ---
  function addStep() {
    setForm((prev) => ({
      ...prev,
      process_steps: [
        ...prev.process_steps,
        { ...emptyStep, step: prev.process_steps.length + 1 },
      ],
    }));
  }
  function removeStep(idx: number) {
    setForm((prev) => ({
      ...prev,
      process_steps: prev.process_steps
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, step: i + 1 })),
    }));
  }
  function updateStep(
    idx: number,
    field: keyof ProcessStep,
    value: string | number
  ) {
    setForm((prev) => ({
      ...prev,
      process_steps: prev.process_steps.map((s, i) =>
        i === idx ? { ...s, [field]: value } : s
      ),
    }));
  }

  // --- Gallery / Detail Images ---
  function addImageUrl(field: "gallery_images" | "detail_images") {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ""] }));
  }
  function removeImageUrl(field: "gallery_images" | "detail_images", idx: number) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_: string, i: number) => i !== idx),
    }));
  }
  function updateImageUrl(
    field: "gallery_images" | "detail_images",
    idx: number,
    value: string
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((v: string, i: number) => (i === idx ? value : v)),
    }));
  }

  // --- Figma Embeds ---
  function addFigma() {
    setForm((prev) => ({
      ...prev,
      figma_urls: [...prev.figma_urls, { title: "", url: "" }],
    }));
  }
  function removeFigma(idx: number) {
    setForm((prev) => ({
      ...prev,
      figma_urls: prev.figma_urls.filter((_, i) => i !== idx),
    }));
  }
  function updateFigma(idx: number, field: keyof FigmaEmbed, value: string) {
    setForm((prev) => ({
      ...prev,
      figma_urls: prev.figma_urls.map((f, i) =>
        i === idx ? { ...f, [field]: value } : f
      ),
    }));
  }

  function getFigmaEmbedUrl(url: string): string | null {
    // Support figma.com/file/..., figma.com/design/..., figma.com/proto/...
    if (/figma\.com\/(file|design|proto)\//.test(url)) {
      return `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(url)}`;
    }
    return null;
  }

  if (loading) {
    return (
      <div className="text-center py-20 text-text-muted">로딩 중...</div>
    );
  }

  // 드래그 가능한 섹션 래퍼
  function SortableSection({ id: sectionId, children }: { id: string; children: React.ReactNode }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionId });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
    };
    return (
      <div ref={setNodeRef} style={style} className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <div className="flex">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="px-2 pt-4 cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary transition-colors self-start"
            aria-label="드래그하여 순서 변경"
          >
            <GripVertical size={16} />
          </button>
          <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
        </div>
      </div>
    );
  }

  const SectionHeader = ({
    id: sectionId,
    title,
    badge,
  }: {
    id: string;
    title: string;
    badge?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSection(sectionId)}
      className="w-full flex items-center justify-between px-6 py-4 hover:bg-bg-card-hover transition-colors"
    >
      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {badge}
          </span>
        )}
      </div>
      {activeSection === sectionId ? (
        <ChevronUp size={18} className="text-text-muted" />
      ) : (
        <ChevronDown size={18} className="text-text-muted" />
      )}
    </button>
  );

  return (
    <div className={`flex gap-6 ${showPreview ? "max-w-full" : "max-w-4xl mx-auto"}`}>
    <div className={`${showPreview ? "w-1/2 min-w-0" : "w-full"}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/pages"
            className="p-2 rounded-lg hover:bg-bg-card text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              상세페이지 편집
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              {product?.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const db = supabase as any;
              const { data } = await db
                .from("product_pages")
                .select("id, product_id, hero_images, hero_image, subtitle, updated_at")
                .neq("product_id", id)
                .order("updated_at", { ascending: false });
              if (!data || data.length === 0) {
                alert("불러올 수 있는 다른 상세페이지가 없습니다.");
                return;
              }
              // product 이름 가져오기
              const productIds = data.map((d: { product_id: string }) => d.product_id);
              const { data: prods } = await db.from("products").select("id, name").in("id", productIds);
              const nameMap = new Map((prods || []).map((p: { id: string; name: string }) => [p.id, p.name]));
              setOtherPages(data.map((d: { id: string; product_id: string; hero_images: string[]; hero_image: string | null; subtitle: string | null; updated_at: string }) => ({
                ...d,
                hero_images: d.hero_images?.length > 0 ? d.hero_images : d.hero_image ? [d.hero_image] : [],
                product_name: (nameMap.get(d.product_id) as string) || d.product_id,
              })));
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-accent/30 text-accent text-sm hover:bg-accent/10 transition-colors"
          >
            <ArrowLeft size={16} /> 다른 페이지 불러오기
          </button>
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm transition-colors ${
              showPreview
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-text-secondary hover:bg-bg-card-hover"
            }`}
          >
            <Eye size={16} /> {showPreview ? "미리보기 닫기" : "미리보기"}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold text-sm hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            <Save size={16} /> {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>

      {/* Publish toggle */}
      <div className="flex items-center gap-3 mb-6 px-6 py-4 rounded-2xl border border-border bg-bg-card">
        <input
          type="checkbox"
          id="is_published"
          checked={form.is_published}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, is_published: e.target.checked }))
          }
          className="accent-primary"
        />
        <label htmlFor="is_published" className="text-sm text-text-secondary">
          상세페이지 공개
        </label>
        <span
          className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
            form.is_published
              ? "bg-emerald-400/10 text-emerald-400"
              : "bg-red-400/10 text-red-400"
          }`}
        >
          {form.is_published ? "공개" : "비공개"}
        </span>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>

      {sectionOrder.map((sectionId, sectionIdx) => {
        const num = sectionIdx + 1;
        if (sectionId === "hero") return (
      <SortableSection key="hero" id="hero">
        <SectionHeader id="hero" title={`${num}. 히어로 섹션`} badge={`${form.hero_images.length}장`} />
        {activeSection === "hero" && (
          <div className="px-6 pb-6 space-y-4">
            <label className="block text-sm text-text-secondary mb-1">히어로 이미지</label>
            {form.hero_images.map((url, idx) => (
              <div key={idx} className="flex items-center gap-3 mb-2">
                <ImageIcon size={16} className="text-text-muted shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => {
                    const arr = [...form.hero_images];
                    arr[idx] = e.target.value;
                    setForm((prev) => ({ ...prev, hero_images: arr }));
                  }}
                  placeholder="이미지 URL"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-xs cursor-pointer hover:bg-accent/20 transition-colors">
                  {uploading === `hero-${idx}` ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const u = await uploadImage(file, `hero-${idx}`);
                    if (u) { const arr = [...form.hero_images]; arr[idx] = u; setForm((prev) => ({ ...prev, hero_images: arr })); }
                    e.target.value = "";
                  }} />
                </label>
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, hero_images: prev.hero_images.filter((_, i) => i !== idx) }))} className="p-1 text-text-muted hover:text-red-400 transition-colors" aria-label="삭제">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {form.hero_images.filter(Boolean).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.hero_images.filter(Boolean).map((url, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-border aspect-video">
                    <img src={url} alt={`Hero ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ))}
              </div>
            )}
            <DropZone fieldKey="hero-new" onUploaded={(url) => setForm((prev) => ({ ...prev, hero_images: [...prev.hero_images, url] }))} />
            <button type="button" onClick={() => setForm((prev) => ({ ...prev, hero_images: [...prev.hero_images, ""] }))} className="w-full py-2 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> URL 직접 입력
            </button>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                서브타이틀
              </label>
              <input
                type="text"
                value={form.subtitle}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subtitle: e.target.value }))
                }
                placeholder="제품의 한줄 소개"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "feature") return (
      <SortableSection key="feature" id="feature">
        <SectionHeader id="feature" title={`${num}. 특장점 섹션`} badge="소개" />
        {activeSection === "feature" && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                특장점 제목
              </label>
              <input
                type="text"
                value={form.feature_title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    feature_title: e.target.value,
                  }))
                }
                placeholder="예: 최고급 소재로 만든 프리미엄 용기"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                특장점 설명
              </label>
              <RichTextEditor
                content={form.feature_description}
                onChange={(html) =>
                  setForm((prev) => ({
                    ...prev,
                    feature_description: html,
                  }))
                }
                placeholder="제품의 핵심 특장점을 설명해주세요"
              />
            </div>
            <label className="block text-sm text-text-secondary mb-1">특장점 이미지</label>
            {form.feature_images.map((url, idx) => (
              <div key={idx} className="flex items-center gap-3 mb-2">
                <ImageIcon size={16} className="text-text-muted shrink-0" />
                <input type="url" value={url} onChange={(e) => { const arr = [...form.feature_images]; arr[idx] = e.target.value; setForm((prev) => ({ ...prev, feature_images: arr })); }} placeholder="이미지 URL" className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary" />
                <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-xs cursor-pointer hover:bg-accent/20 transition-colors">
                  {uploading === `feature-${idx}` ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; const u = await uploadImage(file, `feature-${idx}`); if (u) { const arr = [...form.feature_images]; arr[idx] = u; setForm((prev) => ({ ...prev, feature_images: arr })); } e.target.value = ""; }} />
                </label>
                <button type="button" onClick={() => setForm((prev) => ({ ...prev, feature_images: prev.feature_images.filter((_, i) => i !== idx) }))} className="p-1 text-text-muted hover:text-red-400 transition-colors" aria-label="삭제">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {form.feature_images.filter(Boolean).length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {form.feature_images.filter(Boolean).map((url, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden border border-border aspect-video">
                    <img src={url} alt={`Feature ${idx + 1}`} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  </div>
                ))}
              </div>
            )}
            <DropZone fieldKey="feature-new" onUploaded={(url) => setForm((prev) => ({ ...prev, feature_images: [...prev.feature_images, url] }))} />
            <button type="button" onClick={() => setForm((prev) => ({ ...prev, feature_images: [...prev.feature_images, ""] }))} className="w-full py-2 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> URL 직접 입력
            </button>
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "keypoints") return (
      <SortableSection key="keypoints" id="keypoints">
        <SectionHeader
          id="keypoints"
          title={`${num}. 키포인트`}
          badge={`${form.key_points.length}개`}
        />
        {activeSection === "keypoints" && (
          <div className="px-6 pb-6 space-y-4">
            {form.key_points.map((kp, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-bg-dark space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-text-muted">
                    <GripVertical size={14} />
                    <span>포인트 {idx + 1}</span>
                  </div>
                  {form.key_points.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeKeyPoint(idx)}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      아이콘
                    </label>
                    <select
                      value={kp.icon}
                      onChange={(e) =>
                        updateKeyPoint(idx, "icon", e.target.value)
                      }
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm focus:outline-none focus:border-primary"
                    >
                      {ICON_OPTIONS.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-text-muted mb-1">
                      제목
                    </label>
                    <input
                      type="text"
                      value={kp.title}
                      onChange={(e) =>
                        updateKeyPoint(idx, "title", e.target.value)
                      }
                      placeholder="예: 내열성"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">
                    설명
                  </label>
                  <input
                    type="text"
                    value={kp.description}
                    onChange={(e) =>
                      updateKeyPoint(idx, "description", e.target.value)
                    }
                    placeholder="간단한 설명"
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            ))}
            {form.key_points.length < 6 && (
              <button
                type="button"
                onClick={addKeyPoint}
                className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> 키포인트 추가
              </button>
            )}
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "specs") return (
      <SortableSection key="specs" id="specs">
        <SectionHeader
          id="specs"
          title={`${num}. 제품 스펙`}
          badge={`${form.specs.length}개`}
        />
        {activeSection === "specs" && (
          <div className="px-6 pb-6 space-y-3">
            {form.specs.map((spec, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  type="text"
                  value={spec.label}
                  onChange={(e) => updateSpec(idx, "label", e.target.value)}
                  placeholder="항목명 (예: 재질)"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={spec.value}
                  onChange={(e) => updateSpec(idx, "value", e.target.value)}
                  placeholder="값 (예: PP)"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                {form.specs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSpec(idx)}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addSpec}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 스펙 추가
            </button>
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "detail") return (
      <SortableSection key="detail" id="detail">
        <SectionHeader id="detail" title={`${num}. 상세 설명`} badge="본문" />
        {activeSection === "detail" && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                상세 설명
              </label>
              <RichTextEditor
                content={form.detail_description}
                onChange={(html) =>
                  setForm((prev) => ({
                    ...prev,
                    detail_description: html,
                  }))
                }
                placeholder="제품에 대한 상세 설명을 작성해주세요"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-2">
                상세 이미지
              </label>
              {form.detail_images.map((url, idx) => (
                <div key={idx} className="flex items-center gap-3 mb-2">
                  <ImageIcon size={16} className="text-text-muted shrink-0" />
                  <input
                    type="url"
                    value={url}
                    onChange={(e) =>
                      updateImageUrl("detail_images", idx, e.target.value)
                    }
                    placeholder="이미지 URL"
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                  />
                  <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-xs cursor-pointer hover:bg-accent/20 transition-colors">
                    {uploading === `detail-${idx}` ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const u = await uploadImage(file, `detail-${idx}`);
                        if (u) updateImageUrl("detail_images", idx, u);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeImageUrl("detail_images", idx)}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <DropZone fieldKey="detail-new" onUploaded={(url) => setForm((prev) => ({ ...prev, detail_images: [...prev.detail_images, url] }))} />
              <button type="button" onClick={() => addImageUrl("detail_images")} className="w-full py-2 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
                <Plus size={16} /> URL 직접 입력
              </button>
            </div>
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "process") return (
      <SortableSection key="process" id="process">
        <SectionHeader
          id="process"
          title={`${num}. 공정/선택 안내`}
          badge={`${form.process_steps.length}단계`}
        />
        {activeSection === "process" && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                섹션 제목
              </label>
              <input
                type="text"
                value={form.process_title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    process_title: e.target.value,
                  }))
                }
                placeholder="예: CHOICE - 나에게 맞는 포장 선택"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
            {form.process_steps.map((step, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-bg-dark space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">
                    Step {step.step}
                  </span>
                  {form.process_steps.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStep(idx)}
                      className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={step.title}
                  onChange={(e) => updateStep(idx, "title", e.target.value)}
                  placeholder="단계 제목"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={step.description}
                  onChange={(e) =>
                    updateStep(idx, "description", e.target.value)
                  }
                  placeholder="단계 설명"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <input
                  type="url"
                  value={step.image || ""}
                  onChange={(e) => updateStep(idx, "image", e.target.value)}
                  placeholder="이미지 URL (선택)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
              </div>
            ))}
            {form.process_steps.length < 8 && (
              <button
                type="button"
                onClick={addStep}
                className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> 단계 추가
              </button>
            )}
          </div>
        )}
      </SortableSection>
        );
        if (sectionId === "gallery") return (
      <SortableSection key="gallery" id="gallery">
        <SectionHeader
          id="gallery"
          title={`${num}. 갤러리`}
          badge={`${form.gallery_images.length}장`}
        />
        {activeSection === "gallery" && (
          <div className="px-6 pb-6 space-y-3">
            {form.gallery_images.map((url, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <ImageIcon size={16} className="text-text-muted shrink-0" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) =>
                    updateImageUrl("gallery_images", idx, e.target.value)
                  }
                  placeholder="갤러리 이미지 URL"
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-bg-dark text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-accent/10 text-accent text-xs cursor-pointer hover:bg-accent/20 transition-colors">
                  {uploading === `gallery-${idx}` ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const u = await uploadImage(file, `gallery-${idx}`);
                      if (u) updateImageUrl("gallery_images", idx, u);
                      e.target.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeImageUrl("gallery_images", idx)}
                  className="p-1 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <DropZone fieldKey="gallery-new" onUploaded={(url) => setForm((prev) => ({ ...prev, gallery_images: [...prev.gallery_images, url] }))} />
            <button type="button" onClick={() => addImageUrl("gallery_images")} className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
              <Plus size={16} /> URL 직접 입력
            </button>
            {form.gallery_images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {form.gallery_images
                  .filter(Boolean)
                  .map((url, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg overflow-hidden border border-border aspect-square"
                    >
                      <img
                        src={url}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </SortableSection>

        );
        if (sectionId === "figma") return (
      <SortableSection key="figma" id="figma">
        <SectionHeader
          id="figma"
          title={`${num}. Figma 디자인`}
          badge={`${form.figma_urls.length}개`}
        />
        {activeSection === "figma" && (
          <div className="px-6 pb-6 space-y-4">
            <div className="px-4 py-3 rounded-xl bg-accent/5 border border-accent/20 text-sm text-text-secondary">
              <div className="flex items-center gap-2 mb-1">
                <Figma size={14} className="text-accent" />
                <span className="font-medium text-accent">Figma 임베드 안내</span>
              </div>
              Figma에서 디자인한 프레임의 공유 링크를 붙여넣으세요. 공개 페이지에 임베드되어 표시됩니다.
              <br />
              <span className="text-text-muted text-xs">
                예: https://www.figma.com/design/xxxxx/파일명?node-id=...
              </span>
            </div>

            {form.figma_urls.map((figma, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl border border-border bg-bg-dark space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted flex items-center gap-2">
                    <Figma size={14} />
                    디자인 {idx + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFigma(idx)}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
                    aria-label="삭제"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <input
                  type="text"
                  value={figma.title}
                  onChange={(e) => updateFigma(idx, "title", e.target.value)}
                  placeholder="섹션 제목 (예: 히어로 디자인, 제품 소개)"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                <input
                  type="url"
                  value={figma.url}
                  onChange={(e) => updateFigma(idx, "url", e.target.value)}
                  placeholder="https://www.figma.com/design/..."
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-text-primary text-sm placeholder:text-text-muted focus:outline-none focus:border-primary"
                />
                {/* Preview */}
                {figma.url && getFigmaEmbedUrl(figma.url) && (
                  <div className="rounded-lg overflow-hidden border border-border aspect-video">
                    <iframe
                      src={getFigmaEmbedUrl(figma.url)!}
                      className="w-full h-full"
                      allowFullScreen
                      title={figma.title || `Figma Design ${idx + 1}`}
                    />
                  </div>
                )}
                {figma.url && !getFigmaEmbedUrl(figma.url) && (
                  <p className="text-xs text-red-400">
                    올바른 Figma URL이 아닙니다. figma.com/design/... 또는 figma.com/file/... 형식이어야 합니다.
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addFigma}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-accent hover:text-accent transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> Figma 디자인 추가
            </button>
          </div>
        )}
      </SortableSection>
        );
        return null;
      })}

      </SortableContext>
      </DndContext>

      {/* Bottom save */}
      <div className="flex justify-end gap-3 mt-8 mb-12">
        <Link
          href="/admin/pages"
          className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
        >
          취소
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "저장 중..." : "저장"}
        </button>
      </div>

      {/* 다른 상세페이지 불러오기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-bg-card rounded-2xl border border-border w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-lg font-bold text-text-primary">다른 상세페이지 불러오기</h3>
              <button type="button" onClick={() => setShowImportModal(false)} className="text-text-muted hover:text-text-primary transition-colors" aria-label="닫기">
                <Trash2 size={18} />
              </button>
            </div>
            <p className="px-6 pt-3 text-xs text-text-muted">
              선택한 페이지의 모든 내용(이미지, 텍스트, 키포인트 등)을 현재 페이지로 복사합니다.
            </p>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {otherPages.map((op) => (
                <button
                  key={op.id}
                  type="button"
                  onClick={async () => {
                    if (!confirm(`"${op.product_name}" 상세페이지 내용을 불러오시겠습니까? 현재 입력 중인 내용이 덮어씌워집니다.`)) return;
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const db = supabase as any;
                    const { data: fullPage } = await db
                      .from("product_pages")
                      .select("*")
                      .eq("id", op.id)
                      .single();
                    if (fullPage) {
                      const heroImgs = fullPage.hero_images?.length > 0 ? fullPage.hero_images : fullPage.hero_image ? [fullPage.hero_image] : [];
                      const featureImgs = fullPage.feature_images?.length > 0 ? fullPage.feature_images : fullPage.feature_image ? [fullPage.feature_image] : [];
                      setForm({
                        hero_images: heroImgs,
                        subtitle: fullPage.subtitle || "",
                        feature_title: fullPage.feature_title || "",
                        feature_description: fullPage.feature_description || "",
                        feature_images: featureImgs,
                        key_points: fullPage.key_points?.length > 0 ? fullPage.key_points : [{ ...emptyKeyPoint }],
                        specs: fullPage.specs?.length > 0 ? fullPage.specs : [{ ...emptySpec }],
                        detail_description: fullPage.detail_description || "",
                        detail_images: fullPage.detail_images || [],
                        process_title: fullPage.process_title || "",
                        process_steps: fullPage.process_steps?.length > 0 ? fullPage.process_steps : [{ ...emptyStep }],
                        gallery_images: fullPage.gallery_images || [],
                        figma_urls: fullPage.figma_urls || [],
                        is_published: false, // 불러온 건 비공개로 시작
                      });
                      // 섹션 순서도 복원
                      if (fullPage.section_order?.length > 0) {
                        setSectionOrder(fullPage.section_order);
                      } else {
                        setSectionOrder(DEFAULT_SECTION_ORDER);
                      }
                    }
                    setShowImportModal(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-bg-card-hover transition-colors text-left"
                >
                  <div className="w-16 h-16 rounded-lg bg-bg-dark overflow-hidden shrink-0">
                    {op.hero_images?.[0] ? (
                      <img src={op.hero_images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-text-muted"><ImageIcon size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text-primary truncate">{op.product_name}</p>
                    {op.subtitle && <p className="text-xs text-text-muted truncate">{op.subtitle}</p>}
                    <p className="text-xs text-text-muted mt-1">수정: {new Date(op.updated_at).toLocaleDateString("ko-KR")}</p>
                  </div>
                </button>
              ))}
              {otherPages.length === 0 && (
                <p className="text-center text-text-muted py-8">불러올 수 있는 다른 상세페이지가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>

    {/* 실시간 미리보기 패널 */}
    {showPreview && (
      <div className="w-1/2 min-w-0 sticky top-0 h-screen overflow-y-auto">
        <div className="bg-white text-black rounded-2xl border border-border overflow-hidden">
          {/* 히어로 */}
          {form.hero_images.filter(Boolean).length > 0 && (
            <div className="relative">
              <img
                src={form.hero_images.filter(Boolean)[0]}
                alt="Hero"
                className="w-full h-64 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <h1 className="text-2xl font-bold text-white">{product?.name}</h1>
                {form.subtitle && (
                  <p className="text-sm text-white/80 mt-1">{form.subtitle}</p>
                )}
              </div>
              {form.hero_images.filter(Boolean).length > 1 && (
                <div className="absolute bottom-2 right-2 flex gap-1">
                  {form.hero_images.filter(Boolean).map((_, i) => (
                    <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              )}
            </div>
          )}
          {form.hero_images.filter(Boolean).length === 0 && (
            <div className="h-48 bg-gray-100 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <ImageIcon size={32} className="mx-auto mb-2" />
                <p className="text-sm">히어로 이미지 미등록</p>
              </div>
            </div>
          )}

          <div className="p-6 space-y-8">
            {/* 특장점 */}
            {(form.feature_title || form.feature_description) && (
              <section>
                {form.feature_title && (
                  <h2 className="text-lg font-bold text-gray-900 mb-3">{form.feature_title}</h2>
                )}
                {form.feature_description && (
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: form.feature_description }}
                  />
                )}
                {form.feature_images.filter(Boolean).length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {form.feature_images.filter(Boolean).map((url, i) => (
                      <img key={i} src={url} alt="" className="w-full rounded-lg object-cover aspect-video" />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 키포인트 */}
            {form.key_points.filter(kp => kp.title).length > 0 && (
              <section>
                <div className="grid grid-cols-2 gap-3">
                  {form.key_points.filter(kp => kp.title).map((kp, i) => (
                    <div key={i} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="font-semibold text-sm text-gray-900">{kp.title}</p>
                      {kp.description && (
                        <p className="text-xs text-gray-500 mt-1">{kp.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 스펙 */}
            {form.specs.filter(s => s.label).length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">제품 스펙</h3>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {form.specs.filter(s => s.label).map((s, i) => (
                    <div key={i} className="flex text-sm">
                      <span className="w-1/3 bg-gray-50 px-3 py-2 font-medium text-gray-700">{s.label}</span>
                      <span className="flex-1 px-3 py-2 text-gray-600">{s.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 상세 설명 */}
            {form.detail_description && (
              <section>
                <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">상세 설명</h3>
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: form.detail_description }}
                />
              </section>
            )}

            {/* 상세 이미지 */}
            {form.detail_images.filter(Boolean).length > 0 && (
              <section className="space-y-2">
                {form.detail_images.filter(Boolean).map((url, i) => (
                  <img key={i} src={url} alt="" className="w-full rounded-lg" />
                ))}
              </section>
            )}

            {/* 공정/선택 안내 */}
            {form.process_steps.filter(ps => ps.title).length > 0 && (
              <section>
                {form.process_title && (
                  <h3 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">{form.process_title}</h3>
                )}
                <div className="space-y-3">
                  {form.process_steps.filter(ps => ps.title).map((ps, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                        {ps.step}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{ps.title}</p>
                        {ps.description && <p className="text-xs text-gray-500 mt-0.5">{ps.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 갤러리 */}
            {form.gallery_images.filter(Boolean).length > 0 && (
              <section>
                <h3 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">갤러리</h3>
                <div className="grid grid-cols-3 gap-2">
                  {form.gallery_images.filter(Boolean).map((url, i) => (
                    <img key={i} src={url} alt="" className="w-full rounded-lg object-cover aspect-square" />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
