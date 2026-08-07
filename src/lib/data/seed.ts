import type { Locale } from '@/i18n/config'

/**
 * Phase 1 seed content, harvested from the syndicate's existing site.
 * Source of truth: design/content-inventory.md
 *
 * Phase 2 moves all of this into PostgreSQL via Data Connect and this file
 * becomes the migration seed. Page code never imports from here — it goes
 * through `getRepository()`.
 */

type L = Record<Locale, string>

export const governorates: Array<{ id: string; code: string; name: L }> = [
  { id: 'g01', code: 'amman', name: { ar: 'عمان', en: 'Amman' } },
  { id: 'g02', code: 'irbid', name: { ar: 'إربد', en: 'Irbid' } },
  { id: 'g03', code: 'zarqa', name: { ar: 'الزرقاء', en: 'Zarqa' } },
  { id: 'g04', code: 'aqaba', name: { ar: 'العقبة', en: 'Aqaba' } },
  { id: 'g05', code: 'mafraq', name: { ar: 'المفرق', en: 'Mafraq' } },
  { id: 'g06', code: 'jerash', name: { ar: 'جرش', en: 'Jerash' } },
  { id: 'g07', code: 'madaba', name: { ar: 'مادبا', en: 'Madaba' } },
  { id: 'g08', code: 'karak', name: { ar: 'الكرك', en: 'Karak' } },
  { id: 'g09', code: 'tafilah', name: { ar: 'الطفيلة', en: 'Tafilah' } },
  { id: 'g10', code: 'maan', name: { ar: 'معان', en: "Ma'an" } },
  { id: 'g11', code: 'ajloun', name: { ar: 'عجلون', en: 'Ajloun' } },
  { id: 'g12', code: 'balqa', name: { ar: 'البلقاء', en: 'Balqa' } },
]

/**
 * DEMONSTRATION DATA ONLY.
 *
 * The syndicate's real member register has not been supplied — see open
 * question Q3 in docs/01-prd.md. These are invented records with invented
 * licence numbers, present so the directory, search normalisation, and
 * governorate filtering can be built and reviewed. They MUST be replaced by
 * the real import before launch and must never reach production.
 */
