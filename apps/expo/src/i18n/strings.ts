/**
 * App text in English, Spanish, and Simplified Chinese.
 *
 * English is the complete dictionary. Spanish and Chinese may lag behind it:
 * a missing key falls back to English rather than showing the key, so new
 * English text can ship before its translation. `{name}` placeholders are
 * filled by `translate`.
 */

import type { AppLanguage } from "./language";

const en = {
  // Tabs
  "tabs.feed": "Feed",
  "tabs.browse": "Browse",
  "tabs.elections": "Elections",
  "tabs.settings": "Settings",

  // Settings
  "settings.title": "Settings",
  "settings.guest": "Guest",
  "settings.guestMeta": "No account features yet",
  "settings.alerts": "Alerts",
  "settings.notifications": "Notifications",
  "settings.notificationsSub": "Stay informed without being overwhelmed.",
  "settings.library": "Library",
  "settings.saved": "Saved",
  "settings.privacy": "Privacy",
  "settings.support": "Support",
  "settings.help": "Help",
  "settings.feedback": "Feedback",
  "settings.about": "About",
  "settings.preferences": "Preferences",
  "settings.language": "Language",
  "settings.resetPreferences": "Reset preferences",
  "settings.resetPreferencesSub": "Start onboarding again",
  "settings.resetTitle": "Reset preferences?",
  "settings.resetBody":
    "This clears your current topics, government choices, and alert preferences, then starts onboarding again.",
  "common.cancel": "Cancel",
  "common.retry": "Retry",
  "common.reset": "Reset",
  "common.goBack": "Go Back",

  // Language screen
  "language.title": "Language",
  "language.intro":
    "Billion's own text and article explanations appear in this language. Quotes and original documents stay in their original language so you can check them against the source.",
  "language.machineNote":
    "Articles are machine translated from English. Check the source for exact wording.",

  // Article reader
  "article.loading": "Loading content…",
  "article.loadFailed": "Failed to load content",
  "article.notFound": "Content not found",
  "article.share": "Share this record",
  "article.save": "Save to read later",
  "article.unsave": "Remove from saved",
  "article.created": "Created",
  "article.updated": "Last updated",
  "article.sponsoredBy": "Sponsored by",
  "article.caseBrief": "Case brief",
  "article.theBrief": "The brief",
  "article.plainExplainer": "Plain explainer",
  "article.opinions": "Opinions",
  "article.courtRecord": "Court record",
  "article.originalText": "Original text",
  "article.writtenBy": "Written by Billion AI · Always check the source",
  "article.details": "Details",
  "article.hide": "Hide",
  "article.whereItStands": "Where it stands",
  "article.dontTakeOurWord": "Don't take our word for it.",
  "article.dontTakeOurWordSub":
    "Read the full, unedited text and track every action on the official record.",
  "article.checkCourtRecord": "Check the court record.",
  "article.openSource": "Open the source",
  "article.viewRelated": "View all related records",
  "article.translating": "Translating…",
  "article.translationPending":
    "Preparing your translation… English is shown until it is ready.",
  "reader.originalSources":
    "Quotes and source documents stay in their original language.",
  "reader.translatedTitles":
    "Machine-translated titles · check the original sources",
  "reader.showEnglish": "Show English",
  "reader.translateNote":
    "Billion machine-translates its explanations from English. Quotes and source documents stay in their original language.",
  "listen.unavailable":
    "Read aloud requires the latest app version and an installed voice.",
  "listen.silentHint":
    "No sound? Turn off Silent Mode and turn up your volume.",
  "listen.error":
    "Audio could not start. Check your volume and installed voices, then try Listen again.",
  "article.translated": "Machine translated from English",
  "article.translationUnavailable":
    "Translation isn't available right now. Showing English.",
  "article.sourceStaysEnglish":
    "Original documents are shown as published, in English.",

  // Listen
  "listen.start": "Listen to this article",
  "listen.short": "Listen",
  "listen.pause": "Pause",
  "listen.resume": "Resume",
  "listen.stop": "Stop listening",
  "listen.progress": "Part {current} of {total}",
  "listen.listening": "Listening",
  "listen.paused": "Paused",
} as const;

export type StringKey = keyof typeof en;
type Dictionary = Partial<Record<StringKey, string>>;

