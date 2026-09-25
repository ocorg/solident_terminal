// Seed data from docs/SPEC.md §1. Safe to re-run: rows are upserted by slug/key.
// Arabic and English texts are DRAFTS to be reviewed before publishing.
// Map coordinates are only set where the place is known at town level; others stay null (fill in /admin).
import '../load-env'
import { prisma, type EventType, type PartnerType } from '../src/index'

const d = (iso: string) => new Date(`${iso}T00:00:00Z`)

// ───────────── Programmes ─────────────
const programmes = [
  {
    slug: 'caravanes',
    order: 1,
    titleFr: 'Caravanes dentaires',
    titleAr: 'القوافل الطبية لطب الأسنان',
    titleEn: 'Dental caravans',
    summaryFr:
      "Des caravanes médicales et humanitaires qui apportent soins bucco-dentaires gratuits et prévention aux communautés défavorisées. Édition phare 2026 : la Caravane Jissr Attadamon.",
    summaryAr:
      'قوافل طبية وإنسانية تقدم علاجات مجانية لصحة الفم والأسنان والتوعية الوقائية للساكنة المحتاجة. النسخة الرئيسية لسنة 2026: قافلة جسر التضامن.',
    summaryEn:
      'Medical and humanitarian caravans bringing free oral-health care and prevention to underserved communities. 2026 flagship edition: the Jissr Attadamon Caravan.',
  },
  {
    slug: 'volet-scientifique',
    order: 2,
    titleFr: 'Volet scientifique',
    titleAr: 'الشق العلمي',
    titleEn: 'Scientific programme',
    summaryFr:
      'Journées scientifiques pour étudiants et praticiens ; leurs recettes financent nos actions solidaires.',
    summaryAr: 'أيام علمية لفائدة الطلبة والممارسين، تُموّل مداخيلها أنشطتنا التضامنية.',
    summaryEn: 'Scientific days for students and practitioners; their revenue funds our solidarity actions.',
  },
  {
    slug: 'solifun',
    order: 3,
    titleFr: 'Solifun',
    titleAr: 'سوليفان',
    titleEn: 'Solifun',
    summaryFr:
      '« Play hard, give harder » : padel, vélo, kayak, foot, FIFA et voyages pour collecter des fonds.',
    summaryAr: '« Play hard, give harder »: بادل، دراجات، كاياك، كرة القدم، فيفا ورحلات لجمع التبرعات.',
    summaryEn: '"Play hard, give harder": padel, cycling, kayak, football, FIFA and trips that raise funds.',
  },
  {
    slug: 'jeunes-ambassadeurs',
    order: 4,
    titleFr: 'Jeunes ambassadeurs',
    titleAr: 'السفراء الشباب',
    titleEn: 'Young ambassadors',
    summaryFr:
      "Journées de prévention de l'hygiène bucco-dentaire dans les écoles, avec distribution de kits de brossage.",
    summaryAr: 'أيام توعوية بنظافة الفم والأسنان في المدارس مع توزيع أدوات تنظيف الأسنان.',
    summaryEn: 'Oral-hygiene prevention days in schools, with brushing kits for pupils.',
  },
  {
    slug: 'basmat-al-amal',
    order: 5,
    titleFr: 'Basmat Al Amal',
    titleAr: 'بسمة الأمل',
    titleEn: 'Basmat Al Amal',
    summaryFr: 'Soins dentaires complets et prothèses pour les résidents de maisons de retraite.',
    summaryAr: 'علاجات شاملة للأسنان وأطقم أسنان لفائدة نزلاء دور المسنين.',
    summaryEn: 'Full dental care and dentures for retirement-home residents.',
  },
  {
    slug: 'actions-complementaires',
    order: 6,
    isActive: false, // not shown as a programme card; holds orphanage visits, iftars, collaborations
    titleFr: 'Actions complémentaires',
    titleAr: 'أنشطة تكميلية',
    titleEn: 'Complementary actions',
    summaryFr: "Collaborations, visites d'orphelinats et de maisons de retraite.",
    summaryAr: 'شراكات وزيارات لدور الأيتام ودور المسنين.',
    summaryEn: 'Collaborations, orphanage and retirement-home visits.',
  },
]

