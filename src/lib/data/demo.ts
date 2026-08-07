/**
 * DEMONSTRATION FIXTURES — DELETE IN PHASE 2.
 *
 * The admin CMS screens were built before the repository was wired up, so they
 * render from these fixtures. They are NOT the syndicate's data and must never
 * reach production: Phase 2 replaces every read here with a
 * `ContentRepository` call backed by Data Connect.
 *
 * They live in this module rather than inside the components for two reasons:
 * literal Arabic in a component violates CLAUDE.md §2, and a fixture rebuilt
 * on every render cannot be listed as a `useEffect` dependency.
 */

export interface DemoBlockItem {
  id: string
  type: string
  region: 'main' | 'aside'
  position: number
  config: Record<string, unknown>
  text: {
    heading?: string
    subheading?: string
    body?: string
    ctaLabel?: string
    badgeText?: string
    items?: unknown[]
    [key: string]: unknown
  }
}

export interface DemoNewsItem {
  id: string
  slug: string
  title: string
  category: string
  publishedAt: string
  status: 'draft' | 'published' | 'scheduled'
  featuredImage: string
  excerpt: string
}

export const DEMO_BLOCKS: DemoBlockItem[] = [
  {
    id: 'b1',
    type: 'hero',
    region: 'main',
    position: 10,
    config: { variant: 'split', showBadge: true },
    text: {
      badgeText: 'المنصة الرسمية لنقابة المساحة',
      heading: 'نقابة أصحاب مكاتب المساحة في الأردن',
      body: 'الكيان القانوني والنقابي الذي يجمع المساحين المرخصين والمزاولين للمهنة في المملكة الأردنية الهاشمية.',
      ctaLabel: 'دليل المساحين',
    },
  },
  {
    id: 'b2',
    type: 'stat_counters',
    region: 'main',
    position: 20,
    config: { columns: 3 },
    text: {
      items: [
        { label: 'مكتب مساحي مرخص', value: '450' },
        { label: 'مساح مزاول', value: '1,200' },
        { label: 'تأسست عام', value: '1999' },
      ],
    },
  },
  {
    id: 'b3',
    type: 'service_grid',
    region: 'main',
    position: 30,
    config: { columns: 4 },
    text: {
      heading: 'الخدمات الإلكترونية السريعة',
      items: [
        { title: 'دفع الرسوم', description: 'اشتراكات وخدمات' },
        { title: 'طلب شهادة', description: 'شهادة حسن سيرة' },
        { title: 'التحقق من صحة شهادة', description: 'خدمة التحقق الفوري' },
        { title: 'تقديم شكوى', description: 'منازعات وتظلمات المهنة' },
      ],
    },
  },
  {
    id: 'b4',
    type: 'news_feed',
    region: 'main',
    position: 40,
    config: { limit: 3, layout: 'grid' },
    text: {
      heading: 'أخبار وإعلانات النقابة',
    },
  },
]

export const DEMO_POSTS: DemoNewsItem[] = [
  {
    id: 'p1',
    slug: 'annual-general-assembly-2025',
    title: 'اجتماع الهيئة العامة السنوي للنقابة لعام 2025',
    category: 'إعلانات',
    publishedAt: '2025-01-15',
    status: 'published',
    featuredImage: '/images/news/assembly-meeting.png',
    excerpt: 'دعوة جميع الأعضاء لحضور الاجتماع السنوي العادي للهيئة العامة واستعراض التقارير المالية والإدارية.',
  },
  {
    id: 'p2',
    slug: 'survey-tariff-update-2025',
    title: 'تحديث تعرفة الخدمات المساحية للربع الأول',
    category: 'إعلانات',
    publishedAt: '2025-01-10',
    status: 'published',
    featuredImage: '/images/news/tariff-update.png',
    excerpt: 'إعلان عن التعرفة الجديدة لأعمال المساحة والمسح العقاري المعتمدة بالتعاون مع دائرة الأراضي والمساحة.',
  },
  {
    id: 'p3',
    slug: 'gis-training-workshop-2024',
    title: 'ورشة تدريبية متخصصة حول تطبيقات نظم المعلومات الجغرافية GIS',
    category: 'تدريب',
    publishedAt: '2024-12-28',
    status: 'published',
    featuredImage: '/images/news/gis-workshop.png',
    excerpt: 'إقامة دورة تدريبية متقدمة لمنتسبي النقابة بالتعاون مع المركز الجغرافي الملكي الأردني.',
  },
]
