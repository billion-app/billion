/** Voting logistics, polling places, and the voting plan. */
import type { Catalog } from "./types";

export const votingStrings = {
  // Official guidance item titles and location groups
  "voting.guidance.mailing_starts": {
    en: "Mailing begins by",
    es: "El envío comienza a más tardar el",
    zh: "开始寄送选票",
  },
  "voting.guidance.early_voting": {
    en: "Early voting",
    es: "Votación anticipada",
    zh: "提前投票",
  },
  "voting.guidance.drop_off": {
    en: "Ballot drop-off",
    es: "Entrega de boletas",
    zh: "选票投递",
  },
  "voting.guidance.registration": {
    en: "Registration",
    es: "Inscripción",
    zh: "选民登记",
  },
  "voting.guidance.conditional_registration": {
    en: "Conditional registration",
    es: "Inscripción condicional",
    zh: "有条件登记",
  },
  "voting.guidance.election_day": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },
  "voting.guidance.mail_return": {
    en: "Mail ballot receipt deadline",
    es: "Fecha límite de recepción de la boleta por correo",
    zh: "邮寄选票接收截止",
  },
  "voting.missing.election_day": {
    en: "Election Day",
    es: "el Día de la Elección",
    zh: "选举日",
  },
  "voting.missing.early_voting": {
    en: "early voting",
    es: "la votación anticipada",
    zh: "提前投票",
  },
  "voting.missing.drop_off": {
    en: "ballot drop-off",
    es: "la entrega de boletas",
    zh: "选票投递",
  },

  // Location descriptions and source attribution
  "voting.locationFallback": {
    en: "Voting location",
    es: "Lugar de votación",
    zh: "投票地点",
  },
  "voting.addressMissing": {
    en: "Address not supplied.",
    es: "No se proporcionó la dirección.",
    zh: "未提供地址。",
  },
  "voting.unnamedSource": {
    en: "Unnamed source",
    es: "Fuente sin nombre",
    zh: "未命名来源",
  },
  "voting.sourceOfficial": {
    en: "{name} (official)",
    es: "{name} (oficial)",
    zh: "{name}（官方）",
  },
  "voting.sourceUnconfirmed": {
    en: "{name} (official status not confirmed)",
    es: "{name} (carácter oficial no confirmado)",
    zh: "{name}（官方身份未确认）",
  },

  // Information links supplied by election offices
  "voting.link.findLocations": {
    en: "Find voting locations",
    es: "Buscar lugares de votación",
    zh: "查找投票地点",
  },
  "voting.link.registration": {
    en: "Registration information",
    es: "Información de inscripción",
    zh: "登记信息",
  },
  "voting.link.absentee": {
    en: "Absentee and mail voting information",
    es: "Información sobre voto ausente y por correo",
    zh: "缺席投票和邮寄投票信息",
  },
  "voting.link.ballot": {
    en: "Ballot information",
    es: "Información de la boleta",
    zh: "选票信息",
  },
  "voting.link.election": {
    en: "Election information",
    es: "Información de la elección",
    zh: "选举信息",
  },
  "voting.link.rules": {
    en: "Voting rules",
    es: "Reglas de votación",
    zh: "投票规则",
  },
  "voting.link.website": {
    en: "Voting information website",
    es: "Sitio web de información electoral",
    zh: "投票信息网站",
  },
  "voting.via": {
    en: "Via {name}",
    es: "A través de {name}",
    zh: "来自 {name}",
  },
  "voting.information": {
    en: "Voting information",
    es: "Información electoral",
    zh: "投票信息",
  },
  "voting.linkFailed": {
    en: "Could not open the link. Tap to retry.",
    es: "No se pudo abrir el enlace. Toca para volver a intentarlo.",
    zh: "无法打开链接。轻点重试。",
  },

  // Polling places (Elections tab)
  "voting.locations": { en: "Locations", es: "Lugares", zh: "地点" },
  "voting.directions": { en: "Directions", es: "Cómo llegar", zh: "路线" },
  "voting.directionsTo": {
    en: "Directions to {place}",
    es: "Cómo llegar a {place}",
    zh: "前往 {place} 的路线",
  },
  "voting.showFewer": { en: "Show fewer", es: "Mostrar menos", zh: "收起" },
  "voting.showAll": {
    en: "Show all {count}",
    es: "Mostrar los {count}",
    zh: "显示全部 {count} 个",
  },
  "voting.mailOnlyNotice": {
    en: "Mail-ballot election — drop a box below or return by mail.",
    es: "Elección por correo: deposita tu boleta en un buzón de abajo o devuélvela por correo.",
    zh: "邮寄选票选举——可投入下方投递箱，或通过邮寄寄回。",
  },
  "voting.yourPollingPlace": {
    en: "Your polling place",
    es: "Tu lugar de votación",
    zh: "你的投票站",
  },
  "voting.earlyVoteSites": {
    en: "Early vote sites",
    es: "Sitios de votación anticipada",
    zh: "提前投票点",
  },
  "voting.dropBoxes": {
    en: "Ballot drop boxes",
    es: "Buzones para boletas",
    zh: "选票投递箱",
  },
  "voting.noLocations": {
    en: "No polling locations published for this address yet.",
    es: "Todavía no se han publicado lugares de votación para esta dirección.",
    zh: "此地址尚未公布投票地点。",
  },
  "voting.addAddress": {
    en: "Add an address to see your polling place.",
    es: "Agrega una dirección para ver tu lugar de votación.",
    zh: "添加地址即可查看你的投票站。",
  },

  // Voting logistics section
  "voting.addressLabel": { en: "ADDRESS", es: "DIRECCIÓN", zh: "地址" },
  "voting.hoursLabel": { en: "HOURS", es: "HORARIO", zh: "时间" },
  "voting.hoursMissing": {
    en: "Hours not supplied",
    es: "No se proporcionó el horario",
    zh: "未提供开放时间",
  },
  "voting.dateOn": {
    en: "Date: {date}",
    es: "Fecha: {date}",
    zh: "日期：{date}",
  },
  "voting.dateFrom": {
    en: "From {date}",
    es: "Desde el {date}",
    zh: "自 {date} 起",
  },
  "voting.dateThrough": {
    en: "Through {date}",
    es: "Hasta el {date}",
    zh: "至 {date}",
  },
  "voting.notesAndSources": {
    en: "Notes & sources",
    es: "Notas y fuentes",
    zh: "备注和来源",
  },
  "voting.services": {
    en: "Services: {services}",
    es: "Servicios: {services}",
    zh: "服务：{services}",
  },
  "voting.attributionMissing": {
    en: "Source attribution not supplied.",
    es: "No se proporcionó la atribución de la fuente.",
    zh: "未提供来源说明。",
  },
  "voting.locationCount": {
    en: { one: "{count} location", other: "{count} locations" },
    es: { one: "{count} lugar", other: "{count} lugares" },
    zh: "{count} 个地点",
  },
  "voting.caDates": {
    en: "California voting dates",
    es: "Fechas de votación de California",
    zh: "加州投票日期",
  },
  "voting.statewideGuidance": {
    en: "Statewide guidance · {source}",
    es: "Guía estatal · {source}",
    zh: "全州指南 · {source}",
  },
  "voting.officialWordingNote": {
    en: "Dates and instructions appear in the official English wording.",
    es: "Las fechas e instrucciones aparecen con la redacción oficial en inglés.",
    zh: "日期和说明保留官方英文原文。",
  },
  "voting.postmark": {
    en: "Postmark requirements apply",
    es: "Se aplican requisitos de matasellos",
    zh: "须符合邮戳要求",
  },
  "voting.postmarkHint": {
    en: "Postmark requirements apply. Open for official instructions.",
    es: "Se aplican requisitos de matasellos. Abre para ver las instrucciones oficiales.",
    zh: "须符合邮戳要求。展开查看官方说明。",
  },
  "voting.officialGuide": {
    en: "Read the official voting guide",
    es: "Leer la guía oficial de votación (en inglés)",
    zh: "阅读官方投票指南（英文）",
  },
  "voting.retrieved": {
    en: "Retrieved {date}",
    es: "Consultado el {date}",
    zh: "获取于 {date}",
  },
  "voting.locationsTitle": {
    en: "Voting locations",
    es: "Lugares de votación",
    zh: "投票地点",
  },
  "voting.locationsContext": {
    en: "voting locations",
    es: "lugares de votación",
    zh: "投票地点",
  },
  "voting.loadingA11y": {
    en: "Loading voting locations",
    es: "Cargando lugares de votación",
    zh: "正在加载投票地点",
  },
  "voting.idle": {
    en: "Choose an address and election to see voting locations.",
    es: "Elige una dirección y una elección para ver los lugares de votación.",
    zh: "选择地址和选举以查看投票地点。",
  },
  "voting.loading": {
    en: "Loading locations…",
    es: "Cargando lugares…",
    zh: "正在加载地点…",
  },
  "voting.error": {
    en: "Voting locations couldn’t be loaded.",
    es: "No se pudieron cargar los lugares de votación.",
    zh: "无法加载投票地点。",
  },
  "voting.includesVoteCenters": {
    en: "Includes published vote centers from {source}",
    es: "Incluye los centros de votación publicados por {source}",
    zh: "包含 {source} 公布的投票中心",
  },
  "voting.linksTitle": {
    en: "Voting information links",
    es: "Enlaces de información electoral",
    zh: "投票信息链接",
  },
  "voting.mailOnlyPrecinct": {
    en: "This lookup lists your precinct as mail-only. Confirm how to return your ballot with your election office.",
    es: "Esta consulta indica que tu distrito electoral vota solo por correo. Confirma con tu oficina electoral cómo devolver tu boleta.",
    zh: "此查询显示你的选区仅限邮寄投票。请向你的选举办公室确认如何寄回选票。",
  },
  "voting.allDetailsMissing": {
    en: "Location details aren’t available here.",
    es: "Los detalles de los lugares no están disponibles aquí.",
    zh: "此处没有地点详情。",
  },
  "voting.someDetailsMissing": {
    en: "Details for {items} aren’t available here.",
    es: "Los detalles de {items} no están disponibles aquí.",
    zh: "此处没有{items}的详情。",
  },
  "voting.aboutInfo": {
    en: "About this information",
    es: "Acerca de esta información",
    zh: "关于此信息",
  },
  "voting.aboutInfoBody": {
    en: "Missing details don’t establish whether a voting option is available. Check official registration information for deadlines and requirements. This lookup doesn’t confirm your registration or track your mail ballot.",
    es: "Que falten detalles no indica si una opción de votación está disponible. Consulta la información oficial de inscripción para conocer fechas límite y requisitos. Esta consulta no confirma tu inscripción ni rastrea tu boleta por correo.",
    zh: "缺少详情并不说明某种投票方式是否可用。请查看官方登记信息了解截止日期和要求。此查询不会确认你的登记状态，也不会追踪你的邮寄选票。",
  },

  // Voting plan
  "voting.plan.title": {
    en: "Make your voting plan",
    es: "Haz tu plan de votación",
    zh: "制定你的投票计划",
  },
  "voting.plan.hide": { en: "Hide plan", es: "Ocultar plan", zh: "收起计划" },
  "voting.plan.hideSteps": {
    en: "Hide voting steps",
    es: "Ocultar los pasos para votar",
    zh: "收起投票步骤",
  },
  "voting.plan.summary": {
    en: "Check registration. Choose how to vote.",
    es: "Verifica tu inscripción. Elige cómo votar.",
    zh: "确认登记状态，选择投票方式。",
  },
  "voting.plan.noElection": {
    en: "Election details aren’t available. You can still use these voting services.",
    es: "Los detalles de la elección no están disponibles. Aun así, puedes usar estos servicios de votación.",
    zh: "暂无选举详情。你仍可使用这些投票服务。",
  },
  "voting.plan.step1": {
    en: "1. Check registration",
    es: "1. Verifica tu inscripción",
    zh: "1. 确认登记状态",
  },
  "voting.plan.checkRegistration": {
    en: "Check registration",
    es: "Verificar inscripción",
    zh: "查询登记状态",
  },
  "voting.plan.opensRegistration": {
    en: "{name} · Opens registration service",
    es: "{name} · Abre el servicio de inscripción",
    zh: "{name} · 打开登记服务",
  },
  "voting.plan.findOffice": {
    en: "Find your election office",
    es: "Buscar tu oficina electoral",
    zh: "查找你的选举办公室",
  },
  "voting.plan.officeHelps": {
    en: "For registration and available voting methods",
    es: "Para la inscripción y las formas de votar disponibles",
    zh: "了解登记和可用的投票方式",
  },
  "voting.plan.needRegister": {
    en: "Need to register or update details?",
    es: "¿Necesitas inscribirte o actualizar tus datos?",
    zh: "需要登记或更新信息？",
  },
  "voting.plan.registrationApplication": {
    en: "Registration application & requirements",
    es: "Solicitud de inscripción y requisitos",
    zh: "登记申请和要求",
  },
  "voting.plan.caSos": {
    en: "California Secretary of State",
    es: "Secretaría de Estado de California",
    zh: "加州州务卿",
  },
  "voting.plan.caCountyOffices": {
    en: "California county elections offices",
    es: "Oficinas electorales de los condados de California",
    zh: "加州各县选举办公室",
  },
  "voting.plan.usaGovOffices": {
    en: "USA.gov · State election offices",
    es: "USA.gov · Oficinas electorales estatales",
    zh: "USA.gov · 各州选举办公室",
  },
  "voting.plan.step2": {
    en: "2. How would you like to vote?",
    es: "2. ¿Cómo te gustaría votar?",
    zh: "2. 你想如何投票？",
  },
  "voting.plan.method.undecided": {
    en: "Unsure",
    es: "No lo sé",
    zh: "还不确定",
  },
  "voting.plan.method.mail": {
    en: "By mail",
    es: "Por correo",
    zh: "邮寄投票",
  },
  "voting.plan.method.inPerson": {
    en: "In person",
    es: "En persona",
    zh: "现场投票",
  },
  "voting.plan.loadingChoice": {
    en: "Loading your choice…",
    es: "Cargando tu elección…",
    zh: "正在加载你的选择…",
  },
  "voting.plan.saveFailed": {
    en: "Couldn’t save. Your choice may be lost when you leave.",
    es: "No se pudo guardar. Es posible que pierdas tu elección al salir.",
    zh: "无法保存。离开后你的选择可能会丢失。",
  },
  "voting.plan.temporary": {
    en: "This choice is temporary while election details are unavailable.",
    es: "Esta elección es temporal mientras no haya detalles de la elección.",
    zh: "在选举详情不可用期间，此选择仅为临时。",
  },
  "voting.plan.saving": { en: "Saving…", es: "Guardando…", zh: "正在保存…" },
  "voting.plan.saved": {
    en: "Saved on this device",
    es: "Guardado en este dispositivo",
    zh: "已保存在此设备上",
  },
  "voting.plan.askMail": {
    en: "Ask the office above about ballot requests and returns.",
    es: "Consulta con la oficina de arriba sobre cómo solicitar y devolver la boleta.",
    zh: "向上方的办公室咨询申请和寄回选票的事宜。",
  },
  "voting.plan.askInPerson": {
    en: "Ask the office above about locations and hours.",
    es: "Consulta con la oficina de arriba sobre lugares y horarios.",
    zh: "向上方的办公室咨询投票地点和时间。",
  },
  "voting.plan.askUndecided": {
    en: "The office above can explain your voting options.",
    es: "La oficina de arriba puede explicarte tus opciones para votar.",
    zh: "上方的办公室可以为你说明投票方式。",
  },
  "voting.plan.findCountyOffice": {
    en: "Find my county election office",
    es: "Buscar la oficina electoral de mi condado",
    zh: "查找我所在县的选举办公室",
  },
  "voting.plan.visitOffice": {
    en: "Visit your election office",
    es: "Visitar tu oficina electoral",
    zh: "访问你的选举办公室网站",
  },
  "voting.plan.mailInstructions": {
    en: "See mail voting instructions",
    es: "Ver instrucciones para votar por correo",
    zh: "查看邮寄投票说明",
  },
  "voting.plan.compareWays": {
    en: "Compare ways to vote",
    es: "Comparar formas de votar",
    zh: "比较投票方式",
  },
  "voting.plan.contextMail": {
    en: "Confirm mail voting and return instructions",
    es: "Confirma las instrucciones para votar y devolver la boleta por correo",
    zh: "确认邮寄投票和寄回说明",
  },
  "voting.plan.contextInPerson": {
    en: "Ask about voting locations and hours",
    es: "Pregunta por los lugares y horarios de votación",
    zh: "咨询投票地点和时间",
  },
  "voting.plan.contextUndecided": {
    en: "Confirm available methods for your election",
    es: "Confirma las formas de votar disponibles para tu elección",
    zh: "确认你这次选举可用的投票方式",
  },
  "voting.plan.viewLogistics": {
    en: "View dates & locations",
    es: "Ver fechas y lugares",
    zh: "查看日期和地点",
  },
  "voting.plan.viewLogisticsA11y": {
    en: "View voting dates and locations",
    es: "Ver fechas y lugares de votación",
    zh: "查看投票日期和地点",
  },
  "voting.plan.mailDeadlines": {
    en: "Mail deadlines & tracking",
    es: "Fechas límite y seguimiento del voto por correo",
    zh: "邮寄截止日期和追踪",
  },
  "voting.plan.checkSeparately": {
    en: "Check these separately with your election office:",
    es: "Confirma esto por separado con tu oficina electoral:",
    zh: "请另行向你的选举办公室确认以下事项：",
  },
  "voting.plan.request": { en: "Request", es: "Solicitud", zh: "申请" },
  "voting.plan.requestBody": {
    en: "Check if you need to request a ballot, and by when.",
    es: "Verifica si necesitas solicitar una boleta y hasta cuándo.",
    zh: "确认你是否需要申请选票，以及申请截止时间。",
  },
  "voting.plan.postmark": { en: "Postmark", es: "Matasellos", zh: "邮戳" },
  "voting.plan.postmarkBody": {
    en: "When the postal service must mark your return envelope.",
    es: "Cuándo debe el servicio postal sellar tu sobre de devolución.",
    zh: "邮政部门须在何时为你的回寄信封盖上邮戳。",
  },
  "voting.plan.receipt": { en: "Receipt", es: "Recepción", zh: "接收" },
  "voting.plan.receiptBody": {
    en: "When the election office must receive your ballot.",
    es: "Cuándo debe la oficina electoral recibir tu boleta.",
    zh: "选举办公室须在何时收到你的选票。",
  },
  "voting.plan.trackBallot": {
    en: "Track my ballot",
    es: "Rastrear mi boleta",
    zh: "追踪我的选票",
  },
  "voting.plan.opensTracking": {
    en: "{name} · Opens its tracking service",
    es: "{name} · Abre su servicio de seguimiento",
    zh: "{name} · 打开其追踪服务",
  },
  "voting.plan.beforeYouGo": {
    en: "Before you go",
    es: "Antes de ir",
    zh: "出发之前",
  },
  "voting.plan.beforeYouGoBody": {
    en: "Confirm the location, early-voting dates or Election Day hours, and what to bring. Missing location details here don’t mean in-person voting is unavailable.",
    es: "Confirma el lugar, las fechas de votación anticipada o el horario del Día de la Elección, y qué debes llevar. Que falten detalles del lugar aquí no significa que no puedas votar en persona.",
    zh: "确认投票地点、提前投票日期或选举日开放时间，以及需要携带的物品。此处缺少地点详情并不代表无法现场投票。",
  },
  "voting.plan.requirements": {
    en: "Voting requirements",
    es: "Requisitos para votar",
    zh: "投票要求",
  },
  "voting.plan.moreHelp": {
    en: "More voting help & privacy",
    es: "Más ayuda para votar y privacidad",
    zh: "更多投票帮助和隐私说明",
  },
  "voting.plan.primaryQuestion": {
    en: "Voting in a primary?",
    es: "¿Votas en una primaria?",
    zh: "参加初选投票？",
  },
  "voting.plan.primaryBody": {
    en: "Check which contests you can vote in, whether party enrollment matters, and whether to request a different ballot. Confirm party enrollment and ballot request deadlines separately.",
    es: "Verifica en qué contiendas puedes votar, si tu afiliación partidista influye y si debes solicitar otra boleta. Confirma por separado las fechas límite de afiliación y de solicitud de boleta.",
    zh: "确认你可以参与哪些竞选、党派登记是否有影响，以及是否需要申请其他选票。请另行确认党派登记和选票申请的截止日期。",
  },
  "voting.plan.primaryRules": {
    en: "Check primary voting rules",
    es: "Consultar las reglas de votación en primarias",
    zh: "查看初选投票规则",
  },
  "voting.plan.officialTitle": {
    en: "Official confirmation",
    es: "Confirmación oficial",
    zh: "官方确认",
  },
  "voting.plan.officialBody": {
    en: "Billion doesn’t verify registration, eligibility or ballot status. Links open the authority’s service; return here to continue your ballot.",
    es: "Billion no verifica la inscripción, la elegibilidad ni el estado de la boleta. Los enlaces abren el servicio de la autoridad; vuelve aquí para continuar con tu boleta.",
    zh: "Billion 不核实登记、投票资格或选票状态。链接会打开主管机构的服务；返回此处即可继续查看你的选票。",
  },
  "voting.plan.deviceTitle": {
    en: "On this device",
    es: "En este dispositivo",
    zh: "在此设备上",
  },
  "voting.plan.deviceSaved": {
    en: "Only your method preference is saved, for this election.",
    es: "Solo se guarda tu forma de votar preferida, para esta elección.",
    zh: "只保存你在这次选举中偏好的投票方式。",
  },
  "voting.plan.deviceTemporary": {
    en: "Your temporary choice isn’t saved while election details are unavailable.",
    es: "Tu elección temporal no se guarda mientras no haya detalles de la elección.",
    zh: "在选举详情不可用期间，你的临时选择不会被保存。",
  },
  "voting.plan.deviceNothingElse": {
    en: "No address, party or registration status is stored in this plan.",
    es: "Este plan no guarda ninguna dirección, partido ni estado de inscripción.",
    zh: "此计划不存储任何地址、党派或登记状态。",
  },
  "voting.plan.datesTitle": {
    en: "Dates and locations",
    es: "Fechas y lugares",
    zh: "日期和地点",
  },
  "voting.plan.datesBody": {
    en: "Ask your election office about details missing here. A missing location listing doesn’t mean voting is unavailable.",
    es: "Consulta con tu oficina electoral los detalles que faltan aquí. Que no aparezca un lugar no significa que no puedas votar.",
    zh: "此处缺少的详情请向你的选举办公室咨询。没有列出地点并不代表无法投票。",
  },
} satisfies Catalog;