// ───────────── Partners ─────────────
const partners: { slug: string; name: string; type: PartnerType }[] = [
  { slug: 'mc-pharma', name: 'MC Pharma', type: 'sponsor' },
  { slug: 'colgate', name: 'Colgate', type: 'sponsor' },
  { slug: 'fondation-orient-occident', name: 'Fondation Orient-Occident', type: 'association' },
  { slug: 'caravane-al-amal', name: 'Caravane Al Amal', type: 'association' },
  { slug: 'scoutisme-hassania-ksar', name: 'Scoutisme Hassania Marocain (Ksar El Kébir)', type: 'association' },
  { slug: 'club-sahara-padel', name: 'Club Sahara Padel', type: 'sport' },
  { slug: 'mj-bike', name: 'MJ Bike', type: 'sport' },
  { slug: 'hotel-des-thermes', name: 'Hôtel des Thermes', type: 'sponsor' },
  { slug: 'espoir-sportif-nautique', name: 'Espoir Sportif Nautique', type: 'sport' },
  { slug: 'le-declic', name: 'Le Déclic', type: 'association' },
  { slug: 'al-akhawayn-university', name: 'Al Akhawayn University', type: 'universite' },
  { slug: 'fondation-safir', name: 'Fondation Safir', type: 'association' },
  { slug: 'club-affaires-sociales-inpt', name: 'Club Affaires Sociales INPT', type: 'universite' },
  { slug: 'groupe-scolaire-les-quatre-temps', name: 'Groupe Scolaire Les Quatre Temps', type: 'ecole' },
  { slug: 'high-tech-groupe-scolaire', name: 'High-Tech Groupe Scolaire', type: 'ecole' },
  { slug: 'silent-believers-distribution', name: 'Silent Believers Distribution', type: 'sponsor' },
  { slug: 'association-caritative-islamique', name: 'Association Caritative Islamique', type: 'association' },
  { slug: 'racines-marocaines-sans-frontieres', name: 'Racines marocaines sans frontières', type: 'association' },
  { slug: 'ecdh', name: 'ECDH', type: 'association' },
  { slug: 'les-racines-d-espoir', name: "Les racines d'espoir", type: 'association' },
  { slug: 'enimbenevolat', name: 'Enimbenevolat', type: 'association' },
  { slug: 'hand-in-hand-aui', name: 'Hand in Hand AUI', type: 'universite' },
]

// ───────────── Actions ─────────────
type ActionSeed = {
  slug: string
  programme: string
  titleFr: string
  titleAr: string
  titleEn: string
  dateStart: string
  dateEnd?: string
  location?: string
  lat?: number
  lng?: number
  beneficiariesCount?: number
  partners: string[]
  bodyFr: string
  bodyAr: string
  bodyEn: string
}

const caravanBody = (partnerName: string) => ({
  bodyFr: `Consultations, détartrages, extractions, séances de prévention, distribution de kits dentaires et de médicaments, en partenariat avec ${partnerName}.`,
  bodyAr: `فحوصات، تنظيف الجير، قلع الأسنان، حصص توعوية، وتوزيع أدوات العناية بالأسنان والأدوية، بشراكة مع ${partnerName}.`,
  bodyEn: `Consultations, scaling, extractions, prevention sessions, and distribution of dental kits and medicines, in partnership with ${partnerName}.`,
})