export const members = [
  {
    id: 'm01', licenseNumber: 'SV-1042', membershipNumber: 'ASOO-0412',
    governorateCode: 'amman', category: { ar: 'صاحب مكتب', en: 'Office owner' },
    status: 'active' as const, joinedAt: '2004-03-14',
    fullName: { ar: 'أحمد وليد المصري', en: 'Ahmad Waleed Al-Masri' },
    officeName: { ar: 'مكتب الميزان للمساحة', en: 'Al-Mizan Surveying Office' },
    specializations: { ar: ['إفراز الأراضي', 'المساحة الميدانية'], en: ['Land subdivision', 'Field survey'] },
    phone: '+962 6 461 2233', email: 'info@almizan-survey.jo',
    address: { ar: 'عمّان — جبل الحسين', en: 'Amman — Jabal Al-Hussein' },
  },
  {
    id: 'm02', licenseNumber: 'SV-2287', membershipNumber: 'ASOO-0788',
    governorateCode: 'irbid', category: { ar: 'مساح مزاول', en: 'Practising surveyor' },
    status: 'active' as const, joinedAt: '2011-09-02',
    fullName: { ar: 'رنا سليمان العبادي', en: 'Rana Suleiman Al-Abbadi' },
    officeName: { ar: 'مكتب الشمال الهندسي', en: 'Northern Engineering Office' },
    specializations: { ar: ['نظم المعلومات الجغرافية', 'التسوية'], en: ['GIS', 'Land settlement'] },
    phone: '+962 2 725 8890', email: 'contact@northern-eng.jo',
    address: { ar: 'إربد — شارع الجامعة', en: 'Irbid — University Street' },
  },
  {
    id: 'm03', licenseNumber: 'SV-3319', membershipNumber: 'ASOO-1103',
    governorateCode: 'zarqa', category: { ar: 'صاحب مكتب', en: 'Office owner' },
    status: 'active' as const, joinedAt: '2016-01-20',
    fullName: { ar: 'محمود خالد الزعبي', en: 'Mahmoud Khaled Al-Zoubi' },
    officeName: { ar: 'مكتب الدقة للمساحة والتنظيم', en: 'Precision Survey & Planning' },
    specializations: { ar: ['مخططات المواقع', 'الرفع المساحي'], en: ['Site plans', 'Topographic survey'] },
    phone: '+962 5 398 4412', email: 'office@precision-survey.jo',
    address: { ar: 'الزرقاء — الوسط التجاري', en: 'Zarqa — Commercial Centre' },
  },
  {
    id: 'm04', licenseNumber: 'SV-4176', membershipNumber: 'ASOO-1490',
    governorateCode: 'aqaba', category: { ar: 'مساح مزاول', en: 'Practising surveyor' },
    status: 'active' as const, joinedAt: '2019-06-11',
    fullName: { ar: 'سائد إبراهيم النجار', en: 'Saed Ibrahim Al-Najjar' },
    officeName: { ar: 'مكتب الخليج للمساحة', en: 'Gulf Surveying Office' },
    specializations: { ar: ['المساحة البحرية', 'الرفع المساحي'], en: ['Hydrographic survey', 'Topographic survey'] },
    phone: '+962 3 203 7761', email: 'gulf@survey-aqaba.jo',
    address: { ar: 'العقبة — المنطقة الاقتصادية', en: 'Aqaba — Economic Zone' },
  },
  {
    id: 'm05', licenseNumber: 'SV-5023', membershipNumber: 'ASOO-1822',
    governorateCode: 'amman', category: { ar: 'صاحب مكتب', en: 'Office owner' },
    status: 'suspended' as const, joinedAt: '2009-11-30',
    fullName: { ar: 'هيا عبد الله الطراونة', en: 'Haya Abdullah Al-Tarawneh' },
    officeName: { ar: 'مكتب المعالم للمساحة', en: 'Landmarks Surveying Office' },
    specializations: { ar: ['إفراز الأراضي'], en: ['Land subdivision'] },
    phone: '+962 6 552 1109', email: 'landmarks@survey.jo',
    address: { ar: 'عمّان — الصويفية', en: 'Amman — Sweifieh' },
  },
  {
    id: 'm06', licenseNumber: 'SV-6288', membershipNumber: 'ASOO-2044',
    governorateCode: 'karak', category: { ar: 'مساح مزاول', en: 'Practising surveyor' },
    status: 'active' as const, joinedAt: '2021-04-05',
    fullName: { ar: 'عمر فايز المجالي', en: 'Omar Fayez Al-Majali' },
    officeName: { ar: 'مكتب الجنوب للمساحة', en: 'Southern Surveying Office' },
    specializations: { ar: ['المساحة الميدانية', 'التسوية'], en: ['Field survey', 'Land settlement'] },
    phone: '+962 3 235 6620', email: 'south@survey-karak.jo',
    address: { ar: 'الكرك — وسط المدينة', en: 'Karak — City Centre' },
  },
]

export const postCategories = [
  { id: 'pc1', slug: 'announcements', name: { ar: 'إعلانات', en: 'Announcements' } },
  { id: 'pc2', slug: 'training', name: { ar: 'تدريب', en: 'Training' } },
  { id: 'pc3', slug: 'agreements', name: { ar: 'اتفاقيات', en: 'Agreements' } },
]

/**
 * The five real news items from the syndicate's site. Only excerpts exist —
 * no article bodies were published, so `body` is null and the article page
 * shows the excerpt with a notice. Full text is open question Q7.
 *
 * `legacyId` preserves the prototype's UUID so old links resolve.
 */