const es: Dictionary = {
  "tabs.feed": "Inicio",
  "tabs.browse": "Explorar",
  "tabs.elections": "Elecciones",
  "tabs.settings": "Ajustes",

  "settings.title": "Ajustes",
  "settings.guest": "Invitado",
  "settings.guestMeta": "Aún no hay funciones de cuenta",
  "settings.alerts": "Alertas",
  "settings.notifications": "Notificaciones",
  "settings.notificationsSub": "Mantente informado sin saturarte.",
  "settings.library": "Biblioteca",
  "settings.saved": "Guardados",
  "settings.privacy": "Privacidad",
  "settings.support": "Ayuda y soporte",
  "settings.help": "Ayuda",
  "settings.feedback": "Comentarios",
  "settings.about": "Acerca de",
  "settings.preferences": "Preferencias",
  "settings.language": "Idioma",
  "settings.resetPreferences": "Restablecer preferencias",
  "settings.resetPreferencesSub": "Volver a empezar la configuración inicial",
  "settings.resetTitle": "¿Restablecer preferencias?",
  "settings.resetBody":
    "Esto borra tus temas, tus gobiernos elegidos y tus preferencias de alertas, y vuelve a empezar la configuración inicial.",
  "common.cancel": "Cancelar",
  "common.retry": "Reintentar",
  "common.reset": "Restablecer",
  "common.goBack": "Volver",

  "language.title": "Idioma",
  "language.intro":
    "Los textos de Billion y las explicaciones de los artículos aparecen en este idioma. Las citas y los documentos originales se mantienen en su idioma original para que puedas compararlos con la fuente.",
  "language.machineNote":
    "Los artículos se traducen automáticamente del inglés. Consulta la fuente para ver el texto exacto.",

  "article.loading": "Cargando contenido…",
  "article.loadFailed": "No se pudo cargar el contenido",
  "article.notFound": "Contenido no encontrado",
  "article.share": "Compartir este registro",
  "article.save": "Guardar para leer después",
  "article.unsave": "Quitar de guardados",
  "article.created": "Creado",
  "article.updated": "Última actualización",
  "article.sponsoredBy": "Patrocinado por",
  "article.caseBrief": "Resumen del caso",
  "article.theBrief": "El resumen",
  "article.plainExplainer": "Explicación sencilla",
  "article.opinions": "Opiniones",
  "article.courtRecord": "Expediente judicial",
  "article.originalText": "Texto original",
  "article.writtenBy":
    "Escrito por la IA de Billion · Verifica siempre la fuente",
  "article.details": "Detalles",
  "article.hide": "Ocultar",
  "article.whereItStands": "En qué punto está",
  "article.dontTakeOurWord": "No te quedes solo con nuestra palabra.",
  "article.dontTakeOurWordSub":
    "Lee el texto completo y sin editar, y sigue cada acción en el registro oficial.",
  "article.checkCourtRecord": "Revisa el expediente judicial.",
  "article.openSource": "Abrir la fuente",
  "article.viewRelated": "Ver todos los registros relacionados",
  "article.translating": "Traduciendo…",
  "article.translationPending":
    "Preparando la traducción… Se muestra inglés mientras está lista.",
  "reader.originalSources":
    "Las citas y los documentos conservan su idioma original.",
  "reader.translatedTitles":
    "Títulos traducidos automáticamente · consulta las fuentes originales",
  "reader.showEnglish": "Ver en inglés",
  "reader.translateNote":
    "Billion traduce automáticamente sus explicaciones del inglés. Las citas y los documentos conservan su idioma original.",
  "listen.unavailable":
    "Para escuchar, necesitas la última versión de la app y una voz instalada.",
  "listen.silentHint":
    "¿No se oye? Desactiva el modo silencio y sube el volumen.",
  "listen.error":
    "No se pudo iniciar el audio. Revisa el volumen y las voces instaladas e inténtalo de nuevo.",
  "article.translated": "Traducción automática del inglés",
  "article.translationUnavailable":
    "La traducción no está disponible ahora. Se muestra en inglés.",
  "article.sourceStaysEnglish":
    "Los documentos originales se muestran tal como se publicaron, en inglés.",

  "listen.start": "Escuchar este artículo",
  "listen.short": "Escuchar",
  "listen.pause": "Pausar",
  "listen.resume": "Reanudar",
  "listen.stop": "Dejar de escuchar",
  "listen.progress": "Parte {current} de {total}",
  "listen.listening": "Escuchando",
  "listen.paused": "En pausa",
};

