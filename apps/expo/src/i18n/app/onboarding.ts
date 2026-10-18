/** Onboarding, sign-in, and update prompts. */
import type { Catalog } from "./types";

export const onboardingStrings = {
  "onboarding.welcomeHeadline": {
    en: "Tomorrow’s brief.",
    es: "El resumen de mañana.",
    zh: "明天的简报。",
  },
  "onboarding.welcomeDek": {
    en: "What the government did. In English.",
    es: "Lo que hizo el gobierno, en palabras claras.",
    zh: "政府做了什么，用大白话讲清楚。",
  },

  "onboarding.watchHeadline": {
    en: "Who do you watch?",
    es: "¿A quién sigues?",
    zh: "你关注谁？",
  },
  "onboarding.watchDek": {
    en: "The buildings that write the law.",
    es: "Los edificios donde se escriben las leyes.",
    zh: "制定法律的机构。",
  },
  "onboarding.watch.congress": { en: "Congress", es: "Congreso", zh: "国会" },
  "onboarding.watch.executive": {
    en: "White House",
    es: "Casa Blanca",
    zh: "白宫",
  },
  "onboarding.watch.courts": { en: "Courts", es: "Tribunales", zh: "法院" },
  "onboarding.watchNone": {
    en: "Mark who writes it.",
    es: "Marca quién las escribe.",
    zh: "选出制定法律的机构。",
  },
  "onboarding.watchList": { en: "{list}.", es: "{list}.", zh: "{list}。" },

  "onboarding.followHeadline": {
    en: "Follow three.",
    es: "Sigue tres.",
    zh: "关注三项。",
  },
  "onboarding.followEnough": {
    en: "That’s enough to watch. You can always change this later in settings.",
    es: "Con eso basta. Puedes cambiarlo cuando quieras en Ajustes.",
    zh: "这样就够了。你随时可以在设置中更改。",
  },
  "onboarding.followMark": {
    en: "Mark {count}. You can always change this later in settings.",
    es: "Marca {count}. Puedes cambiarlo cuando quieras en Ajustes.",
    zh: "请选择 {count} 项。你随时可以在设置中更改。",
  },
  "onboarding.sector.defense": { en: "Defense", es: "Defensa", zh: "国防" },
  "onboarding.sector.technology": {
    en: "Technology",
    es: "Tecnología",
    zh: "科技",
  },
  "onboarding.sector.fiscal": { en: "Economy", es: "Economía", zh: "经济" },
  "onboarding.sector.energy": { en: "Energy", es: "Energía", zh: "能源" },
  "onboarding.sector.healthcare": { en: "Health", es: "Salud", zh: "医疗健康" },
  "onboarding.sector.infrastructure": {
    en: "Infrastructure",
    es: "Infraestructura",
    zh: "基础设施",
  },
  "onboarding.vector.congress": { en: "Congress", es: "Congreso", zh: "国会" },
  "onboarding.vector.state": {
    en: "State legislature",
    es: "Legislatura estatal",
    zh: "州议会",
  },
  "onboarding.vector.executive": {
    en: "Executive orders",
    es: "Órdenes ejecutivas",
    zh: "行政令",
  },
  "onboarding.vector.courts": {
    en: "Federal courts",
    es: "Tribunales federales",
    zh: "联邦法院",
  },

  "onboarding.arriveHeadline": {
    en: "When it lands.",
    es: "Cuándo llega.",
    zh: "何时送达。",
  },
  "onboarding.arriveDek": {
    en: "Pick how the brief finds you. Quietly.",
    es: "Elige cómo te llega el resumen. Sin ruido.",
    zh: "选择简报送达你的方式，不打扰。",
  },
  "onboarding.arriveHere": { en: "here", es: "aquí", zh: "这里" },
  "onboarding.arriveGhostTitle": {
    en: "Your brief lands here.",
    es: "Tu resumen llega aquí.",
    zh: "你的简报会出现在这里。",
  },
  "onboarding.arriveGhostBody": {
    en: "Tap a cadence below.",
    es: "Elige una frecuencia abajo.",
    zh: "请在下方选择频率。",
  },
  "onboarding.arriveNow": { en: "now", es: "ahora", zh: "现在" },
  "onboarding.arriveSavedTitle": {
    en: "A bill you saved moved.",
    es: "Un proyecto de ley que guardaste avanzó.",
    zh: "你保存的一项法案有了进展。",
  },
  "onboarding.arriveSavedBody": {
    en: "See what changed.",
    es: "Mira qué cambió.",
    zh: "查看变化。",
  },
  "onboarding.arrivePlaceTitle": {
    en: "Something changed in {place}.",
    es: "Algo cambió en {place}.",
    zh: "{place}有了新变化。",
  },
  "onboarding.arrivePlaceBody": {
    en: "Here’s what it means.",
    es: "Esto es lo que significa.",
    zh: "看看这意味着什么。",
  },
  "onboarding.arriveEveningTitle": {
    en: "While you were away",
    es: "Mientras no estabas",
    zh: "你不在的时候",
  },
  "onboarding.arriveEveningBody": {
    en: { one: "{count} thing changed.", other: "{count} things changed." },
    es: { one: "Cambió {count} cosa.", other: "Cambiaron {count} cosas." },
    zh: "有 {count} 项变化。",
  },
  "onboarding.instantTitle": {
    en: "When it moves",
    es: "Cuando haya movimiento",
    zh: "有进展时",
  },
  "onboarding.instantHint": {
    en: "Saved bills & new executive orders you follow",
    es: "Proyectos de ley guardados y nuevas órdenes ejecutivas que sigues",
    zh: "你保存的法案和关注的新行政令",
  },
  "onboarding.eveningTitle": {
    en: "Once, at {time}",
    es: "Una vez, a las {time}",
    zh: "每天一次，{time}",
  },
  "onboarding.eveningHint": {
    en: "One brief. That’s it.",
    es: "Un resumen. Nada más.",
    zh: "一份简报，仅此而已。",
  },

  "onboarding.soonKicker": {
    en: "Accounts are coming soon",
    es: "Las cuentas llegarán pronto",
    zh: "账户功能即将推出",
  },
  "onboarding.mailingList": {
    en: "Join our mailing list for feature releases and civic updates.",
    es: "Únete a nuestra lista de correo para recibir novedades de la app y actualizaciones cívicas.",
    zh: "加入我们的邮件列表，获取新功能发布和公民资讯。",
  },
  "onboarding.alreadyOnList": {
    en: "You're already on the list — you're all set.",
    es: "Ya estás en la lista. Todo listo.",
    zh: "你已在列表中，一切就绪。",
  },
  "onboarding.onList": {
    en: "You're on the list — we'll be in touch!",
    es: "Ya estás en la lista. ¡Te escribiremos pronto!",
    zh: "你已加入列表，我们会与你联系！",
  },
  "onboarding.emailPlaceholder": {
    en: "Enter your email",
    es: "Escribe tu correo electrónico",
    zh: "输入你的电子邮箱",
  },
  "onboarding.emailA11y": {
    en: "Email address",
    es: "Correo electrónico",
    zh: "电子邮箱地址",
  },
  "onboarding.submitting": {
    en: "Submitting…",
    es: "Enviando…",
    zh: "正在提交…",
  },
  "onboarding.subscribe": { en: "Subscribe", es: "Suscribirme", zh: "订阅" },
  "onboarding.invalidEmail": {
    en: "Enter a valid email address.",
    es: "Escribe un correo electrónico válido.",
    zh: "请输入有效的电子邮箱地址。",
  },
  "onboarding.genericError": {
    en: "Something went wrong. Please try again.",
    es: "Algo salió mal. Inténtalo de nuevo.",
    zh: "出了点问题，请重试。",
  },
  "onboarding.startExploring": {
    en: "Start exploring for now",
    es: "Empezar a explorar por ahora",
    zh: "先开始浏览",
  },

  "claim.soonBody": {
    en: "Sign-in isn’t built yet. Your workspace is already saved on this device — nothing is lost while you explore.",
    es: "El inicio de sesión aún no está disponible. Tu espacio ya está guardado en este dispositivo: no perderás nada mientras exploras.",
    zh: "登录功能尚未上线。你的工作区已保存在此设备上，浏览期间不会丢失任何内容。",
  },
  "claim.gotIt": { en: "Got it", es: "Entendido", zh: "知道了" },
  "claim.ready": {
    en: "Your Billion is ready.",
    es: "Tu Billion está listo.",
    zh: "你的 Billion 已准备就绪。",
  },
  "claim.signals": {
    en: {
      one: "{count} signal selected for your briefing.",
      other: "{count} signals selected for your briefing.",
    },
    es: {
      one: "{count} señal seleccionada para tu resumen.",
      other: "{count} señales seleccionadas para tu resumen.",
    },
    zh: "已为你的简报选择 {count} 个信号。",
  },
  "claim.save": {
    en: "Save your workspace",
    es: "Guarda tu espacio",
    zh: "保存你的工作区",
  },
  "claim.apple": {
    en: "Continue with Apple",
    es: "Continuar con Apple",
    zh: "通过 Apple 继续",
  },
  "claim.google": {
    en: "Continue with Google",
    es: "Continuar con Google",
    zh: "通过 Google 继续",
  },
  "claim.email": {
    en: "Continue with Email",
    es: "Continuar con correo electrónico",
    zh: "通过电子邮箱继续",
  },
  "claim.exploreA11y": {
    en: "Explore first without an account",
    es: "Explorar primero sin una cuenta",
    zh: "先不注册账户，直接浏览",
  },
  "claim.explore": {
    en: "Explore first",
    es: "Explorar primero",
    zh: "先浏览",
  },

  "update.kicker": { en: "UPDATE", es: "ACTUALIZACIÓN", zh: "更新" },
  "update.getting": {
    en: "Getting the latest update…",
    es: "Obteniendo la última actualización…",
    zh: "正在获取最新更新…",
  },
  "update.askTitle": {
    en: "Ready to install?",
    es: "¿Listo para instalar?",
    zh: "现在安装吗？",
  },
  "update.restartingBody": {
    en: "Billion will restart when the latest update is ready.",
    es: "Billion se reiniciará cuando la última actualización esté lista.",
    zh: "最新更新就绪后，Billion 将重新启动。",
  },
  "update.askBody": {
    en: "Restart now to load the update, or keep browsing and it will apply next launch.",
    es: "Reinicia ahora para cargar la actualización, o sigue navegando y se aplicará la próxima vez que abras la app.",
    zh: "立即重启以加载更新，或继续浏览，更新将在下次启动时生效。",
  },
  "update.restartA11y": {
    en: "Restart now to install update",
    es: "Reiniciar ahora para instalar la actualización",
    zh: "立即重启以安装更新",
  },
  "update.updating": {
    en: "Updating…",
    es: "Actualizando…",
    zh: "正在更新…",
  },
  "update.restartNow": {
    en: "Restart now",
    es: "Reiniciar ahora",
    zh: "立即重启",
  },
  "update.dismissA11y": {
    en: "Dismiss update notice",
    es: "Cerrar el aviso de actualización",
    zh: "关闭更新通知",
  },
  "update.notNow": { en: "Not now", es: "Ahora no", zh: "以后再说" },
  "update.ready": {
    en: "An update is ready",
    es: "Hay una actualización lista",
    zh: "有可用更新",
  },
  "update.restartingWhenReady": {
    en: "Restarting when ready",
    es: "Se reiniciará cuando esté lista",
    zh: "就绪后将重启",
  },
  "update.restartToInstall": {
    en: "Restart to install it",
    es: "Reinicia para instalarla",
    zh: "重启即可安装",
  },
  "update.restart": { en: "Restart", es: "Reiniciar", zh: "重启" },
  "update.later": { en: "Later", es: "Más tarde", zh: "稍后" },
  "update.failedTitle": {
    en: "Unable to update",
    es: "No se pudo actualizar",
    zh: "无法更新",
  },
  "update.failedBody": {
    en: "The latest update could not be installed. Please try again in a moment.",
    es: "No se pudo instalar la última actualización. Inténtalo de nuevo en un momento.",
    zh: "无法安装最新更新，请稍后重试。",
  },
} satisfies Catalog;