export const posts = [
  {
    id: 'p1', slug: 'annual-general-assembly-2025', categorySlug: 'announcements',
    legacyId: '228149e5-04fb-4123-ada0-c23a1432e1ed', publishedAt: '2025-01-15',
    title: { ar: 'اجتماع الهيئة العامة السنوي للنقابة', en: 'Annual General Assembly Meeting' },
    excerpt: {
      ar: 'دعوة جميع الأعضاء لحضور الاجتماع السنوي العادي للهيئة العامة',
      en: 'All members are invited to attend the ordinary annual meeting of the General Assembly',
    },
    body: null,
    featuredImage: '/images/news/assembly-meeting.png',
  },
  {
    id: 'p2', slug: 'survey-tariff-update-2025', categorySlug: 'announcements',
    legacyId: 'b49e8f9b-5812-4303-bd90-a5fb18d58202', publishedAt: '2025-01-10',
    title: { ar: 'تحديث تعرفة الخدمات المساحية لعام 2025', en: '2025 Survey Services Tariff Update' },
    excerpt: {
      ar: 'إعلان عن التعرفة الجديدة لأعمال المساحة المعتمدة من النقابة',
      en: 'Announcing the new syndicate-approved tariff for surveying work',
    },
    body: null,
    featuredImage: '/images/news/tariff-update.png',
  },
  {
    id: 'p3', slug: 'gis-training-workshop-2024', categorySlug: 'training',
    legacyId: '4fdb9a41-871f-4dad-9350-3d07e529c8a5', publishedAt: '2024-12-28',
    title: { ar: 'ورشة تدريبية حول نظم المعلومات الجغرافية GIS', en: 'GIS Training Workshop' },
    excerpt: {
      ar: 'دورة متخصصة بالتعاون مع المركز الجغرافي الملكي',
      en: 'A specialised course in cooperation with the Royal Jordanian Geographic Centre',
    },
    body: null,
    featuredImage: '/images/news/gis-workshop.png',
  },
  {
    id: 'p4', slug: 'dls-mou-signing-2024', categorySlug: 'agreements',
    legacyId: 'e00d5831-325a-49cd-bf18-f7a667aa36fd', publishedAt: '2024-12-15',
    title: {
      ar: 'توقيع مذكرة تفاهم مع دائرة الأراضي والمساحة',
      en: 'Memorandum of Understanding Signed with the Department of Lands and Survey',
    },
    excerpt: {
      ar: 'تعاون مشترك لتطوير الخدمات المساحية الإلكترونية',
      en: 'Joint cooperation to develop electronic surveying services',
    },
    body: null,
    featuredImage: '/images/news/mou-signing.png',
  },
  {
    id: 'p5', slug: 'board-elections-nominations-2024', categorySlug: 'announcements',
    legacyId: 'e61c7c09-8b02-4ff8-987a-9929ae62e656', publishedAt: '2024-12-01',
    title: { ar: 'فتح باب الترشح لانتخابات مجلس النقابة', en: 'Nominations Open for Syndicate Board Elections' },
    excerpt: {
      ar: 'الإعلان عن الجدول الزمني للانتخابات الجديدة',
      en: 'Announcing the timetable for the new elections',
    },
    body: null,
    featuredImage: '/images/news/board-elections.png',
  },
]

export const documentCategories = [
  { id: 'dc1', slug: 'legislation', name: { ar: 'تشريعات', en: 'Legislation' } },
  { id: 'dc2', slug: 'tariffs', name: { ar: 'تعرفة', en: 'Tariffs' } },
  { id: 'dc3', slug: 'instructions', name: { ar: 'تعليمات', en: 'Instructions' } },
  { id: 'dc4', slug: 'forms', name: { ar: 'نماذج', en: 'Forms' } },
]

/**
 * All five carry `fileUrl: null` — the syndicate's site marks every one of
 * them "available at the syndicate office" and attaches no file. The UI shows
 * that state honestly rather than offering a download that does not exist.
 * Obtaining the PDFs is open question Q7.
 */
