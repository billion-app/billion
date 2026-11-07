/** Plain-language California voting guide. */
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
  "voteGuide.dropBox.title": {
    en: "Drop box",
    es: "Buzón de boletas",
    zh: "选票投递箱",
  },
  "voteGuide.dropBox.p3": {
    en: "Bring your sealed and signed ballot.",
    es: "Lleva tu boleta en el sobre sellado y firmado.",
    zh: "带上装入已封口并签名信封的选票。",
  },
  "voteGuide.early.title": {
    en: "Vote early",
    es: "Vota anticipadamente",
    zh: "提前投票",
  },
  "voteGuide.early.p3": {
    en: "Sites and days vary by county.",
    es: "Los lugares y días varían según el condado.",
    zh: "各县的地点和日期有所不同。",
  },
  "voteGuide.electionDay.title": {
    en: "Election Day",
    es: "Día de la Elección",
    zh: "选举日",
  },
  "voteGuide.electionDay.p3": {
    en: "In line at closing? Stay in line.",
    es: "¿Estás en la fila al cierre? Quédate en la fila.",
    zh: "关闭时已经在排队？请继续排队。",
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
  "voteGuide.intro": {
    en: "Four ways to vote in California, and what to check before you go.",
    es: "Cuatro formas de votar en California y qué revisar antes de ir.",
    zh: "加州的四种投票方式，以及出发前需要确认的事项。",
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
  "voteGuide.link.outside": {
    en: "Voting outside California? Start at Vote.gov",
    es: "¿Votas fuera de California? Empieza en Vote.gov",
    zh: "在加州以外投票？从 Vote.gov 开始",
  },
  "voteGuide.ways": {
    en: "Ways to vote",
    es: "Formas de votar",
    zh: "投票方式",
  },
  "voteGuide.dates": {
    en: "Deadlines to check",
    es: "Fechas límite que debes consultar",
    zh: "需要确认的截止日期",
  },
  "voteGuide.beforeYouGo": {
    en: "Before you go",
    es: "Antes de ir",
    zh: "出发之前",
  },
  "voteGuide.help": {
    en: "Help and resources",
    es: "Ayuda y recursos",
    zh: "帮助与资源",
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
} satisfies Catalog;