// [slug, dateStart, dateEnd?, location FR, location AR, partner slug, lat?, lng?]
const caravans: [string, string, string | null, string, string, string, number?, number?][] = [
  ['tamesna-2026', '2026-04-18', null, 'Tamesna', 'تامسنا', 'racines-marocaines-sans-frontieres', 33.82, -6.92],
  ['bouqachmir-2025', '2025-12-20', '2025-12-21', 'Bouqachmir', 'بوقشمير', 'caravane-al-amal'],
  ['bni-leit-2025', '2025-08-16', null, 'Bni Leit', 'بني ليت', 'ecdh'],
  ['ifrane-2025', '2025-07-12', '2025-07-13', "Région d'Ifrane", 'إقليم إفران', 'les-racines-d-espoir', 33.53, -5.11],
  ['souk-tolba-2025', '2025-06-28', '2025-06-29', 'Souk Tolba', 'سوق الطلبة', 'scoutisme-hassania-ksar'],
  ['al-mussaly-2025', '2025-04-25', '2025-04-27', 'Al Mussaly', 'المصلى', 'enimbenevolat'],
  ['ait-oumdiss-2025', '2025-02-14', null, 'Aït Oumdiss', 'آيت أومديس', 'club-affaires-sociales-inpt'],
  ['oulad-hmid-2025', '2025-01-25', '2025-01-26', 'Oulad Hmid', 'أولاد حميد', 'scoutisme-hassania-ksar'],
  ['assoul-2024', '2024-12-07', '2024-12-08', 'Assoul', 'أسول', 'caravane-al-amal', 31.95, -5.21],
  ['boujadian-2024', '2024-11-16', '2024-11-17', 'Boujadian', 'بوجديان', 'scoutisme-hassania-ksar'],
  ['ksar-el-kebir-2024', '2024-10-05', null, 'Ksar El Kébir', 'القصر الكبير', 'hand-in-hand-aui', 35.0, -5.9],
  ['ait-ouadfal-2024', '2024-09-28', null, 'Aït Ouadfal', 'آيت وادفال', 'club-affaires-sociales-inpt'],
  ['had-lgharbia-2024', '2024-09-25', null, 'Had Lgharbia', 'حد الغربية', 'fondation-safir'],
  ['bni-harchen-2024', '2024-08-17', null, 'Bni Harchen', 'بني حرشن', 'ecdh'],
]

const partnerName = (slug: string) => partners.find((p) => p.slug === slug)!.name