const zh: Dictionary = {
  "tabs.feed": "首页",
  "tabs.browse": "浏览",
  "tabs.elections": "选举",
  "tabs.settings": "设置",

  "settings.title": "设置",
  "settings.guest": "访客",
  "settings.guestMeta": "暂无账户功能",
  "settings.alerts": "提醒",
  "settings.notifications": "通知",
  "settings.notificationsSub": "及时了解，不被打扰。",
  "settings.library": "收藏库",
  "settings.saved": "已保存",
  "settings.privacy": "隐私",
  "settings.support": "支持",
  "settings.help": "帮助",
  "settings.feedback": "反馈",
  "settings.about": "关于",
  "settings.preferences": "偏好设置",
  "settings.language": "语言",
  "settings.resetPreferences": "重置偏好设置",
  "settings.resetPreferencesSub": "重新开始引导设置",
  "settings.resetTitle": "重置偏好设置？",
  "settings.resetBody":
    "这将清除你当前的话题、所选政府和提醒偏好，并重新开始引导设置。",
  "common.cancel": "取消",
  "common.retry": "重试",
  "common.reset": "重置",
  "common.goBack": "返回",

  "language.title": "语言",
  "language.intro":
    "Billion 的界面文字和文章解读将以此语言显示。引文和原始文件保留原文，方便你与来源核对。",
  "language.machineNote":
    "文章由英文机器翻译而来。如需准确措辞，请查看原始来源。",

  "article.loading": "正在加载内容…",
  "article.loadFailed": "内容加载失败",
  "article.notFound": "未找到内容",
  "article.share": "分享此记录",
  "article.save": "保存以便稍后阅读",
  "article.unsave": "从已保存中移除",
  "article.created": "创建于",
  "article.updated": "最后更新",
  "article.sponsoredBy": "提案人",
  "article.caseBrief": "案件摘要",
  "article.theBrief": "摘要",
  "article.plainExplainer": "通俗解读",
  "article.opinions": "意见书",
  "article.courtRecord": "法院记录",
  "article.originalText": "原文",
  "article.writtenBy": "由 Billion AI 撰写 · 请务必核对来源",
  "article.details": "详情",
  "article.hide": "收起",
  "article.whereItStands": "当前进展",
  "article.dontTakeOurWord": "别只听我们说。",
  "article.dontTakeOurWordSub":
    "阅读未经删改的全文，并在官方记录中追踪每一项进展。",
  "article.checkCourtRecord": "查看法院记录。",
  "article.openSource": "打开来源",
  "article.viewRelated": "查看所有相关记录",
  "article.translating": "正在翻译…",
  "article.translationPending": "正在准备翻译…完成前暂时显示英文。",
  "reader.originalSources": "引文和原始文件保留原文。",
  "reader.translatedTitles": "标题由机器翻译 · 请核对原始来源",
  "reader.showEnglish": "显示英文",
  "reader.translateNote":
    "Billion 的解读由英文机器翻译。引文和原始文件保留原文。",
  "listen.unavailable": "朗读需要最新版本的应用及已安装的语音。",
  "listen.silentHint": "没有声音？请关闭静音模式并调高音量。",
  "listen.error": "无法开始播放。请检查音量和已安装的语音，然后重试朗读。",
  "article.translated": "由英文机器翻译",
  "article.translationUnavailable": "暂时无法翻译，现显示英文。",
  "article.sourceStaysEnglish": "原始文件按发布时的英文原样显示。",

  "listen.start": "收听本文",
  "listen.short": "收听",
  "listen.pause": "暂停",
  "listen.resume": "继续",
  "listen.stop": "停止收听",
  "listen.progress": "第 {current} 部分，共 {total} 部分",
  "listen.listening": "正在收听",
  "listen.paused": "已暂停",
};

export const DICTIONARIES: Record<AppLanguage, Dictionary> = { en, es, zh };

export function translate(
  language: AppLanguage,
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  const text = DICTIONARIES[language][key] ?? en[key];
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
