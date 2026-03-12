"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";

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
    hero_image: "",
    subtitle: "",
    feature_title: "",
    feature_description: "",
    feature_image: "",
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
  const [pageId, setPageId] = useState<string | null>(null);

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
      setForm({
        hero_image: page.hero_image || "",
        subtitle: page.subtitle || "",
        feature_title: page.feature_title || "",
        feature_description: page.feature_description || "",
        feature_image: page.feature_image || "",
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
    const payload = {
      product_id: id,
      hero_image: form.hero_image || null,
      subtitle: form.subtitle || null,
      feature_title: form.feature_title || null,
      feature_description: form.feature_description || null,
      feature_image: form.feature_image || null,
      key_points: form.key_points.filter((kp) => kp.title),
      specs: form.specs.filter((s) => s.label),
      detail_description: form.detail_description || null,
      detail_images: form.detail_images.filter(Boolean),
      process_title: form.process_title || null,
      process_steps: form.process_steps.filter((ps) => ps.title),
      gallery_images: form.gallery_images.filter(Boolean),
      figma_urls: form.figma_urls.filter((f) => f.url),
      is_published: form.is_published,
    };

    if (pageId) {
      await db.from("product_pages").update(payload).eq("id", pageId);
    } else {
      const { data } = await db
        .from("product_pages")
        .insert(payload)
        .select()
        .single();
      if (data) setPageId(data.id);
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
    <div className="max-w-4xl mx-auto">
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
          <Link
            href={`/products/${id}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm hover:bg-bg-card-hover transition-colors"
          >
            <Eye size={16} /> 미리보기
          </Link>
          <button
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

      {/* === Section 1: Hero === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader id="hero" title="1. 히어로 섹션" badge="메인 이미지" />
        {activeSection === "hero" && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                히어로 이미지 URL
              </label>
              <input
                type="url"
                value={form.hero_image}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, hero_image: e.target.value }))
                }
                placeholder="https://example.com/hero.jpg"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
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
            {form.hero_image && (
              <div className="rounded-xl overflow-hidden border border-border">
                <img
                  src={form.hero_image}
                  alt="Hero preview"
                  className="w-full h-48 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* === Section 2: Features === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader id="feature" title="2. 특장점 섹션" badge="소개" />
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
              <textarea
                value={form.feature_description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    feature_description: e.target.value,
                  }))
                }
                rows={4}
                placeholder="제품의 핵심 특장점을 설명해주세요"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                특장점 이미지 URL
              </label>
              <input
                type="url"
                value={form.feature_image}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    feature_image: e.target.value,
                  }))
                }
                placeholder="https://example.com/feature.jpg"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      {/* === Section 3: Key Points === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader
          id="keypoints"
          title="3. 키포인트"
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
      </div>

      {/* === Section 4: Specs === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader
          id="specs"
          title="4. 제품 스펙"
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
      </div>

      {/* === Section 5: Detail Description === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader id="detail" title="5. 상세 설명" badge="본문" />
        {activeSection === "detail" && (
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">
                상세 설명
              </label>
              <textarea
                value={form.detail_description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    detail_description: e.target.value,
                  }))
                }
                rows={8}
                placeholder="제품에 대한 상세 설명을 작성해주세요"
                className="w-full px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors resize-none"
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
                  <button
                    type="button"
                    onClick={() => removeImageUrl("detail_images", idx)}
                    className="p-1 text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addImageUrl("detail_images")}
                className="w-full py-2 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> 이미지 추가
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === Section 6: Process Steps === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader
          id="process"
          title="6. 공정/선택 안내"
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
      </div>

      {/* === Section 7: Gallery === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader
          id="gallery"
          title="7. 갤러리"
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
                <button
                  type="button"
                  onClick={() => removeImageUrl("gallery_images", idx)}
                  className="p-1 text-text-muted hover:text-red-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => addImageUrl("gallery_images")}
              className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-sm hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} /> 갤러리 이미지 추가
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
      </div>

      {/* === Section 8: Figma Designs === */}
      <div className="rounded-2xl border border-border bg-bg-card mb-4 overflow-hidden">
        <SectionHeader
          id="figma"
          title="8. Figma 디자인"
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
      </div>

      {/* Bottom save */}
      <div className="flex justify-end gap-3 mt-8 mb-12">
        <Link
          href="/admin/products"
          className="px-6 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-bg-card-hover transition-colors"
        >
          취소
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-bg-dark font-semibold hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          <Save size={16} /> {saving ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