const actions: ActionSeed[] = [
  ...caravans.map(([slug, start, end, loc, locAr, partner, lat, lng]) => ({
    slug,
    programme: 'caravanes',
    titleFr: `Caravane dentaire – ${loc}`,
    titleAr: `قافلة طب الأسنان – ${locAr}`,
    titleEn: `Dental caravan – ${loc}`,
    dateStart: start,
    dateEnd: end ?? undefined,
    location: loc,
    lat,
    lng,
    partners: [partner],
    ...caravanBody(partnerName(partner)),
  })),
  {
    slug: 'jeunes-ambassadeurs-2025-2026',
    programme: 'jeunes-ambassadeurs',
    titleFr: 'Jeunes ambassadeurs 2025–2026',
    titleAr: 'السفراء الشباب 2025–2026',
    titleEn: 'Young ambassadors 2025–2026',
    dateStart: '2025-12-01',
    dateEnd: '2026-03-31',
    partners: ['groupe-scolaire-les-quatre-temps', 'high-tech-groupe-scolaire'],
    bodyFr:
      '8 journées de prévention dans les écoles : Laithe, La Renaissance, Riad Alandalus, Les Capucines, Chams Al Maarifa, Jil Tadamone, Les 4 Temps, High Tech Az-Zahraa.',
    bodyAr:
      '8 أيام توعوية في المدارس: Laithe، La Renaissance، رياض الأندلس، Les Capucines، شمس المعرفة، جيل التضامن، Les 4 Temps، High Tech الزهراء.',
    bodyEn:
      '8 prevention days in schools: Laithe, La Renaissance, Riad Alandalus, Les Capucines, Chams Al Maarifa, Jil Tadamone, Les 4 Temps, High Tech Az-Zahraa.',
  },
  {
    slug: 'basmat-al-amal-2-ain-el-aouda',
    programme: 'basmat-al-amal',
    titleFr: 'Basmat Al Amal 2.0 – Aïn El Aouda',
    titleAr: 'بسمة الأمل 2.0 – عين عودة',
    titleEn: 'Basmat Al Amal 2.0 – Ain El Aouda',
    dateStart: '2025-11-01',
    dateEnd: '2026-04-30',
    location: 'Aïn El Aouda',
    lat: 33.8,
    lng: -6.79,
    beneficiariesCount: 31,
    partners: [],
    bodyFr:
      "9 journées d'action à la maison de retraite d'Aïn El Aouda : 16 résidents sur 31 entièrement traités avec prothèses ; 21 sur 31 ont bénéficié d'un examen de la vue et de lunettes.",
    bodyAr:
      '9 أيام عمل بدار المسنين بعين عودة: 16 من أصل 31 نزيلاً استفادوا من علاج كامل وأطقم أسنان، و21 من أصل 31 استفادوا من فحص النظر ونظارات.',
    bodyEn:
      '9 action days at the Ain El Aouda retirement home: 16 of 31 residents fully treated with dentures; 21 of 31 received eye exams and glasses.',
  },
  {
    slug: 'journee-imagerie-dentaire-2026',
    programme: 'volet-scientifique',
    titleFr: 'Journée scientifique : Imagerie dentaire au cœur du diagnostic moderne',
    titleAr: 'يوم علمي: التصوير الإشعاعي للأسنان في صميم التشخيص الحديث',
    titleEn: 'Scientific day: Dental imaging at the heart of modern diagnosis',
    dateStart: '2026-04-04',
    partners: [],
    bodyFr: 'Journée scientifique consacrée à l’imagerie dentaire dans le diagnostic moderne.',
    bodyAr: 'يوم علمي مخصص للتصوير الإشعاعي للأسنان في التشخيص الحديث.',
    bodyEn: 'Scientific day dedicated to dental imaging in modern diagnosis.',
  },
  {
    slug: 'journee-dentistry-unfiltered-2026',
    programme: 'volet-scientifique',
    titleFr: 'Journée scientifique : Dentistry Unfiltered',
    titleAr: 'يوم علمي: Dentistry Unfiltered',
    titleEn: 'Scientific day: Dentistry Unfiltered',
    dateStart: '2026-02-08',
    partners: [],
    bodyFr: 'Journée scientifique « Dentistry Unfiltered ».',
    bodyAr: 'اليوم العلمي « Dentistry Unfiltered ».',
    bodyEn: '"Dentistry Unfiltered" scientific day.',
  },
  {
    slug: 'basmat-al-amal-1-larache',
    programme: 'basmat-al-amal',
    titleFr: 'Basmat Al Amal 1.0 – Larache',
    titleAr: 'بسمة الأمل 1.0 – العرائش',
    titleEn: 'Basmat Al Amal 1.0 – Larache',
    dateStart: '2024-09-01',
    dateEnd: '2026-04-30',
    location: 'Larache',
    lat: 35.19,
    lng: -6.16,
    beneficiariesCount: 32,
    partners: ['association-caritative-islamique'],
    bodyFr:
      "6 week-ends à la maison de retraite de Larache avec l'Association Caritative Islamique : 16 résidents sur 32 entièrement traités avec prothèses.",
    bodyAr: '6 عطل نهاية الأسبوع بدار المسنين بالعرائش مع الجمعية الخيرية الإسلامية: 16 من أصل 32 نزيلاً استفادوا من علاج كامل وأطقم أسنان.',
    bodyEn:
      '6 weekends at the Larache retirement home with Association Caritative Islamique: 16 of 32 residents fully treated with dentures.',
  },
  {
    slug: 'bsaha-ftourhom-2024',
    programme: 'actions-complementaires',
    titleFr: 'Bsaha Ftourhom',
    titleAr: 'بصحة فطورهم',
    titleEn: 'Bsaha Ftourhom',
    dateStart: '2024-04-06',
    location: 'Larache',
    lat: 35.19,
    lng: -6.16,
    beneficiariesCount: 100,
    partners: ['ecdh'],
    bodyFr: "100 repas d'iftar distribués à Larache, avec ECDH.",
    bodyAr: 'توزيع 100 وجبة إفطار بالعرائش بشراكة مع ECDH.',
    bodyEn: '100 iftar meals distributed in Larache, with ECDH.',
  },
  {
    slug: 'visite-orphelinat-larache-2024',
    programme: 'actions-complementaires',
    titleFr: "Visite de l'orphelinat de Larache",
    titleAr: 'زيارة دار الأيتام بالعرائش',
    titleEn: 'Orphanage visit, Larache',
    dateStart: '2024-04-05',
    location: 'Larache',
    lat: 35.19,
    lng: -6.16,
    partners: [],
    bodyFr: "Consultations dentaires, séance de prévention et cadeaux de l'Aïd.",
    bodyAr: 'فحوصات للأسنان، حصة توعوية وهدايا العيد.',
    bodyEn: 'Dental consultations, a prevention session and Eid gifts.',
  },
]

