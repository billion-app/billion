/** Settings subpages, feedback, notifications, and the legal documents. */
import type { Catalog } from "./types";

export const settingsStrings = {
  // About
  "about.title": { en: "About", es: "Acerca de", zh: "关于" },
  "about.licenses": {
    en: "Open-source licenses",
    es: "Licencias de código abierto",
    zh: "开源许可",
  },
  "about.privacy": { en: "Privacy", es: "Privacidad", zh: "隐私" },
  "about.terms": { en: "Terms", es: "Términos", zh: "条款" },
  "about.upToDate": { en: "Up to date", es: "Actualizada", zh: "已是最新版本" },
  "about.blurbLead": {
    en: "The public record, ",
    es: "El registro público, ",
    zh: "公共记录，",
  },
  "about.blurbEm": {
    en: "worth reading",
    es: "vale la pena leerlo",
    zh: "值得一读",
  },
  "about.blurbEnd": { en: ".", es: ".", zh: "。" },
  "about.version": {
    en: "Version {version}",
    es: "Versión {version}",
    zh: "版本 {version}",
  },
  "about.versionBuild": {
    en: "Version {version} (build {build})",
    es: "Versión {version} (compilación {build})",
    zh: "版本 {version}（构建 {build}）",
  },

  // Alert history
  "alerts.title": { en: "Your alerts", es: "Tus alertas", zh: "你的提醒" },
  "alerts.loading": {
    en: "Loading alerts…",
    es: "Cargando alertas…",
    zh: "正在加载提醒…",
  },
  "alerts.error": {
    en: "Could not load alerts.",
    es: "No se pudieron cargar las alertas.",
    zh: "无法加载提醒。",
  },
  "alerts.empty": {
    en: "Nothing yet.",
    es: "Aún no hay nada.",
    zh: "暂无内容。",
  },
  "alerts.emptySub": {
    en: "When something you follow moves, it lands here.",
    es: "Cuando algo que sigues avance, aparecerá aquí.",
    zh: "你关注的内容有进展时，会显示在这里。",
  },
  "alerts.todayUpper": { en: "TODAY", es: "HOY", zh: "今天" },
  "alerts.yesterdayUpper": { en: "YESTERDAY", es: "AYER", zh: "昨天" },
  "alerts.testTitle": {
    en: "A bill you follow advanced.",
    es: "Un proyecto de ley que sigues avanzó.",
    zh: "你关注的一项法案有了进展。",
  },
  "alerts.testBody": {
    en: "Open it for what changed.",
    es: "Ábrelo para ver qué cambió.",
    zh: "打开查看有何变化。",
  },
  "alerts.billAdvanced": {
    en: "{bill} advanced.",
    es: "{bill} avanzó.",
    zh: "{bill} 有了进展。",
  },

  // Blocked
  "blocked.title": { en: "Blocked", es: "Bloqueados", zh: "已屏蔽" },
  "blocked.empty": {
    en: "Nothing blocked.",
    es: "No hay nada bloqueado.",
    zh: "没有屏蔽任何内容。",
  },
  "blocked.source": { en: "Source", es: "Fuente", zh: "来源" },
  "blocked.topic": { en: "Topic", es: "Tema", zh: "话题" },
  "blocked.unblock": { en: "Unblock", es: "Desbloquear", zh: "取消屏蔽" },
  "blocked.unblockA11y": {
    en: "Unblock {name}",
    es: "Desbloquear {name}",
    zh: "取消屏蔽 {name}",
  },

  // Interests
  "interests.title": { en: "Interests", es: "Intereses", zh: "兴趣" },
  "interests.topicCount": {
    en: { one: "{count} topic", other: "{count} topics" },
    es: { one: "{count} tema", other: "{count} temas" },
    zh: "{count} 个话题",
  },
  "interests.types": { en: "Types", es: "Tipos", zh: "类型" },
  "interests.bills": {
    en: "Bills & resolutions",
    es: "Proyectos de ley y resoluciones",
    zh: "法案与决议",
  },
  "interests.exec": {
    en: "Executive actions",
    es: "Acciones ejecutivas",
    zh: "行政行动",
  },
  "interests.court": {
    en: "Court cases",
    es: "Casos judiciales",
    zh: "法院案件",
  },
  "interests.local": {
    en: "Local & state",
    es: "Local y estatal",
    zh: "地方与州",
  },

  // Edit profile
  "profile.title": {
    en: "Edit Profile",
    es: "Editar perfil",
    zh: "编辑个人资料",
  },
  "profile.name": { en: "Name", es: "Nombre", zh: "姓名" },
  "profile.email": { en: "Email", es: "Correo electrónico", zh: "电子邮件" },
  "profile.changePhoto": {
    en: "Change photo",
    es: "Cambiar foto",
    zh: "更换照片",
  },
  "profile.deleteAccount": {
    en: "Delete account",
    es: "Eliminar cuenta",
    zh: "删除账户",
  },

  // Help
  "help.title": { en: "Help", es: "Ayuda", zh: "帮助" },
  "help.search": {
    en: "Search help…",
    es: "Buscar en la ayuda…",
    zh: "搜索帮助…",
  },
  "help.q1": {
    en: "Where does Billion get its information?",
    es: "¿De dónde obtiene Billion su información?",
    zh: "Billion 的信息从哪里来？",
  },
  "help.a1": {
    en: "Directly from public sources — Congress.gov, the Federal Register, court dockets, and your local government's records. We link the original every time.",
    es: "Directamente de fuentes públicas: Congress.gov, el Federal Register, los expedientes judiciales y los registros de tu gobierno local. Siempre enlazamos el original.",
    zh: "直接来自公开来源——Congress.gov、《联邦公报》、法院案卷以及你所在地方政府的记录。我们每次都会附上原始链接。",
  },
  "help.q2": {
    en: "Is the AI explainer reliable?",
    es: "¿Es confiable la explicación de la IA?",
    zh: "AI 解读可靠吗？",
  },
  "help.a2": {
    en: "It summarizes the official text to make it readable, but it can simplify nuance. Every article links the verbatim source so you can verify.",
    es: "Resume el texto oficial para que sea fácil de leer, pero puede simplificar matices. Cada artículo enlaza la fuente textual para que puedas verificarla.",
    zh: "它会概括官方文本以便阅读，但可能会简化细节。每篇文章都附有原文链接，方便你核实。",
  },
  "help.q3": {
    en: "How does Dual-Lens stay neutral?",
    es: "¿Cómo se mantiene neutral la Doble Lente?",
    zh: "“双重视角”如何保持中立？",
  },
  "help.a3": {
    en: "We surface arguments from across the spectrum side by side rather than blending them into a single 'neutral' voice.",
    es: "Mostramos argumentos de todo el espectro uno al lado del otro, en lugar de mezclarlos en una sola voz “neutral”.",
    zh: "我们并排呈现来自各方的论点，而不是把它们混合成单一的“中立”声音。",
  },
  "help.q4": {
    en: "How do I change my district?",
    es: "¿Cómo cambio mi distrito?",
    zh: "如何更改我的选区？",
  },
  "help.a4": {
    en: "Update your address under Elections. We re-pull your ballot automatically.",
    es: "Actualiza tu dirección en Elecciones. Volvemos a cargar tu boleta automáticamente.",
    zh: "在“选举”中更新你的地址，我们会自动重新获取你的选票。",
  },
  "help.q5": {
    en: "Why are some names and documents still in English?",
    es: "¿Por qué algunos nombres y documentos siguen en inglés?",
    zh: "为什么有些名称和文件仍是英文？",
  },
  "help.a5": {
    en: "Billion translates its own interface and explanations. Official ballot text, quotes, source documents, names, and addresses stay as published so you can check them against the original.",
    es: "Billion traduce su propia interfaz y sus explicaciones. El texto oficial de la boleta, las citas, los documentos de origen, los nombres y las direcciones se mantienen tal como se publicaron para que puedas compararlos con el original.",
    zh: "Billion 会翻译自己的界面和解读。官方选票文本、引文、原始文件、姓名和地址均保留发布时的原样，方便你与原文核对。",
  },
  "help.stillStuck": {
    en: "Still stuck?",
    es: "¿Sigues con dudas?",
    zh: "还有问题？",
  },
  "help.sendFeedback": {
    en: "Send feedback",
    es: "Enviar comentarios",
    zh: "发送反馈",
  },

  // Privacy
  "privacy.title": { en: "Privacy", es: "Privacidad", zh: "隐私" },
  "privacy.notice": {
    en: "Billion works without an account. We never ask for your name or email to use the app.",
    es: "Billion funciona sin cuenta. Nunca te pedimos tu nombre ni tu correo electrónico para usar la aplicación.",
    zh: "使用 Billion 无需账户。我们绝不会要求你提供姓名或电子邮件才能使用本应用。",
  },
  "privacy.collect": {
    en: "What we collect",
    es: "Lo que recopilamos",
    zh: "我们收集的信息",
  },
  "privacy.controls": {
    en: "Your controls",
    es: "Tus controles",
    zh: "你的控制权",
  },
  "privacy.usage": {
    en: "Usage & error diagnostics",
    es: "Uso y diagnósticos de errores",
    zh: "使用情况与错误诊断",
  },
  "privacy.usageSub": {
    en: "App activity and handled errors are linked to a random installation ID, not your name, email, or an advertising ID.",
    es: "La actividad de la aplicación y los errores gestionados se vinculan a un ID de instalación aleatorio, no a tu nombre, correo electrónico ni a un ID publicitario.",
    zh: "应用活动和已处理的错误会关联到一个随机安装 ID，而不是你的姓名、电子邮件或广告 ID。",
  },
  "privacy.address": {
    en: "Address-based ballot lookup",
    es: "Búsqueda de boleta por dirección",
    zh: "基于地址的选票查询",
  },
  "privacy.addressSub": {
    en: "Address text is sent through our servers for autocomplete and civic lookups; the selected address is also stored on this device.",
    es: "El texto de la dirección pasa por nuestros servidores para el autocompletado y las consultas cívicas; la dirección seleccionada también se guarda en este dispositivo.",
    zh: "地址文本会通过我们的服务器用于自动补全和公民信息查询；所选地址也会保存在本设备上。",
  },
  "privacy.noAds": {
    en: "No ads or cross-app tracking",
    es: "Sin anuncios ni rastreo entre aplicaciones",
    zh: "无广告，无跨应用跟踪",
  },
  "privacy.noAdsSub": {
    en: "No advertising identifiers, and we never track you across other companies' apps or sites.",
    es: "No usamos identificadores publicitarios y nunca te rastreamos en aplicaciones o sitios de otras empresas.",
    zh: "我们不使用广告标识符，也绝不会在其他公司的应用或网站上跟踪你。",
  },
  "privacy.editAddress": {
    en: "Edit or clear your address",
    es: "Edita o borra tu dirección",
    zh: "编辑或清除你的地址",
  },
  "privacy.editAddressSub": {
    en: "Open the Ballot tab to change or remove your saved address anytime.",
    es: "Abre la pestaña de la boleta para cambiar o quitar tu dirección guardada en cualquier momento.",
    zh: "随时打开“选票”标签页更改或删除已保存的地址。",
  },
  "privacy.stopAnalytics": {
    en: "Stop analytics",
    es: "Detener las analíticas",
    zh: "停止分析",
  },
  "privacy.stopAnalyticsSub": {
    en: "Uninstalling Billion stops all analytics collection from this device.",
    es: "Desinstalar Billion detiene toda la recopilación de analíticas desde este dispositivo.",
    zh: "卸载 Billion 将停止从本设备收集任何分析数据。",
  },
  "privacy.access": {
    en: "Access or delete your data",
    es: "Accede a tus datos o elimínalos",
    zh: "访问或删除你的数据",
  },
  "privacy.accessSub": {
    en: "Email {email} and we'll help with any request.",
    es: "Escribe a {email} y te ayudaremos con cualquier solicitud.",
    zh: "发送邮件至 {email}，我们会协助处理任何请求。",
  },
  "privacy.readPolicy": {
    en: "Read full Privacy Policy",
    es: "Leer la Política de privacidad completa",
    zh: "阅读完整隐私政策",
  },

  // Feedback (settings and tab)
  "feedback.title": {
    en: "Send Feedback",
    es: "Enviar comentarios",
    zh: "发送反馈",
  },
  "feedback.tabTitle": { en: "Feedback", es: "Comentarios", zh: "反馈" },
  "feedback.category": { en: "Category", es: "Categoría", zh: "类别" },
  "feedback.bug": { en: "Bug report", es: "Informe de error", zh: "错误报告" },
  "feedback.idea": {
    en: "Feature idea",
    es: "Idea de función",
    zh: "功能建议",
  },
  "feedback.content": {
    en: "Content issue",
    es: "Problema de contenido",
    zh: "内容问题",
  },
  "feedback.details": { en: "Details", es: "Detalles", zh: "详情" },
  "feedback.placeholder": {
    en: "Tell us what happened or what you'd love to see…",
    es: "Cuéntanos qué pasó o qué te gustaría ver…",
    zh: "告诉我们发生了什么，或你希望看到什么…",
  },
  "feedback.attached": {
    en: "App version {version} attached automatically.",
    es: "La versión {version} de la aplicación se adjunta automáticamente.",
    zh: "将自动附上应用版本 {version}。",
  },
  "feedback.sending": { en: "Sending…", es: "Enviando…", zh: "正在发送…" },
  "feedback.submit": {
    en: "Submit feedback",
    es: "Enviar comentarios",
    zh: "提交反馈",
  },
  "feedback.guidedBug": {
    en: "Use guided bug report form",
    es: "Usar el formulario guiado de informe de error",
    zh: "使用引导式错误报告表单",
  },
  "feedback.guidedFeature": {
    en: "Use guided feature request form",
    es: "Usar el formulario guiado de solicitud de función",
    zh: "使用引导式功能请求表单",
  },
  "feedback.continueBug": {
    en: "Continue to bug report",
    es: "Continuar al informe de error",
    zh: "继续填写错误报告",
  },
  "feedback.continueFeature": {
    en: "Continue to feature request",
    es: "Continuar a la solicitud de función",
    zh: "继续填写功能请求",
  },
  "feedback.sendContent": {
    en: "Send content issue via email",
    es: "Enviar el problema de contenido por correo",
    zh: "通过电子邮件发送内容问题",
  },
  "feedback.emailUs": {
    en: "Email us at {email}",
    es: "Escríbenos a {email}",
    zh: "发送邮件至 {email}",
  },
  "feedback.englishNote": {
    en: "You can write in any language. Forms open in English.",
    es: "Puedes escribir en cualquier idioma. Los formularios se abren en inglés.",
    zh: "你可以用任何语言填写。表单以英文打开。",
  },
  "feedback.legal": {
    en: "Terms and Privacy Policy",
    es: "Términos y Política de privacidad",
    zh: "条款与隐私政策",
  },
  "feedback.alreadySent": {
    en: "Already sent",
    es: "Ya enviado",
    zh: "已发送",
  },
  "feedback.alreadySentBody": {
    en: "Give us a moment before sending another.",
    es: "Espera un momento antes de enviar otro.",
    zh: "请稍等片刻再发送下一条。",
  },
  "feedback.sent": {
    en: "Feedback sent",
    es: "Comentarios enviados",
    zh: "反馈已发送",
  },
  "feedback.sentBody": {
    en: "Thanks. We read every note.",
    es: "Gracias. Leemos cada mensaje.",
    zh: "谢谢。我们会阅读每一条反馈。",
  },
  "feedback.sendFailed": {
    en: "Couldn’t send feedback",
    es: "No se pudieron enviar los comentarios",
    zh: "无法发送反馈",
  },
  "feedback.tryLater": {
    en: "Please try again in a moment.",
    es: "Inténtalo de nuevo en un momento.",
    zh: "请稍后再试。",
  },
  "feedback.formFailed": {
    en: "Couldn’t open the feedback form",
    es: "No se pudo abrir el formulario de comentarios",
    zh: "无法打开反馈表单",
  },
  "feedback.mailFailed": {
    en: "Couldn’t open your mail app",
    es: "No se pudo abrir tu aplicación de correo",
    zh: "无法打开你的邮件应用",
  },
  "feedback.mailFailedBody": {
    en: "Please email us directly at {email}.",
    es: "Escríbenos directamente a {email}.",
    zh: "请直接发送邮件至 {email}。",
  },

  // Notifications
  "notify.title": { en: "Notifications", es: "Notificaciones", zh: "通知" },
  "notify.dek": {
    en: "Stay informed without being overwhelmed.",
    es: "Mantente informado sin sentirte abrumado.",
    zh: "及时了解，而不被信息淹没。",
  },
  "notify.important": {
    en: "Important updates",
    es: "Novedades importantes",
    zh: "重要动态",
  },
  "notify.breaking": { en: "BREAKING", es: "ÚLTIMA HORA", zh: "突发" },
  "notify.breakingSub": {
    en: "Rare, human-reviewed developments",
    es: "Novedades poco frecuentes revisadas por personas",
    zh: "少量经人工审核的重大进展",
  },
  "notify.following": {
    en: "Things you follow",
    es: "Lo que sigues",
    zh: "你关注的内容",
  },
  "notify.followingSub": {
    en: "Bills, elections, courts & topics",
    es: "Proyectos de ley, elecciones, tribunales y temas",
    zh: "法案、选举、法院与话题",
  },
  "notify.exec": {
    en: "Executive orders",
    es: "Órdenes ejecutivas",
    zh: "行政令",
  },
  "notify.execSub": {
    en: "When a new executive order is published",
    es: "Cuando se publica una nueva orden ejecutiva",
    zh: "有新的行政令发布时",
  },
  "notify.brief": { en: "Daily Brief", es: "Resumen diario", zh: "每日简报" },
  "notify.briefSub": {
    en: "A concise summary each morning",
    es: "Un resumen breve cada mañana",
    zh: "每天早上的简明摘要",
  },
  "notify.recap": {
    en: "Evening Recap",
    es: "Resumen de la tarde",
    zh: "晚间回顾",
  },
  "notify.recapSub": {
    en: "What changed today",
    es: "Lo que cambió hoy",
    zh: "今天有哪些变化",
  },
  "notify.delivery": { en: "Delivery", es: "Entrega", zh: "推送方式" },
  "notify.quietHours": {
    en: "Quiet hours",
    es: "Horas de silencio",
    zh: "免打扰时段",
  },
  "notify.from": { en: "From", es: "Desde", zh: "从" },
  "notify.until": { en: "Until", es: "Hasta", zh: "至" },
  "notify.hourA11y": {
    en: "{label} {time}. Tap to move one hour later.",
    es: "{label} {time}. Toca para retrasar una hora.",
    zh: "{label} {time}。轻点可推迟一小时。",
  },
  "notify.testA11y": {
    en: "Send a test notification",
    es: "Enviar una notificación de prueba",
    zh: "发送测试通知",
  },
  "notify.test": {
    en: "Test notification",
    es: "Notificación de prueba",
    zh: "测试通知",
  },
  "notify.testHint": {
    en: "Lock-screen only. Tap it to open that bill.",
    es: "Solo en la pantalla de bloqueo. Tócala para abrir ese proyecto de ley.",
    zh: "仅在锁屏显示。轻点即可打开该法案。",
  },
  "notify.history": { en: "Your alerts", es: "Tus alertas", zh: "你的提醒" },
  "notify.historySub": {
    en: "A record of what we sent.",
    es: "Un registro de lo que enviamos.",
    zh: "我们已发送内容的记录。",
  },
  "notify.pushUnavailable": {
    en: "Push registration unavailable. Check this phone's notification permissions and try again.",
    es: "El registro de notificaciones no está disponible. Revisa los permisos de notificación de este teléfono e inténtalo de nuevo.",
    zh: "推送注册不可用。请检查本手机的通知权限后重试。",
  },
  "notify.expoAccepted": {
    en: "Expo accepted the test. Check this phone's notifications for delivery.",
    es: "Expo aceptó la prueba. Revisa las notificaciones de este teléfono para confirmar la entrega.",
    zh: "Expo 已接受测试。请查看本手机的通知以确认是否送达。",
  },
  "notify.sendFailed": {
    en: "Could not send the alert.",
    es: "No se pudo enviar la alerta.",
    zh: "无法发送提醒。",
  },
  "notify.sendFailedDetail": {
    en: "Could not send the alert. {detail}",
    es: "No se pudo enviar la alerta. {detail}",
    zh: "无法发送提醒。{detail}",
  },
  "notify.denied": {
    en: "Notifications are off on this phone.",
    es: "Las notificaciones están desactivadas en este teléfono.",
    zh: "本手机已关闭通知。",
  },
  "notify.rebuild": {
    en: "This Dev Client needs a rebuild before it can send alerts.",
    es: "Este Dev Client necesita recompilarse antes de poder enviar alertas.",
    zh: "此 Dev Client 需要重新构建后才能发送提醒。",
  },
  "notify.cannotSend": {
    en: "This build cannot send lock-screen alerts yet.",
    es: "Esta versión aún no puede enviar alertas a la pantalla de bloqueo.",
    zh: "此版本暂时无法发送锁屏提醒。",
  },
  "notify.testArrives": {
    en: {
      one: "Lock the phone (Cmd+L). It arrives in {count} second. Long-press the banner for the navy card.",
      other:
        "Lock the phone (Cmd+L). It arrives in {count} seconds. Long-press the banner for the navy card.",
    },
    es: {
      one: "Bloquea el teléfono (Cmd+L). Llegará en {count} segundo. Mantén pulsado el aviso para ver la tarjeta azul marino.",
      other:
        "Bloquea el teléfono (Cmd+L). Llegará en {count} segundos. Mantén pulsado el aviso para ver la tarjeta azul marino.",
    },
    zh: "锁定手机（Cmd+L）。通知将在 {count} 秒后到达。长按横幅可查看深蓝色卡片。",
  },
  "notify.quietWait": {
    en: "Quiet hours — it will wait until {time}.",
    es: "Horas de silencio: esperará hasta las {time}.",
    zh: "免打扰时段——将等到 {time} 再推送。",
  },
  "notify.sentLock": {
    en: "Sent to the lock screen. Tap it to open.",
    es: "Enviada a la pantalla de bloqueo. Tócala para abrirla.",
    zh: "已发送到锁屏。轻点即可打开。",
  },

  // Saved
  "saved.title": { en: "Saved", es: "Guardados", zh: "已保存" },
  "saved.removeA11y": {
    en: "Remove from saved",
    es: "Quitar de guardados",
    zh: "从已保存中移除",
  },
  "saved.stillOnDevice": {
    en: "Saved records are still on this device.",
    es: "Los registros guardados siguen en este dispositivo.",
    zh: "已保存的记录仍在本设备上。",
  },
  "saved.count": {
    en: "{count} saved",
    es: { one: "{count} guardado", other: "{count} guardados" },
    zh: "已保存 {count} 项",
  },
  "saved.empty": {
    en: "Nothing saved yet",
    es: "Aún no has guardado nada",
    zh: "还没有保存任何内容",
  },
  "saved.emptySub": {
    en: "Tap the bookmark on a bill, a case, or an order to come back to it.",
    es: "Toca el marcador de un proyecto de ley, un caso o una orden para volver a él más tarde.",
    zh: "轻点法案、案件或行政令上的书签，以便稍后再看。",
  },

  // Terms & Privacy documents
  "terms.title": {
    en: "Terms & Privacy",
    es: "Términos y privacidad",
    zh: "条款与隐私",
  },
  "terms.lastUpdated": {
    en: "Last updated {date}",
    es: "Última actualización: {date}",
    zh: "最后更新：{date}",
  },
  "terms.translationNote": {
    en: "Translated from English. Choose English in the language menu to read the original wording.",
    es: "Traducido del inglés. Elige English en el menú de idioma para leer el texto original.",
    zh: "译自英文。可在语言菜单中选择 English 阅读原文。",
  },
  "terms.tosTitle": {
    en: "Terms of Service",
    es: "Términos del servicio",
    zh: "服务条款",
  },
  "terms.privacyTitle": {
    en: "Privacy Policy",
    es: "Política de privacidad",
    zh: "隐私政策",
  },
  "terms.t1Title": {
    en: "1. Acceptance of Terms",
    es: "1. Aceptación de los términos",
    zh: "1. 条款的接受",
  },
  "terms.t1Body": {
    en: "By accessing our website, joining our waitlist, or downloading and using the Billion application ('the App'), you agree to be bound by these Terms of Service. If you do not agree, do not use our services.",
    es: "Al acceder a nuestro sitio web, unirte a nuestra lista de espera o descargar y usar la aplicación Billion (“la Aplicación”), aceptas quedar sujeto a estos Términos del servicio. Si no estás de acuerdo, no uses nuestros servicios.",
    zh: "访问我们的网站、加入候补名单，或下载并使用 Billion 应用（“本应用”），即表示你同意受本服务条款的约束。如果你不同意，请不要使用我们的服务。",
  },
  "terms.t2Title": {
    en: "2. Description of Service",
    es: "2. Descripción del servicio",
    zh: "2. 服务说明",
  },
  "terms.t2Body": {
    en: "Billion provides AI-generated summaries and analyses of publicly available government documents, together with civic and election information compiled from public and third-party sources, for informational and civic-education purposes only. This is not legal, financial, or professional advice. Always verify information through the primary sources we link to.",
    es: "Billion ofrece resúmenes y análisis generados por IA de documentos gubernamentales de acceso público, junto con información cívica y electoral recopilada de fuentes públicas y de terceros, solo con fines informativos y de educación cívica. No constituye asesoramiento legal, financiero ni profesional. Verifica siempre la información en las fuentes primarias que enlazamos.",
    zh: "Billion 提供由 AI 生成的公开政府文件摘要与分析，以及从公共和第三方来源汇编的公民与选举信息，仅供参考和公民教育之用。这不构成法律、财务或专业建议。请始终通过我们链接的原始来源核实信息。",
  },
  "terms.t3Title": {
    en: "3. Eligibility",
    es: "3. Requisitos",
    zh: "3. 使用资格",
  },
  "terms.t3Body": {
    en: "You must be at least 13 years of age to use our services. If you are under 18, you represent that you have obtained parental or guardian consent.",
    es: "Debes tener al menos 13 años para usar nuestros servicios. Si eres menor de 18 años, declaras que cuentas con el consentimiento de tus padres o tutores.",
    zh: "你必须年满 13 周岁才能使用我们的服务。如果你未满 18 周岁，即表示你已获得父母或监护人的同意。",
  },
  "terms.t4Title": {
    en: "4. Prohibited Conduct",
    es: "4. Conductas prohibidas",
    zh: "4. 禁止行为",
  },
  "terms.t4Body": {
    en: "You agree not to: (a) reverse-engineer or decompile any part of the App; (b) interfere with or disrupt our infrastructure; (c) scrape or harvest data using automated means; or (d) use the App to distribute misleading or unlawful content.",
    es: "Aceptas no: (a) aplicar ingeniería inversa ni descompilar ninguna parte de la Aplicación; (b) interferir con nuestra infraestructura ni interrumpirla; (c) extraer o recopilar datos por medios automatizados; ni (d) usar la Aplicación para difundir contenido engañoso o ilegal.",
    zh: "你同意不会：(a) 对本应用的任何部分进行逆向工程或反编译；(b) 干扰或破坏我们的基础设施；(c) 使用自动化手段抓取或收集数据；或 (d) 利用本应用传播误导性或违法内容。",
  },
  "terms.t5Title": {
    en: "5. Intellectual Property",
    es: "5. Propiedad intelectual",
    zh: "5. 知识产权",
  },
  "terms.t5Body": {
    en: "All original content, design, and software are the property of Billion and protected by applicable intellectual property laws. Government documents are in the public domain. You receive a limited, non-exclusive, non-transferable license for personal, non-commercial use only.",
    es: "Todo el contenido original, el diseño y el software son propiedad de Billion y están protegidos por las leyes de propiedad intelectual aplicables. Los documentos gubernamentales son de dominio público. Recibes una licencia limitada, no exclusiva e intransferible solo para uso personal y no comercial.",
    zh: "所有原创内容、设计和软件均为 Billion 的财产，受适用的知识产权法律保护。政府文件属于公有领域。你获得的是有限的、非排他性的、不可转让的许可，仅限个人非商业用途。",
  },
  "terms.t6Title": {
    en: "6. AI-Generated Content Disclaimer",
    es: "6. Aviso sobre contenido generado por IA",
    zh: "6. AI 生成内容免责声明",
  },
  "terms.t6Body": {
    en: "Summaries and other automated content are generated by AI and may contain errors or omissions. Election and ballot information is compiled from government and third-party sources and may be incomplete or out of date. Billion is not liable for decisions made in reliance on this content — always confirm details with official sources before relying on them.",
    es: "Los resúmenes y otros contenidos automatizados se generan con IA y pueden contener errores u omisiones. La información sobre elecciones y boletas se recopila de fuentes gubernamentales y de terceros, y puede estar incompleta o desactualizada. Billion no se hace responsable de las decisiones tomadas con base en este contenido; confirma siempre los detalles con fuentes oficiales antes de confiar en ellos.",
    zh: "摘要及其他自动化内容由 AI 生成，可能存在错误或遗漏。选举和选票信息汇编自政府和第三方来源，可能不完整或已过时。Billion 对依据这些内容作出的决定不承担责任——在依赖之前，请务必向官方来源确认细节。",
  },
  "terms.t7Title": {
    en: "7. Disclaimer of Warranties",
    es: "7. Exención de garantías",
    zh: "7. 免责声明",
  },
  "terms.t7Body": {
    en: "THE APP IS PROVIDED 'AS IS' WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.",
    es: "LA APLICACIÓN SE PROPORCIONA “TAL CUAL”, SIN GARANTÍAS DE NINGÚN TIPO, EXPRESAS O IMPLÍCITAS, INCLUIDAS LAS GARANTÍAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO O NO INFRACCIÓN.",
    zh: "本应用按“现状”提供，不附带任何形式的明示或默示保证，包括但不限于适销性、特定用途适用性或不侵权的保证。",
  },
  "terms.t8Title": {
    en: "8. Limitation of Liability",
    es: "8. Limitación de responsabilidad",
    zh: "8. 责任限制",
  },
  "terms.t8Body": {
    en: "TO THE FULLEST EXTENT PERMITTED BY LAW, BILLION SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF OUR SERVICES.",
    es: "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, BILLION NO SERÁ RESPONSABLE DE NINGÚN DAÑO INDIRECTO, INCIDENTAL, ESPECIAL, CONSECUENTE O PUNITIVO DERIVADO DEL USO DE NUESTROS SERVICIOS.",
    zh: "在法律允许的最大范围内，Billion 不对因你使用我们的服务而产生的任何间接、附带、特殊、后果性或惩罚性损害承担责任。",
  },
  "terms.t9Title": {
    en: "9. Governing Law",
    es: "9. Ley aplicable",
    zh: "9. 适用法律",
  },
  "terms.t9Body": {
    en: "These Terms are governed by the laws of the State of California, without regard to conflict-of-law principles.",
    es: "Estos Términos se rigen por las leyes del estado de California, sin tener en cuenta los principios sobre conflicto de leyes.",
    zh: "本条款受加利福尼亚州法律管辖，不考虑法律冲突原则。",
  },
  "terms.t10Title": {
    en: "10. Changes to These Terms",
    es: "10. Cambios en estos Términos",
    zh: "10. 本条款的变更",
  },
  "terms.t10Body": {
    en: "We may update these Terms from time to time. When we do, we will revise the 'Last updated' date shown above, and where we have your contact information (for example, if you joined our waitlist) we may notify you by email. Your continued use of our services after an update takes effect constitutes acceptance of the revised Terms.",
    es: "Es posible que actualicemos estos Términos periódicamente. Cuando lo hagamos, modificaremos la fecha de “Última actualización” que aparece arriba y, si tenemos tu información de contacto (por ejemplo, si te uniste a nuestra lista de espera), podremos avisarte por correo electrónico. Si sigues usando nuestros servicios después de que una actualización entre en vigor, aceptas los Términos revisados.",
    zh: "我们可能会不时更新本条款。届时我们将修改上方显示的“最后更新”日期；如果我们有你的联系方式（例如你加入了候补名单），可能会通过电子邮件通知你。更新生效后你继续使用我们的服务，即表示你接受修订后的条款。",
  },
  "terms.t11Title": {
    en: "11. Contact",
    es: "11. Contacto",
    zh: "11. 联系方式",
  },
  "terms.t11Body": {
    en: "Questions about these Terms? Email us at {email}.",
    es: "¿Tienes preguntas sobre estos Términos? Escríbenos a {email}.",
    zh: "对本条款有疑问？请发送邮件至 {email}。",
  },
  "terms.p1Title": {
    en: "1. Information We Collect",
    es: "1. Información que recopilamos",
    zh: "1. 我们收集的信息",
  },
  "terms.p1Body": {
    en: "Billion does not require an account, and the app does not ask for your name or email address to read summaries or view your ballot. During onboarding, the app asks which governments and topics you want to follow and whether you prefer instant or evening alerts. It stores those answers on your device. If an authenticated session already exists, the app also stores topic and content-type selections with that account. If you join the mailing list in the app or on our website, we collect the email address you submit. In the app, if you enter a registered address to load your local ballot and representatives, address text is sent to our servers for autocomplete and lookup, as described in Section 4. If you send feedback, we may receive your message, the category you choose, basic technical details such as app version and build, platform, and operating-system version, and when you contact us by email, your email address and standard email headers. When you use the app or website, our analytics automatically collect usage events such as screens viewed, articles opened, searches you run, and onboarding selections, plus handled error diagnostics and technical details such as device model, operating system and version, app version, language, and time zone. These events are associated with a randomly generated, persistent installation identifier. We do not collect your precise device location, and we do not use advertising identifiers.",
    es: "Billion no requiere una cuenta, y la aplicación no te pide tu nombre ni tu correo electrónico para leer resúmenes o ver tu boleta. Durante la configuración inicial, la aplicación pregunta qué gobiernos y temas quieres seguir y si prefieres alertas inmediatas o por la tarde. Guarda esas respuestas en tu dispositivo. Si ya existe una sesión autenticada, la aplicación también guarda las selecciones de temas y tipos de contenido en esa cuenta. Si te unes a la lista de correo en la aplicación o en nuestro sitio web, recopilamos la dirección de correo que envíes. En la aplicación, si ingresas una dirección registrada para cargar tu boleta y tus representantes locales, el texto de la dirección se envía a nuestros servidores para el autocompletado y la búsqueda, como se describe en la Sección 4. Si envías comentarios, podemos recibir tu mensaje, la categoría que elijas, datos técnicos básicos como la versión y compilación de la aplicación, la plataforma y la versión del sistema operativo y, cuando nos contactas por correo electrónico, tu dirección de correo y los encabezados estándar del correo. Cuando usas la aplicación o el sitio web, nuestras analíticas recopilan automáticamente eventos de uso como las pantallas vistas, los artículos abiertos, las búsquedas que realizas y las selecciones de la configuración inicial, además de diagnósticos de errores gestionados y datos técnicos como el modelo del dispositivo, el sistema operativo y su versión, la versión de la aplicación, el idioma y la zona horaria. Estos eventos se asocian a un identificador de instalación persistente generado aleatoriamente. No recopilamos la ubicación precisa de tu dispositivo ni usamos identificadores publicitarios.",
    zh: "Billion 不要求注册账户，阅读摘要或查看选票时本应用也不会要求你提供姓名或电子邮件地址。在初始设置期间，本应用会询问你想关注哪些政府和话题，以及你偏好即时提醒还是晚间提醒，并将这些回答保存在你的设备上。如果已存在经过身份验证的会话，本应用还会将话题和内容类型的选择保存到该账户。如果你在应用内或我们的网站上加入邮件列表，我们会收集你提交的电子邮件地址。在应用中，如果你输入登记地址以加载本地选票和代表，地址文本会发送到我们的服务器用于自动补全和查询，详见第 4 节。如果你发送反馈，我们可能会收到你的留言、你选择的类别、基本技术信息（如应用版本和构建号、平台及操作系统版本）；当你通过电子邮件联系我们时，还会收到你的电子邮件地址和标准邮件头信息。当你使用本应用或网站时，我们的分析工具会自动收集使用事件，例如浏览的页面、打开的文章、进行的搜索和初始设置中的选择，以及已处理的错误诊断和技术信息，如设备型号、操作系统及版本、应用版本、语言和时区。这些事件与一个随机生成的持久安装标识符相关联。我们不收集你设备的精确位置，也不使用广告标识符。",
  },
  "terms.p2Title": {
    en: "2. Mailing List",
    es: "2. Lista de correo",
    zh: "2. 邮件列表",
  },
  "terms.p2Body": {
    en: "When you join our mailing list in the app or on our website, we collect your email address to send feature releases and occasional civic updates about Billion. Mailing list addresses are stored with our email provider, and we send a confirmation email. You can unsubscribe at any time using the link in our emails or by emailing {email}.",
    es: "Cuando te unes a nuestra lista de correo en la aplicación o en nuestro sitio web, recopilamos tu dirección de correo para enviarte lanzamientos de funciones y novedades cívicas ocasionales sobre Billion. Las direcciones de la lista de correo se guardan en nuestro proveedor de correo electrónico, y enviamos un correo de confirmación. Puedes darte de baja en cualquier momento con el enlace de nuestros correos o escribiendo a {email}.",
    zh: "当你在应用内或我们的网站上加入邮件列表时，我们会收集你的电子邮件地址，用于发送有关 Billion 的功能发布和不定期的公民资讯。邮件列表地址存储在我们的电子邮件服务商处，我们会发送一封确认邮件。你可以随时通过邮件中的链接或发送邮件至 {email} 退订。",
  },
  "terms.p3Title": {
    en: "3. How We Use Your Information",
    es: "3. Cómo usamos tu información",
    zh: "3. 我们如何使用你的信息",
  },
  "terms.p3Body": {
    en: "We use the information we collect to operate, maintain, and improve Billion; remember your setup choices and show relevant connection labels; understand how readers use onboarding; look up the ballot and representatives for an address you enter; respond to your feedback; send waitlist and service-related communications; keep our services secure; and comply with legal obligations. We do not sell your personal information, and we do not use it to serve you advertising.",
    es: "Usamos la información que recopilamos para operar, mantener y mejorar Billion; recordar tus opciones de configuración y mostrar etiquetas de conexión relevantes; entender cómo los lectores usan la configuración inicial; buscar la boleta y los representantes de la dirección que ingreses; responder a tus comentarios; enviar comunicaciones sobre la lista de espera y el servicio; mantener seguros nuestros servicios; y cumplir con obligaciones legales. No vendemos tu información personal ni la usamos para mostrarte publicidad.",
    zh: "我们使用所收集的信息来运营、维护和改进 Billion；记住你的设置选择并显示相关的关联标签；了解读者如何使用初始设置；查询你所输入地址对应的选票和代表；回复你的反馈；发送候补名单及服务相关通知；保障我们服务的安全；以及履行法律义务。我们不会出售你的个人信息，也不会将其用于向你投放广告。",
  },
  "terms.p4Title": {
    en: "4. Address and Location",
    es: "4. Dirección y ubicación",
    zh: "4. 地址与位置",
  },
  "terms.p4Body": {
    en: "Billion does not access your device's GPS or precise location. To show your local ballot and representatives, you type in a registered address. The selected address is stored on your device using the operating system's secure storage. As you type, address text is sent through our servers to Google Places for autocomplete; when a ballot or representative lookup runs, the address is sent through our servers to the Google Civic Information API. Open States supplies public representative data, but we do not send it your street address. We cache lookup results under a one-way hash of the address rather than storing the address as the cache key. Cached responses may contain normalized address components and expire automatically, within about thirty days. We do not join the address to an app account or to the analytics installation identifier, and we never use it for advertising or cross-app tracking. Apple's App Privacy label calls a physical address \"Data Linked to You\" because an address can identify a person or household, even though Billion does not join it to the analytics identifier. You can change or clear your saved address in the app at any time.",
    es: "Billion no accede al GPS ni a la ubicación precisa de tu dispositivo. Para mostrar tu boleta y tus representantes locales, escribes una dirección registrada. La dirección seleccionada se guarda en tu dispositivo con el almacenamiento seguro del sistema operativo. Mientras escribes, el texto de la dirección se envía a través de nuestros servidores a Google Places para el autocompletado; cuando se realiza una búsqueda de boleta o de representantes, la dirección se envía a través de nuestros servidores a la API de Google Civic Information. Open States proporciona datos públicos sobre representantes, pero no le enviamos tu dirección. Guardamos en caché los resultados de búsqueda con un hash unidireccional de la dirección, en lugar de usar la dirección como clave de caché. Las respuestas en caché pueden contener componentes normalizados de la dirección y caducan automáticamente en unos treinta días. No vinculamos la dirección a una cuenta de la aplicación ni al identificador de instalación de las analíticas, y nunca la usamos para publicidad ni para rastreo entre aplicaciones. La etiqueta de privacidad de Apple considera una dirección física como “Datos vinculados a ti” porque una dirección puede identificar a una persona o un hogar, aunque Billion no la vincula al identificador de analíticas. Puedes cambiar o borrar tu dirección guardada en la aplicación en cualquier momento.",
    zh: "Billion 不会访问你设备的 GPS 或精确位置。为显示本地选票和代表，你需要输入登记地址。所选地址使用操作系统的安全存储保存在你的设备上。在你输入时，地址文本会通过我们的服务器发送至 Google Places 进行自动补全；在查询选票或代表时，地址会通过我们的服务器发送至 Google Civic Information API。Open States 提供公开的代表数据，但我们不会向其发送你的街道地址。我们以地址的单向哈希值缓存查询结果，而不是以地址本身作为缓存键。缓存的响应可能包含标准化的地址组成部分，并会在约三十天内自动过期。我们不会将地址与应用账户或分析安装标识符相关联，也绝不会将其用于广告或跨应用跟踪。由于地址可以识别个人或家庭，Apple 的“App 隐私”标签将实际地址归为“与你关联的数据”，尽管 Billion 并未将其与分析标识符相关联。你可以随时在应用中更改或清除已保存的地址。",
  },
  "terms.p5Title": {
    en: "5. Analytics and Diagnostics",
    es: "5. Analíticas y diagnósticos",
    zh: "5. 分析与诊断",
  },
  "terms.p5Body": {
    en: "We use PostHog to understand how Billion is used and to diagnose handled application errors. When onboarding finishes, the analytics event includes the government categories and topics you selected and your instant or evening alert choices. The app does not automatically send crash reports or performance measurements such as hang rate or energy use. App analytics are associated with a randomly generated, persistent installation identifier, which links events from the same app installation or device but is not your name, email address, or an advertising identifier. Because searches and usage events are associated with that identifier, Apple's App Privacy label describes Search History, Device ID, Usage Data, and related diagnostics as \"Data Linked to You.\" PostHog may infer an approximate, city-level location from the request IP address. We do not use this information to track you across other companies' apps or websites. Analytics data is processed by PostHog in the United States.",
    es: "Usamos PostHog para entender cómo se usa Billion y diagnosticar errores gestionados de la aplicación. Cuando termina la configuración inicial, el evento de analíticas incluye las categorías de gobierno y los temas que seleccionaste, y tus preferencias de alertas inmediatas o por la tarde. La aplicación no envía automáticamente informes de fallos ni mediciones de rendimiento, como la tasa de bloqueos o el consumo de energía. Las analíticas de la aplicación se asocian a un identificador de instalación persistente generado aleatoriamente, que vincula los eventos de la misma instalación o dispositivo, pero que no es tu nombre, tu correo electrónico ni un identificador publicitario. Como las búsquedas y los eventos de uso se asocian a ese identificador, la etiqueta de privacidad de Apple describe el historial de búsqueda, el ID del dispositivo, los datos de uso y los diagnósticos relacionados como “Datos vinculados a ti”. PostHog puede deducir una ubicación aproximada, a nivel de ciudad, a partir de la dirección IP de la solicitud. No usamos esta información para rastrearte en aplicaciones o sitios web de otras empresas. PostHog procesa los datos de analíticas en los Estados Unidos.",
    zh: "我们使用 PostHog 来了解 Billion 的使用情况并诊断已处理的应用错误。初始设置完成时，分析事件会包含你选择的政府类别和话题，以及你对即时或晚间提醒的选择。本应用不会自动发送崩溃报告或性能指标（如卡顿率或能耗）。应用分析数据与一个随机生成的持久安装标识符相关联，该标识符会关联来自同一安装或设备的事件，但它不是你的姓名、电子邮件地址或广告标识符。由于搜索和使用事件与该标识符相关联，Apple 的“App 隐私”标签将搜索历史、设备 ID、使用数据及相关诊断归为“与你关联的数据”。PostHog 可能会根据请求的 IP 地址推断出大致的城市级位置。我们不会使用这些信息在其他公司的应用或网站上跟踪你。分析数据由 PostHog 在美国处理。",
  },
  "terms.p6Title": {
    en: "6. Data Sharing",
    es: "6. Datos compartidos",
    zh: "6. 数据共享",
  },
  "terms.p6Body": {
    en: "We share information only with service providers that help us operate Billion, and only as needed to run the service: PostHog for analytics and handled-error diagnostics; Resend for waitlist and some feedback email delivery; Google Forms for guided feedback; Google Places for address autocomplete; and the Google Civic Information API for address-based ballot and district lookups. Open States supplies public representative data without receiving your street address. We require these providers to protect information they process for us and not use it for their own marketing. We may also disclose information if we are required to by law.",
    es: "Solo compartimos información con proveedores de servicios que nos ayudan a operar Billion, y solo en la medida necesaria para prestar el servicio: PostHog para analíticas y diagnósticos de errores gestionados; Resend para la lista de espera y el envío de algunos correos de comentarios; Google Forms para los comentarios guiados; Google Places para el autocompletado de direcciones; y la API de Google Civic Information para buscar boletas y distritos por dirección. Open States proporciona datos públicos sobre representantes sin recibir tu dirección. Exigimos a estos proveedores que protejan la información que procesan en nuestro nombre y que no la usen para su propio marketing. También podemos divulgar información si la ley nos lo exige.",
    zh: "我们仅与帮助我们运营 Billion 的服务提供商共享信息，且仅限于提供服务所必需的范围：PostHog 用于分析和已处理错误的诊断；Resend 用于候补名单及部分反馈邮件的发送；Google Forms 用于引导式反馈；Google Places 用于地址自动补全；Google Civic Information API 用于基于地址的选票和选区查询。Open States 提供公开的代表数据，但不会收到你的街道地址。我们要求这些提供商保护其代为处理的信息，且不得将其用于自身营销。如法律要求，我们也可能披露信息。",
  },
  "terms.p7Title": {
    en: "7. Data Retention",
    es: "7. Conservación de datos",
    zh: "7. 数据保留",
  },
  "terms.p7Body": {
    en: "Billion does not currently offer a usable account sign-in flow in the app. Your onboarding choices remain on your device until you uninstall the app or the app resets its versioned onboarding record. If an authenticated session already exists, topic and content-type selections may also remain in the account's server record. Mailing list email addresses are retained until you unsubscribe or ask us to delete them. Feedback is retained in Google Forms or email so that we can act on it. Your selected registered address remains on your device until you change it, clear it, or uninstall the app; server lookup caches use a hashed address key, may contain normalized address components, and expire automatically within about thirty days. Analytics and handled-error diagnostic data are retained by our analytics provider according to its retention settings.",
    es: "Actualmente, Billion no ofrece en la aplicación un proceso de inicio de sesión utilizable. Tus opciones de configuración inicial permanecen en tu dispositivo hasta que desinstales la aplicación o esta restablezca su registro de configuración. Si ya existe una sesión autenticada, las selecciones de temas y tipos de contenido también pueden permanecer en el registro de la cuenta en el servidor. Las direcciones de la lista de correo se conservan hasta que te des de baja o nos pidas eliminarlas. Los comentarios se conservan en Google Forms o en el correo electrónico para poder atenderlos. Tu dirección registrada seleccionada permanece en tu dispositivo hasta que la cambies, la borres o desinstales la aplicación; las cachés de búsqueda del servidor usan una clave de dirección con hash, pueden contener componentes normalizados de la dirección y caducan automáticamente en unos treinta días. Nuestro proveedor de analíticas conserva los datos de analíticas y de diagnóstico de errores según su configuración de conservación.",
    zh: "Billion 目前在应用中不提供可用的账户登录流程。你的初始设置选择会保留在你的设备上，直到你卸载应用或应用重置其带版本号的设置记录。如果已存在经过身份验证的会话，话题和内容类型的选择也可能保留在该账户的服务器记录中。邮件列表中的电子邮件地址会保留到你退订或要求我们删除为止。反馈会保留在 Google Forms 或电子邮件中，以便我们处理。你所选的登记地址会保留在你的设备上，直到你更改、清除或卸载应用；服务器查询缓存使用经哈希处理的地址键，可能包含标准化的地址组成部分，并会在约三十天内自动过期。分析数据和已处理错误的诊断数据由我们的分析服务商根据其保留设置进行保存。",
  },
  "terms.p8Title": {
    en: "8. Your Choices",
    es: "8. Tus opciones",
    zh: "8. 你的选择",
  },
  "terms.p8Body": {
    en: "You can control your information in several ways. You can edit or clear your saved address in the app at any time. Uninstalling the app removes its local onboarding choices and saved address from your device and stops further analytics collection from that installation. You can unsubscribe from mailing list emails at any time. You may also email {email} to request access to, or deletion of, information we hold about you, such as your waitlist email address, feedback you sent, or preferences attached to an authenticated account, and we will honor applicable requests.",
    es: "Puedes controlar tu información de varias formas. Puedes editar o borrar tu dirección guardada en la aplicación en cualquier momento. Al desinstalar la aplicación, se eliminan de tu dispositivo las opciones de configuración inicial y la dirección guardada, y se detiene la recopilación de analíticas de esa instalación. Puedes darte de baja de los correos de la lista en cualquier momento. También puedes escribir a {email} para solicitar acceso a la información que tenemos sobre ti, o su eliminación, como tu correo de la lista de espera, los comentarios que enviaste o las preferencias vinculadas a una cuenta autenticada, y atenderemos las solicitudes que correspondan.",
    zh: "你可以通过多种方式控制你的信息。你可以随时在应用中编辑或清除已保存的地址。卸载应用会从你的设备上删除本地的初始设置选择和已保存的地址，并停止该安装的后续分析数据收集。你可以随时退订邮件列表。你也可以发送邮件至 {email}，要求访问或删除我们持有的关于你的信息，例如你的候补名单电子邮件地址、你发送的反馈或与经过身份验证的账户关联的偏好设置，我们将依法处理相关请求。",
  },
  "terms.p9Title": {
    en: "9. Security",
    es: "9. Seguridad",
    zh: "9. 安全",
  },
  "terms.p9Body": {
    en: "We use commercially reasonable measures to protect your information, including storing your address in your device's secure storage and encrypting data in transit. No method of transmission or storage is completely secure, however, and we cannot guarantee absolute security.",
    es: "Usamos medidas comercialmente razonables para proteger tu información, como guardar tu dirección en el almacenamiento seguro de tu dispositivo y cifrar los datos en tránsito. Sin embargo, ningún método de transmisión o almacenamiento es completamente seguro, y no podemos garantizar una seguridad absoluta.",
    zh: "我们采取商业上合理的措施保护你的信息，包括将你的地址存储在设备的安全存储中，以及对传输中的数据进行加密。但任何传输或存储方式都无法做到绝对安全，我们无法保证绝对的安全性。",
  },
  "terms.p10Title": {
    en: "10. Children's Privacy",
    es: "10. Privacidad de los menores",
    zh: "10. 儿童隐私",
  },
  "terms.p10Body": {
    en: "Our services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If we learn that we have collected such information, we will delete it promptly.",
    es: "Nuestros servicios no están dirigidos a menores de 13 años, y no recopilamos a sabiendas información personal de menores de 13 años. Si descubrimos que hemos recopilado dicha información, la eliminaremos de inmediato.",
    zh: "我们的服务不面向 13 岁以下的儿童，我们也不会在知情的情况下收集 13 岁以下儿童的个人信息。如果我们发现收集了此类信息，将立即删除。",
  },
  "terms.p11Title": {
    en: "11. Changes to This Policy",
    es: "11. Cambios en esta política",
    zh: "11. 本政策的变更",
  },
  "terms.p11Body": {
    en: "We may update this Privacy Policy from time to time. When we do, we will revise the 'Last updated' date shown above, and where we have your contact information — for example, if you joined our waitlist — we may notify you by email.",
    es: "Es posible que actualicemos esta Política de privacidad periódicamente. Cuando lo hagamos, modificaremos la fecha de “Última actualización” que aparece arriba y, si tenemos tu información de contacto (por ejemplo, si te uniste a nuestra lista de espera), podremos avisarte por correo electrónico.",
    zh: "我们可能会不时更新本隐私政策。届时我们将修改上方显示的“最后更新”日期；如果我们有你的联系方式——例如你加入了候补名单——可能会通过电子邮件通知你。",
  },
  "terms.p12Title": {
    en: "12. Contact",
    es: "12. Contacto",
    zh: "12. 联系方式",
  },
  "terms.p12Body": {
    en: "Questions about this Privacy Policy or your data? Email us at {email}.",
    es: "¿Tienes preguntas sobre esta Política de privacidad o tus datos? Escríbenos a {email}.",
    zh: "对本隐私政策或你的数据有疑问？请发送邮件至 {email}。",
  },
} satisfies Catalog;
