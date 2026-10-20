/** Feed (digest home) and Browse. */
import type { Catalog } from "./types";

export const feedStrings = {
  "card.metadata.0": { en: "Senate", es: "Senado", zh: "参议院" },
  "card.metadata.1": {
    en: "House",
    es: "Cámara de Representantes",
    zh: "众议院",
  },
  "card.metadata.2": { en: "Assembly", es: "Asamblea", zh: "众议院" },
  "card.metadata.3": { en: "Enacted", es: "Promulgada", zh: "已成为法律" },
  "card.metadata.4": { en: "Vetoed", es: "Vetada", zh: "已否决" },
  "card.metadata.5": { en: "Failed", es: "No aprobada", zh: "未通过" },
  "card.metadata.6": { en: "Withdrawn", es: "Retirada", zh: "已撤回" },
  "card.metadata.7": {
    en: "Agreed to by both chambers",
    es: "Aprobada por ambas cámaras",
    zh: "两院已同意",
  },
  "card.metadata.8": {
    en: "Agreed to in House",
    es: "Aprobada en la Cámara de Representantes",
    zh: "众议院已同意",
  },
  "card.metadata.9": {
    en: "Agreed to in Senate",
    es: "Aprobada en el Senado",
    zh: "参议院已同意",
  },
  "card.metadata.10": {
    en: "Passed House",
    es: "Aprobada en la Cámara de Representantes",
    zh: "众议院已通过",
  },
  "card.metadata.11": {
    en: "Passed Senate",
    es: "Aprobada en el Senado",
    zh: "参议院已通过",
  },
  "card.metadata.12": {
    en: "Passed both chambers",
    es: "Aprobada por ambas cámaras",
    zh: "两院已通过",
  },
  "card.metadata.13": { en: "Passed", es: "Aprobada", zh: "已通过" },
  "card.metadata.14": {
    en: "Presented to governor",
    es: "Presentada al gobernador",
    zh: "已送交州长",
  },
  "card.metadata.15": {
    en: "Enrolled",
    es: "Preparada para la firma",
    zh: "已完成正式誊录",
  },
  "card.metadata.16": {
    en: "Passed committee",
    es: "Aprobada en comisión",
    zh: "委员会已通过",
  },
  "card.metadata.17": { en: "Proposed", es: "Propuesta", zh: "提案" },
  "card.metadata.18": {
    en: "Referred to committee",
    es: "Remitida a comisión",
    zh: "已交委员会审议",
  },
  "card.metadata.19": { en: "Introduced", es: "Presentada", zh: "已提出" },
  "card.metadata.20": {
    en: "Reported by committee",
    es: "Informada por la comisión",
    zh: "委员会已报告",
  },
  "greeting.morning": {
    en: "Good Morning",
    es: "Buenos días",
    zh: "早上好",
  },
  "greeting.afternoon": {
    en: "Good Afternoon",
    es: "Buenas tardes",
    zh: "下午好",
  },
  "greeting.evening": {
    en: "Good Evening",
    es: "Buenas tardes",
    zh: "晚上好",
  },
  "greeting.night": { en: "Good Night", es: "Buenas noches", zh: "晚上好" },
  "greeting.withName": {
    en: "{greeting}, {name}",
    es: "{greeting}, {name}",
    zh: "{greeting}，{name}",
  },
  "greeting.lockupA11y": {
    en: "Billion, location {location}. Change location",
    es: "Billion, ubicación: {location}. Cambiar ubicación",
    zh: "Billion，位置：{location}。更改位置",
  },
  "greeting.locationSet": {
    en: "Location set to:",
    es: "Ubicación:",
    zh: "当前位置：",
  },
  "greeting.closeLocation": {
    en: "Close location menu",
    es: "Cerrar el menú de ubicación",
    zh: "关闭位置菜单",
  },
  "greeting.locationTitle": { en: "Location", es: "Ubicación", zh: "位置" },

  "home.dailyBrief": {
    en: "THE DAILY BRIEF",
    es: "EL RESUMEN DIARIO",
    zh: "每日简报",
  },
  "home.localNews": {
    en: "Today’s local news",
    es: "Noticias locales de hoy",
    zh: "今日本地新闻",
  },
  "home.loadingLocal": {
    en: "Loading local records",
    es: "Cargando registros locales",
    zh: "正在加载本地记录",
  },
  "home.localFailed": {
    en: "Local records didn’t load",
    es: "No se cargaron los registros locales",
    zh: "本地记录未能加载",
  },
  "home.tryMoment": {
    en: "Try again in a moment.",
    es: "Vuelve a intentarlo en un momento.",
    zh: "请稍后重试。",
  },
  "home.noStateRecords": {
    en: "No {place} records yet",
    es: "Aún no hay registros de {place}",
    zh: "暂无{place}记录",
  },
  "home.noFeaturedLocal": {
    en: "No featured local bills yet",
    es: "Aún no hay proyectos de ley locales destacados",
    zh: "暂无精选本地法案",
  },
  "home.checkBrowseLocal": {
    en: "Check Browse for the full {place} record.",
    es: "Consulta Explorar para ver todo el registro de {place}.",
    zh: "前往“浏览”查看{place}的完整记录。",
  },
  "home.alsoToday": { en: "Also today", es: "También hoy", zh: "今日其他" },
  "home.loadingUnread": {
    en: "Loading unread articles",
    es: "Cargando artículos no leídos",
    zh: "正在加载未读文章",
  },
  "home.articlesFailed": {
    en: "Articles didn’t load",
    es: "No se cargaron los artículos",
    zh: "文章未能加载",
  },
  "home.noNewArticles": {
    en: "No new articles today",
    es: "No hay artículos nuevos hoy",
    zh: "今天没有新文章",
  },
  "home.checkBrowseFederal": {
    en: "Check Browse for the full federal feed.",
    es: "Consulta Explorar para ver todas las novedades federales.",
    zh: "前往“浏览”查看完整的联邦动态。",
  },
  "home.coverCongress": {
    en: "COVER · CONGRESS",
    es: "PORTADA · CONGRESO",
    zh: "封面 · 国会",
  },
  "home.capitolArt": {
    en: "U.S. Capitol line art",
    es: "Ilustración del Capitolio de EE. UU.",
    zh: "美国国会大厦线条插图",
  },
  "home.loadingMore": {
    en: "Loading more articles",
    es: "Cargando más artículos",
    zh: "正在加载更多文章",
  },

  "browse.title": { en: "Browse", es: "Explorar", zh: "浏览" },
  "browse.filter.all": { en: "All", es: "Todo", zh: "全部" },
  "browse.filter.bill": { en: "Bills", es: "Proyectos de ley", zh: "法案" },
  "browse.filter.government_content": {
    en: "Executive",
    es: "Ejecutivo",
    zh: "行政",
  },
  "browse.filter.court_case": { en: "Courts", es: "Tribunales", zh: "法院" },
  "browse.refreshFailedTitle": {
    en: "Unable to refresh",
    es: "No se pudo actualizar",
    zh: "无法刷新",
  },
  "browse.refreshFailedBody": {
    en: "Your current results are still available.",
    es: "Tus resultados actuales siguen disponibles.",
    zh: "当前结果仍可查看。",
  },
  "browse.openSaved": {
    en: "Open saved articles",
    es: "Abrir artículos guardados",
    zh: "打开已保存的文章",
  },
  "browse.search": { en: "Search", es: "Buscar", zh: "搜索" },
  "browse.loadingFeatured": {
    en: "Loading featured bills",
    es: "Cargando proyectos de ley destacados",
    zh: "正在加载精选法案",
  },
  "browse.billCount": {
    en: { one: "{count} bill", other: "{count} bills" },
    es: { one: "{count} proyecto de ley", other: "{count} proyectos de ley" },
    zh: "{count} 项法案",
  },
  "browse.resultCount": {
    en: { one: "{count} result", other: "{count} results" },
    es: { one: "{count} resultado", other: "{count} resultados" },
    zh: "{count} 条结果",
  },
  "browse.otherMatches": {
    en: {
      one: "{count} match in {place}",
      other: "{count} matches in {place}",
    },
    es: {
      one: "{count} coincidencia en {place}",
      other: "{count} coincidencias en {place}",
    },
    zh: "{place}有 {count} 条匹配结果",
  },
  "browse.switch": { en: "Switch", es: "Cambiar", zh: "切换" },
  "browse.switchA11y": {
    en: "Switch to {place}",
    es: "Cambiar a {place}",
    zh: "切换到{place}",
  },
  "browse.loadFailed": {
    en: "{place} didn’t load",
    es: "No se cargó {place}",
    zh: "{place}未能加载",
  },
  "browse.loadFailedBody": {
    en: "Your scope hasn’t changed. Try this jurisdiction again.",
    es: "Tu selección no ha cambiado. Vuelve a intentarlo con esta jurisdicción.",
    zh: "你的范围没有改变。请重试此辖区。",
  },
  "browse.federalInstead": {
    en: "Browse Federal instead",
    es: "Explorar el nivel federal",
    zh: "改为浏览联邦内容",
  },
  "browse.noStateCourt": {
    en: "No {place} court cases yet",
    es: "Aún no hay casos judiciales de {place}",
    zh: "暂无{place}法院案件",
  },
  "browse.noStateBills": {
    en: "No {place} bills found",
    es: "No se encontraron proyectos de ley de {place}",
    zh: "未找到{place}法案",
  },
  "browse.noStateRecords": {
    en: "No {place} records found",
    es: "No se encontraron registros de {place}",
    zh: "未找到{place}记录",
  },
  "browse.noStateMatches": {
    en: "No {place} matches found",
    es: "No se encontraron coincidencias de {place}",
    zh: "未找到{place}的匹配结果",
  },
  "browse.noMatchFor": {
    en: "No match for “{query}”",
    es: "Sin resultados para “{query}”",
    zh: "没有与“{query}”匹配的结果",
  },
  "browse.nothingFound": {
    en: "Nothing found",
    es: "No se encontró nada",
    zh: "未找到内容",
  },
  "browse.maEmptyBody": {
    en: "Check back for new bills and court docket activity.",
    es: "Vuelve más tarde para ver nuevos proyectos de ley y actividad judicial.",
    zh: "请稍后再来查看新法案和法院案件动态。",
  },
  "browse.stateEmptyBody": {
    en: "{place} legislature only — courts and orders aren’t in yet.",
    es: "Solo la legislatura de {place}: aún no incluimos tribunales ni órdenes.",
    zh: "目前仅收录{place}议会内容，尚未包含法院和行政令。",
  },
  "browse.tryDifferent": {
    en: "Try a different search.",
    es: "Prueba otra búsqueda.",
    zh: "请尝试其他搜索词。",
  },
  "browse.showStateBills": {
    en: "Show {place} bills",
    es: "Mostrar proyectos de ley de {place}",
    zh: "显示{place}法案",
  },

  "card.status.bill": { en: "Legislation", es: "Legislación", zh: "立法" },
  "card.status.government_content": {
    en: "Executive action",
    es: "Acción ejecutiva",
    zh: "行政行动",
  },
  "card.status.court_case": {
    en: "Court case",
    es: "Caso judicial",
    zh: "法院案件",
  },
  "card.status.general": { en: "Briefing", es: "Resumen", zh: "简报" },
  "card.featuredA11y": {
    en: "Featured bill {index} of {total}",
    es: "Proyecto de ley destacado {index} de {total}",
    zh: "精选法案，第 {index} 项，共 {total} 项",
  },

  "change.saved": {
    en: "You saved this",
    es: "Guardaste esto",
    zh: "你已保存",
  },
  "change.watchCongress": {
    en: "You watch Congress",
    es: "Sigues al Congreso",
    zh: "你关注国会",
  },
  "change.watchPlace": {
    en: "You watch {place}",
    es: "Sigues {place}",
    zh: "你关注{place}",
  },
  "change.watchState": {
    en: "You watch your state",
    es: "Sigues a tu estado",
    zh: "你关注你所在的州",
  },
  "change.watchCourts": {
    en: "You watch the courts",
    es: "Sigues a los tribunales",
    zh: "你关注法院",
  },
  "change.watchWhiteHouse": {
    en: "You watch the White House",
    es: "Sigues a la Casa Blanca",
    zh: "你关注白宫",
  },
  "change.billsMoved": {
    en: { one: "{count} bill moved", other: "{count} bills moved" },
    es: {
      one: "{count} proyecto de ley avanzó",
      other: "{count} proyectos de ley avanzaron",
    },
    zh: "{count} 项法案有进展",
  },
  "change.courtRulings": {
    en: { one: "{count} court ruling", other: "{count} court rulings" },
    es: { one: "{count} fallo judicial", other: "{count} fallos judiciales" },
    zh: "{count} 项法院裁决",
  },
  "change.executiveActions": {
    en: { one: "{count} executive action", other: "{count} executive actions" },
    es: {
      one: "{count} acción ejecutiva",
      other: "{count} acciones ejecutivas",
    },
    zh: "{count} 项行政行动",
  },
  "change.savedMoved": {
    en: { one: "{count} you saved moved", other: "{count} you saved moved" },
    es: {
      one: "{count} que guardaste avanzó",
      other: "{count} que guardaste avanzaron",
    },
    zh: "你保存的 {count} 项有进展",
  },
  "change.nothingNew": {
    en: "Nothing new yet.",
    es: "Aún no hay novedades.",
    zh: "暂无新内容。",
  },
  "change.movedAway": {
    en: {
      one: "{count} thing moved while you were away.",
      other: "{count} things moved while you were away.",
    },
    es: {
      one: "{count} cosa cambió mientras no estabas.",
      other: "{count} cosas cambiaron mientras no estabas.",
    },
    zh: "你不在时有 {count} 项动态。",
  },
  "change.worthKnowing": {
    en: {
      one: "{count} thing worth knowing.",
      other: "{count} things worth knowing.",
    },
    es: {
      one: "{count} cosa que vale la pena saber.",
      other: "{count} cosas que vale la pena saber.",
    },
    zh: "{count} 件值得了解的事。",
  },
} satisfies Catalog;
