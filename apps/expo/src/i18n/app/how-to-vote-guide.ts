/** Plain-language California voting guide and its entry point. */
import type { Catalog } from "./types";

export const voteGuideStrings = {
  "voteGuide.title": {
    en: "How to vote",
    es: "Cómo votar",
    zh: "如何投票",
  },
  "voteGuide.mail.title": {
    en: "Vote by mail",
    es: "Vota por correo",
    zh: "邮寄投票",
  },
  "voteGuide.mail.p1": {
    en: "Active registered voters are mailed a ballot.",
    es: "Las personas con inscripción electoral activa reciben una boleta por correo.",
    zh: "登记状态有效的选民会收到邮寄选票。",
  },
  "voteGuide.mail.p2": {
    en: "Mark it, then sign the envelope.",
    es: "Marca la boleta y firma el sobre.",
    zh: "填写选票，然后在信封上签名。",
  },
  "voteGuide.mail.p3": {
    en: "Mail it back or drop it off.",
    es: "Devuélvela por correo o entrégala.",
    zh: "通过邮寄或投递交回。",
  },
  "voteGuide.mail.note": {
    en: "Good if you like voting from home.",
    es: "Una opción si prefieres votar desde casa.",
    zh: "适合想在家投票的人。",
  },
  "voteGuide.dropBox.title": {
    en: "Drop box",
    es: "Buzón de boletas",
    zh: "选票投递箱",
  },
  "voteGuide.dropBox.p1": {
    en: "Return your mail ballot at an official drop box.",
    es: "Devuelve tu boleta por correo en un buzón oficial.",
    zh: "将邮寄选票交回官方投递箱。",
  },
  "voteGuide.dropBox.p2": {
    en: "Use the county's official boxes.",
    es: "Usa los buzones oficiales del condado.",
    zh: "请使用所在县的官方投递箱。",
  },
  "voteGuide.dropBox.p3": {
    en: "Bring your sealed and signed ballot.",
    es: "Lleva tu boleta en el sobre sellado y firmado.",
    zh: "带上装入已封口并签名信封的选票。",
  },
  "voteGuide.dropBox.note": {
    en: "Good for a quick stop on the way.",
    es: "Una opción para una parada rápida en el camino.",
    zh: "适合顺路快速投递。",
  },
  "voteGuide.early.title": {
    en: "Vote early",
    es: "Vota anticipadamente",
    zh: "提前投票",
  },
  "voteGuide.early.p1": {
    en: "Go before Election Day.",
    es: "Acude antes del Día de la Elección.",
    zh: "在选举日之前前往。",
  },
  "voteGuide.early.p2": {
    en: "Check the site’s opening hours before going.",
    es: "Consulta el horario del lugar antes de ir.",
    zh: "出发前查看投票点的开放时间。",
  },
  "voteGuide.early.p3": {
    en: "Sites and days vary by county.",
    es: "Los lugares y días varían según el condado.",
    zh: "各县的地点和日期有所不同。",
  },
  "voteGuide.early.note": {
    en: "Good if Election Day is busy for you.",
    es: "Una opción si estarás ocupado el Día de la Elección.",
    zh: "适合选举日当天忙碌的人。",
  },
  "voteGuide.electionDay.title": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },
  "voteGuide.electionDay.p1": {
    en: "Find your assigned polling place or a county vote center.",
    es: "Busca tu lugar de votación asignado o un centro de votación del condado.",
    zh: "查找分配给你的投票站或县投票中心。",
  },
  "voteGuide.electionDay.p2": {
    en: "Bring your mailed ballot if you have one.",
    es: "Lleva tu boleta recibida por correo, si la tienes.",
    zh: "如有邮寄选票，请带上。",
  },
  "voteGuide.electionDay.p3": {
    en: "In line at closing? Stay in line.",
    es: "¿Estás en la fila al cierre? Quédate en la fila.",
    zh: "关闭时已经在排队？请继续排队。",
  },
  "voteGuide.electionDay.note": {
    en: "Good if you want to vote in person.",
    es: "Una opción si quieres votar en persona.",
    zh: "适合想现场投票的人。",
  },
  "voteGuide.step1.title": {
    en: "Check you're registered",
    es: "Verifica tu inscripción",
    zh: "确认你已登记",
  },
  "voteGuide.step1.detail": {
    en: "Check your status with California’s election office.",
    es: "Consulta tu estado con la oficina electoral de California.",
    zh: "向加州选举办公室查询你的登记状态。",
  },
  "voteGuide.step2.title": {
    en: "Pick a way to vote",
    es: "Elige cómo votar",
    zh: "选择投票方式",
  },
  "voteGuide.step2.detail": {
    en: "Mail, drop box, early, or in person.",
    es: "Por correo, en buzón, anticipadamente o en persona.",
    zh: "邮寄、投递箱、提前或现场投票。",
  },
  "voteGuide.step3.title": {
    en: "Return it before the deadline",
    es: "Devuélvela antes de la fecha límite",
    zh: "在截止时间前交回",
  },
  "voteGuide.step3.detail": {
    en: "Mailing and in-person return rules differ.",
    es: "Las reglas para devolverla por correo y en persona son distintas.",
    zh: "邮寄和现场交回的规则不同。",
  },
  "voteGuide.bring.address": {
    en: "Your polling place address or a mail ballot.",
    es: "La dirección de tu lugar de votación o una boleta por correo.",
    zh: "投票站地址或邮寄选票。",
  },
  "voteGuide.bring.ballot": {
    en: "Your mailed ballot, if you got one.",
    es: "Tu boleta recibida por correo, si recibiste una.",
    zh: "如收到邮寄选票，请带上。",
  },
  "voteGuide.bring.id": {
    en: "Check official ID rules, especially if voting for the first time.",
    es: "Consulta las reglas oficiales de identificación, especialmente si votas por primera vez.",
    zh: "查看官方身份证明要求，尤其是首次投票者。",
  },
  "voteGuide.bring.helper": {
    en: "A helper, if you want one.",
    es: "Una persona que te ayude, si lo deseas.",
    zh: "如有需要，可带一位协助者。",
  },
  "voteGuide.dates.registration": {
    en: "Registration deadline",
    es: "Fecha límite de inscripción",
    zh: "登记截止日期",
  },
  "voteGuide.dates.registrationDetail": {
    en: "Missed regular registration? Same-day registration may still be available.",
    es: "¿Se te pasó la inscripción regular? Aún podría estar disponible la inscripción el mismo día.",
    zh: "错过常规登记？可能仍可办理当日登记。",
  },
  "voteGuide.dates.missing": {
    en: "Replacement ballot deadline",
    es: "Fecha límite para una boleta de reemplazo",
    zh: "补发选票截止日期",
  },
  "voteGuide.dates.missingDetail": {
    en: "Ask your county about a replacement ballot and its deadlines.",
    es: "Consulta con tu condado sobre una boleta de reemplazo y sus fechas límite.",
    zh: "向所在县咨询补发选票及其截止日期。",
  },
  "voteGuide.dates.return": {
    en: "Ballot return deadlines",
    es: "Fechas límite para devolver la boleta",
    zh: "交回选票截止日期",
  },
  "voteGuide.dates.returnDetail": {
    en: "Check postmark, receipt, and in-person return deadlines.",
    es: "Consulta las fechas límite de matasellos, recepción y entrega en persona.",
    zh: "查看邮戳、接收和现场交回的截止日期。",
  },
  "voteGuide.faq.mail": {
    en: "Got a ballot in the mail?",
    es: "¿Recibiste una boleta por correo?",
    zh: "收到邮寄选票了？",
  },
  "voteGuide.faq.mailAnswer": {
    en: "You can mail it, drop it off, or vote in person.",
    es: "Puedes enviarla por correo, entregarla o votar en persona.",
    zh: "你可以邮寄、投递选票，或现场投票。",
  },
  "voteGuide.faq.registration": {
    en: "Not sure you're registered?",
    es: "¿No sabes si estás inscrito?",
    zh: "不确定自己是否已登记？",
  },
  "voteGuide.faq.registrationAnswer": {
    en: "Use California’s official voter status tool below.",
    es: "Usa la herramienta oficial de California para consultar tu estado electoral que aparece abajo.",
    zh: "使用下方加州官方选民状态查询工具。",
  },
  "voteGuide.faq.help": {
    en: "Need help at a polling place?",
    es: "¿Necesitas ayuda en un lugar de votación?",
    zh: "在投票站需要帮助？",
  },
  "voteGuide.faq.helpAnswer": {
    en: "Accessibility tools and language help are available.",
    es: "Hay herramientas de accesibilidad y ayuda con el idioma.",
    zh: "提供无障碍工具和语言协助。",
  },
  "voteGuide.tip.hours": {
    en: "Polls have their own hours.",
    es: "Cada lugar de votación tiene su propio horario.",
    zh: "各投票点有各自的开放时间。",
  },
  "voteGuide.tip.mistake": {
    en: "A mistake doesn't spoil your vote — ask for another ballot.",
    es: "Un error no arruina tu voto: pide otra boleta.",
    zh: "填错了也不必放弃投票——请申请另一张选票。",
  },
  "voteGuide.tip.language": {
    en: "Language help is available at many sites.",
    es: "Muchos lugares ofrecen ayuda con el idioma.",
    zh: "许多投票点提供语言协助。",
  },
  "voteGuide.reading.access": {
    en: "Accessibility & language help",
    es: "Accesibilidad y ayuda con el idioma",
    zh: "无障碍与语言协助",
  },
  "voteGuide.reading.accessDetail": {
    en: "Tools for reading and casting your ballot.",
    es: "Herramientas para leer y emitir tu boleta.",
    zh: "帮助阅读和投出选票的工具。",
  },
  "voteGuide.reading.process": {
    en: "How elections work",
    es: "Cómo funcionan las elecciones",
    zh: "选举如何运作",
  },
  "voteGuide.reading.processDetail": {
    en: "Primaries, nominations, and your vote.",
    es: "Primarias, nominaciones y tu voto.",
    zh: "初选、提名与你的选票。",
  },
  "voteGuide.reading.notes": {
    en: "Your saved voting notes",
    es: "Tus notas de votación guardadas",
    zh: "已保存的投票笔记",
  },
  "voteGuide.reading.notesDetail": {
    en: "Private notes on this device.",
    es: "Notas privadas en este dispositivo.",
    zh: "此设备上的私人笔记。",
  },
  "voteGuide.intro": {
    en: "Voting in California: compare mail, drop boxes, early voting, and Election Day. Check your county’s locations and rules before you go.",
    es: "Votar en California: compara el voto por correo, los buzones, la votación anticipada y el Día de la Elección. Consulta los lugares y las reglas de tu condado antes de ir.",
    zh: "加州投票：比较邮寄、投递箱、提前投票和选举日投票。出发前请查看所在县的地点和规则。",
  },
  "voteGuide.resources": {
    en: "CALIFORNIA OFFICIAL RESOURCES",
    es: "RECURSOS OFICIALES DE CALIFORNIA",
    zh: "加州官方资源",
  },
  "voteGuide.link.registration": {
    en: "Check my registration",
    es: "Verificar mi inscripción",
    zh: "查询我的登记状态",
  },
  "voteGuide.link.locations": {
    en: "Find voting locations and hours",
    es: "Buscar lugares y horarios de votación",
    zh: "查找投票地点和时间",
  },
  "voteGuide.link.rules": {
    en: "Voting instructions and ID rules",
    es: "Instrucciones para votar y reglas de identificación",
    zh: "投票说明与身份证明要求",
  },
  "voteGuide.link.sameDay": {
    en: "Same-day registration",
    es: "Inscripción el mismo día",
    zh: "当日登记",
  },
  "voteGuide.link.outside": {
    en: "Voting outside California? Start at Vote.gov",
    es: "¿Votas fuera de California? Empieza en Vote.gov",
    zh: "在加州以外投票？从 Vote.gov 开始",
  },
  "voteGuide.pick": {
    en: "PICK A WAY",
    es: "ELIGE CÓMO VOTAR",
    zh: "选择投票方式",
  },
  "voteGuide.methodHint": {
    en: "Opens the details for this way to vote",
    es: "Abre los detalles de esta forma de votar",
    zh: "打开此投票方式的详情",
  },
  "voteGuide.bring": {
    en: "WHAT TO BRING",
    es: "QUÉ LLEVAR",
    zh: "携带物品",
  },
  "voteGuide.dates": {
    en: "DEADLINES TO CHECK",
    es: "FECHAS LÍMITE QUE DEBES CONSULTAR",
    zh: "需要确认的截止日期",
  },
  "voteGuide.datesNote": {
    en: "Deadlines change with each election. Tap one to check it with the official source.",
    es: "Las fechas límite cambian en cada elección. Toca una para consultarla en la fuente oficial.",
    zh: "每次选举的截止日期都不同。点按一项，向官方来源确认。",
  },
  "voteGuide.published": {
    en: "Check published voting details",
    es: "Consultar los detalles de votación publicados",
    zh: "查看已公布的投票详情",
  },
  "voteGuide.questions": {
    en: "COMMON QUESTIONS",
    es: "PREGUNTAS FRECUENTES",
    zh: "常见问题",
  },
  "voteGuide.tips": {
    en: "GOOD TO KNOW",
    es: "INFORMACIÓN ÚTIL",
    zh: "实用信息",
  },
  "voteGuide.reading": {
    en: "KEEP READING",
    es: "SIGUE LEYENDO",
    zh: "继续阅读",
  },
  "voteGuide.cta.title": {
    en: "See your own options",
    es: "Consulta tus opciones",
    zh: "查看你的投票方式",
  },
  "voteGuide.cta.body": {
    en: "Look up published details when available. The official links above work even when Billion’s lookup is unavailable.",
    es: "Consulta los detalles publicados cuando estén disponibles. Los enlaces oficiales de arriba funcionan incluso cuando la consulta de Billion no está disponible.",
    zh: "查询可用的已公布详情。即使 Billion 查询服务不可用，上方的官方链接仍可使用。",
  },
  "voteGuide.cta.button": {
    en: "Look up my voting options",
    es: "Consultar mis opciones para votar",
    zh: "查询我的投票方式",
  },
  "voteGuide.cta.location": {
    en: "Change my saved address",
    es: "Cambiar mi dirección guardada",
    zh: "更改我保存的地址",
  },

  "voteGuide.entry.address": {
    en: "Add your address to see your options",
    es: "Agrega tu dirección para ver tus opciones",
    zh: "添加地址以查看你的投票方式",
  },
  "voteGuide.entry.ended": {
    en: "See results and what comes next",
    es: "Consulta los resultados y lo que sigue",
    zh: "查看结果和后续事项",
  },
  "voteGuide.entry.contacts": {
    en: "Deadlines and official election contacts",
    es: "Fechas límite y contactos electorales oficiales",
    zh: "截止日期与官方选举联系方式",
  },
  "voteGuide.entry.today": {
    en: "Polling places, hours, and directions",
    es: "Lugares de votación, horarios y cómo llegar",
    zh: "投票地点、时间和路线",
  },
  "voteGuide.entry.ways": {
    en: "Ways to vote and where to go",
    es: "Cómo votar y adónde ir",
    zh: "投票方式和地点",
  },
  "voteGuide.entry.summary": {
    en: "Four ways to vote in California, step by step.",
    es: "Cuatro formas de votar en California, paso a paso.",
    zh: "逐步了解加州的四种投票方式。",
  },
  "voteGuide.entry.a11y": {
    en: "How to vote in California. Mail, drop box, early voting, or Election Day.",
    es: "Cómo votar en California. Por correo, en buzón, anticipadamente o el Día de la Elección.",
    zh: "如何在加州投票。邮寄、投递箱、提前投票或选举日投票。",
  },
  "voteGuide.entry.hint": {
    en: "Opens a short guide to voting in California",
    es: "Abre una breve guía para votar en California",
    zh: "打开加州投票简明指南",
  },
  "voteGuide.chip.mail": {
    en: "Mail",
    es: "Correo",
    zh: "邮寄",
  },
  "voteGuide.chip.dropBox": {
    en: "Drop box",
    es: "Buzón",
    zh: "投递箱",
  },
  "voteGuide.chip.early": {
    en: "Early",
    es: "Anticipado",
    zh: "提前",
  },
  "voteGuide.chip.electionDay": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },
} satisfies Catalog;