// ───────────── Sponsor tiers (benefits are cumulative) ─────────────
const benefit = {
  social: ['Posts de remerciement et logo sur nos réseaux sociaux', 'منشورات شكر وشعاركم على شبكاتنا الاجتماعية', 'Thank-you posts and logo on our social media'],
  supports: ['Logo sur les supports de la caravane (banderole, roll-up, badges)', 'شعاركم على دعامات القافلة (لافتة، رول-أب، شارات)', 'Logo on caravan materials (banner, roll-up, badges)'],
  video: ['Vidéo « Best Of » de la caravane', 'فيديو « Best Of » للقافلة', 'Caravan "Best Of" video'],
  goodies: ['Goodies à votre marque et distribution de vos flyers', 'هدايا تحمل علامتكم وتوزيع مطوياتكم', 'Branded goodies and distribution of your flyers'],
}
const tierDefs = [
  { slug: 'diamond', name: 'Diamond', minDh: 30000, order: 1, items: [benefit.social, benefit.supports, benefit.video, benefit.goodies] },
  { slug: 'gold', name: 'Gold', minDh: 20000, order: 2, items: [benefit.social, benefit.supports, benefit.video] },
  { slug: 'silver', name: 'Silver', minDh: 10000, order: 3, items: [benefit.social, benefit.supports] },
  { slug: 'bronze', name: 'Bronze', minDh: 3000, order: 4, items: [benefit.social] },
]

// ───────────── Board ─────────────
const board = [
  { fullName: 'Raihan El Achrafi', roleFr: 'Présidente', roleAr: 'الرئيسة', roleEn: 'President', phone: '+212653956056' },
  { fullName: 'Nouhaila Ben Moussa', roleFr: 'Vice-présidente, ressources humaines', roleAr: 'نائبة الرئيسة، الموارد البشرية', roleEn: 'Vice-president, human resources' },
  { fullName: 'Taha Boukour', roleFr: 'Vice-président, relations externes', roleAr: 'نائب الرئيسة، العلاقات الخارجية', roleEn: 'Vice-president, external relations' },
  { fullName: 'Hadil Chebli', roleFr: 'Secrétaire générale', roleAr: 'الكاتبة العامة', roleEn: 'Secretary general' },
  { fullName: 'Mohamed Dobli Bennani', roleFr: 'Vice-secrétaire général', roleAr: 'نائب الكاتبة العامة', roleEn: 'Deputy secretary general' },
  { fullName: 'Nouha Bakkali Maassom', roleFr: 'Trésorière', roleAr: 'أمينة المال', roleEn: 'Treasurer', phone: '+212681922477' },
  { fullName: 'Hidaya Jitane', roleFr: 'Vice-trésorière', roleAr: 'نائبة أمينة المال', roleEn: 'Deputy treasurer' },
  { fullName: 'Yasser Marouan', roleFr: 'Responsable médiatisation', roleAr: 'مسؤول الإعلام', roleEn: 'Media lead' },
  { fullName: 'Iqbal Hammati', roleFr: 'Responsable projets et événements', roleAr: 'مسؤولة المشاريع والفعاليات', roleEn: 'Projects and events lead' },
  { fullName: 'Badreddine Ouali', roleFr: 'Responsable relations externes', roleAr: 'مسؤول العلاقات الخارجية', roleEn: 'External relations lead', phone: '+212612299150' },
  { fullName: 'Hiba Akhazzan', roleFr: 'Conseillère', roleAr: 'مستشارة', roleEn: 'Advisor' },
]