export const documents = [
  {
    id: 'd1', slug: 'regulation-105-1999', categorySlug: 'legislation',
    officialReference: 'رقم (105) لسنة 1999',
    title: {
      ar: 'نظام نقابة أصحاب المكاتب المساحية رقم (105) لسنة 1999',
      en: 'Regulation No. 105 of 1999 of the Syndicate of Surveying Office Owners',
    },
    description: {
      ar: 'النظام الأساسي للنقابة الصادر بمقتضى قانون نقابة المساحين',
      en: "The syndicate's founding regulation, issued under the Surveyors Syndicate Law",
    },
    fileUrl: null, fileSize: null, mimeType: null, externalUrl: null,
  },
  {
    id: 'd2', slug: 'law-43-1972', categorySlug: 'legislation',
    officialReference: 'رقم (43) لسنة 1972',
    title: {
      ar: 'قانون نقابة المساحين الأردنيين رقم (43) لسنة 1972',
      en: 'Jordanian Surveyors Syndicate Law No. 43 of 1972',
    },
    description: {
      ar: 'القانون الناظم لمهنة المساحة في المملكة الأردنية الهاشمية',
      en: 'The law governing the surveying profession in the Hashemite Kingdom of Jordan',
    },
    fileUrl: null, fileSize: null, mimeType: null, externalUrl: null,
  },
  {
    id: 'd3', slug: 'survey-tariff-2025', categorySlug: 'tariffs',
    officialReference: null,
    title: { ar: 'جدول تعرفة الخدمات المساحية 2025', en: '2025 Survey Services Tariff Schedule' },
    description: {
      ar: 'الأسعار الرسمية المعتمدة لأعمال الإفراز والتسوية والمساحة الميدانية',
      en: 'Approved official rates for subdivision, settlement, and field survey work',
    },
    fileUrl: null, fileSize: null, mimeType: null, externalUrl: null,
  },
  {
    id: 'd4', slug: 'membership-application-form', categorySlug: 'forms',
    officialReference: null,
    title: { ar: 'نموذج طلب عضوية جديدة', en: 'New Membership Application Form' },
    description: {
      ar: 'النموذج الرسمي للتقدم لعضوية النقابة مع قائمة المستندات المطلوبة',
      en: 'The official application form with the required document checklist',
    },
    fileUrl: null, fileSize: null, mimeType: null, externalUrl: null,
  },
  {
    id: 'd5', slug: 'professional-practice-instructions', categorySlug: 'instructions',
    officialReference: null,
    title: { ar: 'تعليمات ممارسة المهنة', en: 'Professional Practice Instructions' },
    description: {
      ar: 'الأسس والإجراءات الفنية الواجب التزامها أثناء تنفيذ الأعمال المساحية',
      en: 'Technical principles and procedures to follow when carrying out survey work',
    },
    fileUrl: null, fileSize: null, mimeType: null, externalUrl: null,
  },
]

export const externalLinks = [
  {
    id: 'l1', groupCode: 'gov_services' as const, icon: 'file-text',
    url: 'https://portal.dls.gov.jo/',
    title: { ar: 'خدمات دائرة الأراضي والمساحة', en: 'Department of Lands and Survey services' },
    description: {
      ar: 'تقديم الطلبات الإلكترونية، الاستعلام عن القيود، والدفع الإلكتروني الخاص بدائرة الأراضي.',
      en: 'E-applications, records enquiry, and DLS online payment.',
    },
  },
  {
    id: 'l2', groupCode: 'gov_services' as const, icon: 'globe',
    url: 'https://services.amman.jo/',
    title: { ar: 'خدمات أمانة عمان الكبرى', en: 'Greater Amman Municipality services' },
    description: {
      ar: 'الخدمات الإلكترونية المتكاملة لأمانة عمان: تراخيص المهن، رخص الأبنية، والمسقفات.',
      en: 'Professional licences, building permits, and property tax.',
    },
  },
  {
    id: 'l3', groupCode: 'gov_services' as const, icon: 'layout-grid',
    url: 'https://eservices.mola.gov.jo/',
    title: { ar: 'خدمات البلديات (وزارة الإدارة المحلية)', en: 'Municipal services (Ministry of Local Administration)' },
    description: {
      ar: 'بوابة الخدمات الإلكترونية للبلديات في جميع محافظات المملكة.',
      en: 'E-services portal for municipalities across all governorates.',
    },
  },
  {
    id: 'l4', groupCode: 'survey_maps' as const, icon: 'external-link',
    url: 'https://portal.dls.gov.jo/government-services/dls/quick-services/change-statement/apply',
    title: { ar: 'خدمات دائرة الأراضي والمساحة', en: 'DLS e-services' },
    description: {
      ar: 'بوابة الخدمات الإلكترونية — تقديم طلبات بيان التغيير والخدمات السريعة.',
      en: 'Change-statement applications and quick services.',
    },
  },
  {
    id: 'l5', groupCode: 'survey_maps' as const, icon: 'map',
    url: 'https://maps.dls.gov.jo/dlsweb/',
    title: { ar: 'موقع الأراضي والمساحة', en: 'DLS maps' },
    description: {
      ar: 'عرض المخططات المساحية والمعلومات العقارية.',
      en: 'Survey plans and property information.',
    },
  },
  {
    id: 'l6', groupCode: 'survey_maps' as const, icon: 'globe',
    url: 'https://rjhgis.jo/',
    title: { ar: 'نظام المعلومات الجغرافية الأردني', en: 'Jordanian GIS — Royal Jordanian Geographic Centre' },
    description: {
      ar: 'النظام الموحد للمعلومات الجغرافية — المركز الجغرافي الملكي.',
      en: 'The unified national geographic information system.',
    },
  },
  {
    id: 'l7', groupCode: 'survey_maps' as const, icon: 'layout-grid',
    // NOTE: plain HTTP. Flagged in design/content-inventory.md — linking a
    // government portal over HTTP from a government portal is a real risk.
    url: 'http://www.ammancitygis.gov.jo/ammanexplorer/',
    title: { ar: 'خارطة عمان الرقمية (Amman Explorer)', en: 'Amman Explorer' },
    description: {
      ar: 'المستكشف الجغرافي لمدينة عمان من أمانة عمان الكبرى.',
      en: "Greater Amman Municipality's geographic explorer for zoning plans and landmarks.",
    },
  },
]