async function main() {
  // Programmes
  const programmeIds = new Map<string, string>()
  for (const p of programmes) {
    const row = await prisma.programme.upsert({ where: { slug: p.slug }, create: p, update: p })
    programmeIds.set(p.slug, row.id)
  }

  // Partners
  const partnerIds = new Map<string, string>()
  for (const [i, p] of partners.entries()) {
    const data = { ...p, order: i + 1 }
    const row = await prisma.partner.upsert({ where: { slug: p.slug }, create: data, update: data })
    partnerIds.set(p.slug, row.id)
  }

  // Actions + partner links
  for (const a of actions) {
    const { programme, partners: links, dateStart, dateEnd, ...rest } = a
    const data = {
      ...rest,
      programmeId: programmeIds.get(programme)!,
      dateStart: d(dateStart),
      dateEnd: dateEnd ? d(dateEnd) : null,
      isPublished: true,
    }
    const row = await prisma.action.upsert({ where: { slug: a.slug }, create: data, update: data })
    await prisma.actionPartner.deleteMany({ where: { actionId: row.id } })
    if (links.length) {
      await prisma.actionPartner.createMany({
        data: links.map((s) => ({ actionId: row.id, partnerId: partnerIds.get(s)! })),
      })
    }
  }

  // Jissr Attadamon: upcoming event + fundraising campaign
  const eventType: EventType = 'caravane'
  const jissrEvent = {
    type: eventType,
    programmeId: programmeIds.get('caravanes')!,
    titleFr: 'Caravane Jissr Attadamon 2026',
    titleAr: 'قافلة جسر التضامن 2026',
    titleEn: 'Jissr Attadamon Caravan 2026',
    bodyFr:
      "Caravane médicale et humanitaire au Douar Oulad Ouchih (Ksar El Kébir) pour environ 400 familles : soins dentaires, rénovation de la mosquée et paniers alimentaires.",
    bodyAr:
      'قافلة طبية وإنسانية بدوار أولاد أوشيح (القصر الكبير) لفائدة حوالي 400 أسرة: علاجات الأسنان، ترميم المسجد وقفف غذائية.',
    bodyEn:
      'Medical and humanitarian caravan in Douar Oulad Ouchih (Ksar El Kébir) for about 400 families: dental care, mosque renovation and food baskets.',
    startsAt: new Date('2026-11-27T09:00:00+01:00'),
    endsAt: new Date('2026-11-29T18:00:00+01:00'),
    location: 'Douar Oulad Ouchih, Ksar El Kébir',
    registrationOpen: false,
    isPublished: true,
  }
  await prisma.event.upsert({
    where: { slug: 'jissr-attadamon-2026' },
    create: { slug: 'jissr-attadamon-2026', ...jissrEvent },
    update: jissrEvent,
  })

  // raisedDh / donorsCount are deliberately not in `update`, so re-seeding never resets real totals.
  const jissrCampaign = {
    titleFr: 'Caravane Jissr Attadamon',
    titleAr: 'قافلة جسر التضامن',
    titleEn: 'Jissr Attadamon Caravan',
    summaryFr:
      'Budget : caravane médicale 80 213 DH · caravane humanitaire 61 350 DH (rénovation de la mosquée 50 900 DH + 50 paniers alimentaires à 209 DH) · transport 15 000 DH.',
    summaryAr:
      'الميزانية: القافلة الطبية 80,213 درهم · القافلة الإنسانية 61,350 درهم (ترميم المسجد 50,900 درهم + 50 قفة غذائية بـ209 دراهم) · النقل 15,000 درهم.',
    summaryEn:
      'Budget: medical caravan 80,213 DH · humanitarian caravan 61,350 DH (mosque renovation 50,900 DH + 50 food baskets at 209 DH) · transport 15,000 DH.',
    goalDh: 156563,
    startsOn: d('2026-10-01'),
    endsOn: d('2026-11-27'),
    isActive: true,
  }
  await prisma.campaign.upsert({
    where: { slug: 'jissr-attadamon-2026' },
    create: { slug: 'jissr-attadamon-2026', ...jissrCampaign },
    update: jissrCampaign,
  })

  // Sponsor tiers
  for (const t of tierDefs) {
    const data = {
      name: t.name,
      minDh: t.minDh,
      order: t.order,
      benefitsFr: t.items.map((b) => b[0]),
      benefitsAr: t.items.map((b) => b[1]),
      benefitsEn: t.items.map((b) => b[2]),
    }
    await prisma.sponsorTier.upsert({ where: { slug: t.slug }, create: { slug: t.slug, ...data }, update: data })
  }

  // Board: no natural unique key, so only seed an empty table (admin edits are never overwritten).
  if ((await prisma.teamMember.count()) === 0) {
    await prisma.teamMember.createMany({
      data: board.map((m, i) => ({ ...m, isPublicContact: Boolean(m.phone), isBoard: true, order: i + 1 })),
    })
  }

  // Impact counters
  const caravanCount = await prisma.action.count({ where: { programmeId: programmeIds.get('caravanes') } })
  const partnerCount = await prisma.partner.count({ where: { isVisible: true } })
  const stats = [
    { key: 'caravans', value: caravanCount, labelFr: 'caravanes dentaires', labelAr: 'قافلة لطب الأسنان', labelEn: 'dental caravans', order: 1 },
    { key: 'school_days', value: 8, labelFr: 'journées de prévention en écoles', labelAr: 'يوماً توعوياً في المدارس', labelEn: 'school prevention days', order: 2 },
    { key: 'dentures', value: 32, labelFr: 'résidents appareillés', labelAr: 'نزيلاً استفادوا من أطقم أسنان', labelEn: 'residents given dentures', order: 3 },
    { key: 'partners', value: partnerCount, labelFr: 'partenaires', labelAr: 'شريكاً', labelEn: 'partners', order: 4 },
  ]
  for (const s of stats) {
    await prisma.impactStat.upsert({ where: { key: s.key }, create: s, update: s })
  }

  // Admin account (email from .env, never hard-coded)
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase()
  if (adminEmail) {
    await prisma.user.upsert({
      where: { email: adminEmail },
      create: { email: adminEmail, name: 'Oussama', role: 'admin' },
      update: { role: 'admin', isActive: true },
    })
  } else {
    console.warn('SEED_ADMIN_EMAIL not set: no admin user created')
  }

  const counts = {
    programmes: await prisma.programme.count(),
    partners: await prisma.partner.count(),
    actions: await prisma.action.count(),
    actionPartners: await prisma.actionPartner.count(),
    events: await prisma.event.count(),
    campaigns: await prisma.campaign.count(),
    sponsorTiers: await prisma.sponsorTier.count(),
    teamMembers: await prisma.teamMember.count(),
    impactStats: await prisma.impactStat.count(),
    admins: await prisma.user.count({ where: { role: 'admin' } }),
  }
  console.table(counts)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