export const pages: Record<string, { title: L; body: L }> = {
  about: {
    title: { ar: 'عن النقابة', en: 'About the Syndicate' },
    body: {
      ar: 'نقابة أصحاب مكاتب المساحة في الأردن (تأسست 1999) هي الكيان القانوني والنقابي الذي يجمع المساحين المرخصين والمزاولين للمهنة. تهدف إلى تنظيم القطاع المساحي، ضبط جودة الخدمات الفنية، وتوحيد معايير الأعمال المساحية، والحفاظ على حقوق أصحاب المهنة المنتسبين للنقابة، وحل النزاعات العقارية بالتعاون مع دائرة الأراضي والمساحة، وتنفيذ المخططات الحضرية المُعدّة من قبل دوائر التنظيم.',
      en: 'The Syndicate of Surveying Office Owners in Jordan (established 1999) is the legal and professional body representing licensed and practising surveyors. It regulates the surveying sector, upholds the quality of technical services, standardises surveying practice, protects the rights of its members, resolves property disputes in cooperation with the Department of Lands and Survey, and implements urban plans prepared by planning authorities.',
    },
  },
}

export const aboutPillars = [
  {
    key: 'mission',
    title: { ar: 'رسالتنا', en: 'Our mission' },
    body: {
      ar: 'تنظيم مهنة المساحة وحماية حقوق منتسبيها، وضبط جودة الأعمال الفنية بما يحفظ مصالح المواطن والمستثمر.',
      en: 'To regulate the surveying profession and protect the rights of its members, upholding technical quality in a way that safeguards the interests of citizens and investors.',
    },
  },
  {
    key: 'vision',
    title: { ar: 'رؤيتنا', en: 'Our vision' },
    body: {
      ar: 'نقابة رائدة تواكب التحول الرقمي للخدمات المساحية والعقارية في الأردن.',
      en: 'A leading syndicate keeping pace with the digital transformation of surveying and property services in Jordan.',
    },
  },
  {
    key: 'values',
    title: { ar: 'قيمنا', en: 'Our values' },
    body: {
      ar: 'النزاهة، الدقة الفنية، استقلالية المهنة، والشراكة مع المؤسسات الرسمية.',
      en: 'Integrity, technical precision, professional independence, and partnership with official institutions.',
    },
  },
]

/** The homepage composition. Mirrors docs/09-cms.md §8. */
export const homepageBlocks = [
  {
    id: 'b1', type: 'hero' as const, region: 'main' as const, position: 10,
    config: { variant: 'split', showBadge: true, primaryCta: { href: '/directory' }, secondaryCta: { href: '/about' } },
    text: {
      badgeText: { ar: 'تأسست عام 1999', en: 'Established 1999' },
      heading: { ar: 'نقابة أصحاب مكاتب المساحة في الأردن', en: 'Syndicate of Surveying Office Owners in Jordan' },
      body: {
        ar: 'الكيان القانوني والنقابي الذي يجمع المساحين المرخصين والمزاولين للمهنة. تهدف إلى تنظيم القطاع المساحي، ضبط جودة الخدمات الفنية، وحل النزاعات العقارية بالتعاون مع دائرة الأراضي والمساحة.',
        en: 'The legal and professional body representing licensed and practising surveyors. It regulates the surveying sector, upholds the quality of technical services, and resolves property disputes in cooperation with the Department of Lands and Survey.',
      },
      ctaLabel: { ar: 'البحث عن عضو', en: 'Find a member' },
      secondaryCtaLabel: { ar: 'عن النقابة', en: 'About the syndicate' },
    },
  },
  {
    id: 'b2', type: 'stat_counters' as const, region: 'main' as const, position: 20,
    config: {
      columns: 2, animate: true,
      items: [
        { value: '450', suffix: '+', icon: 'building-2', href: '/directory' },
        { value: '1200', suffix: '', icon: 'users', href: '/directory' },
      ],
    },
    text: {
      items: [
        { label: { ar: 'مكتب مساحي مرخص', en: 'Licensed surveying offices' } },
        { label: { ar: 'مساح مرخص', en: 'Licensed surveyors' } },
      ],
    },
  },
  {
    id: 'b3', type: 'directory_search' as const, region: 'main' as const, position: 25,
    config: { showGovernorateFilter: true },
    text: {
      heading: { ar: 'تحقق من مساح مرخص', en: 'Verify a licensed surveyor' },
      subheading: {
        ar: 'ابحث في سجل المساحين وأصحاب المكاتب المعتمدين لدى النقابة.',
        en: 'Search the register of syndicate-accredited surveyors and office owners.',
      },
    },
  },
  {
    id: 'b4', type: 'service_grid' as const, region: 'main' as const, position: 30,
    config: {
      columns: 4,
      items: [
        { icon: 'map', href: '/maps' },
        { icon: 'scale', href: '/contact' },
        { icon: 'user-check', href: '/login' },
        { icon: 'credit-card', href: '/services' },
      ],
    },
    text: {
      heading: { ar: 'خدمات النقابة', en: 'Syndicate services' },
      items: [
        {
          title: { ar: 'مخططات الموقع', en: 'Site plans' },
          description: { ar: 'إصدار وتدقيق مخططات الأراضي والمباني', en: 'Issuing and auditing land and building plans' },
        },
        {
          title: { ar: 'الاستشارات القانونية', en: 'Legal consultation' },
          description: { ar: 'فض النزاعات الحدودية والفنية', en: 'Resolving boundary and technical disputes' },
        },
        {
          title: { ar: 'خدمات الأعضاء', en: 'Member services' },
          description: { ar: 'تجديد العضوية والاشتراكات السنوية', en: 'Membership renewal and annual subscriptions' },
        },
        {
          title: { ar: 'المعاملات الإلكترونية', en: 'E-transactions' },
          description: { ar: 'الدفع الإلكتروني للفواتير والاشتراكات', en: 'Electronic payment of bills and subscriptions' },
        },
      ],
    },
  },
  {
    id: 'b5', type: 'link_cards' as const, region: 'main' as const, position: 40,
    config: { groupCode: 'gov_services', columns: 3 },
    text: {
      heading: { ar: 'المعاملات الإلكترونية والخدمات الحكومية', en: 'E-transactions and government services' },
    },
  },
  {
    id: 'b6', type: 'link_cards' as const, region: 'main' as const, position: 50,
    config: { groupCode: 'survey_maps', columns: 4 },
    text: {
      heading: { ar: 'الخدمات المساحية والخرائط الرسمية', en: 'Survey services and official maps' },
    },
  },
  {
    id: 'b7', type: 'cta_banner' as const, region: 'main' as const, position: 60,
    config: { variant: 'brand', href: 'https://tracking.dls.gov.jo:8443/ords/r/dlsinfo/dls-information/surveyors', isExternal: true },
    text: {
      heading: { ar: 'دليل المساحين المرخصين', en: 'Licensed surveyors registry' },
      body: {
        ar: 'تصفح الدليل الرسمي للمساحين المرخصين لدى دائرة الأراضي والمساحة للتحقق من حالات التراخيص والمكاتب المساحية المعتمدة.',
        en: 'Browse the official registry of surveyors licensed by the Department of Lands and Survey to verify licence status and accredited surveying offices.',
      },
      ctaLabel: { ar: 'فتح دليل المساحين المرخصين', en: 'Open the registry' },
    },
  },
  {
    id: 'b8', type: 'news_feed' as const, region: 'aside' as const, position: 10,
    config: { limit: 5, layout: 'list', showDate: true, showExcerpt: true, showViewAll: true },
    text: {
      heading: { ar: 'آخر الأخبار', en: 'Latest news' },
      viewAllLabel: { ar: 'عرض جميع الأخبار', en: 'View all news' },
    },
  },
]
