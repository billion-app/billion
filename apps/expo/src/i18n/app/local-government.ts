import type { Catalog } from "./types";

export const localGovernmentStrings = {
  "place.santaclara.name": {
    en: "Santa Clara",
    es: "Santa Clara",
    zh: "圣克拉拉",
  },
  "place.santaclara.body": {
    en: "City of Santa Clara",
    es: "Ciudad de Santa Clara",
    zh: "圣克拉拉市",
  },
  "place.santaclara.description": {
    en: "City Council and commission decisions",
    es: "Decisiones del concejo municipal y las comisiones",
    zh: "市议会和委员会决策",
  },
  "local.home.kicker": {
    en: "City Hall · {city}",
    es: "Ayuntamiento · {city}",
    zh: "市政厅 · {city}",
  },
  "local.home.source": {
    en: "From the city's published meeting agendas.",
    es: "De las agendas de reuniones publicadas por la ciudad.",
    zh: "来自该市公布的会议议程。",
  },
  "local.sourceEnglish": {
    en: "Titles appear in English, as the city published them.",
    es: "Los títulos aparecen en inglés, tal como los publicó la ciudad.",
    zh: "标题保留市政府发布的英文原文。",
  },
  "local.home.error": {
    en: "City records didn't load. Try again in a moment.",
    es: "No se cargaron los registros municipales. Inténtalo de nuevo en un momento.",
    zh: "市政记录未能加载。请稍后重试。",
  },
  "local.home.empty": {
    en: "No upcoming {city} meetings have published agendas yet.",
    es: "Las próximas reuniones de {city} aún no tienen agendas publicadas.",
    zh: "{city}即将举行的会议尚未公布议程。",
  },
  "local.home.recent": {
    en: "See recent decisions",
    es: "Ver decisiones recientes",
    zh: "查看近期决策",
  },
  "local.home.all": {
    en: "See all upcoming and recent decisions",
    es: "Ver todas las decisiones próximas y recientes",
    zh: "查看所有即将审议及近期决策",
  },
  "local.agendaItem": {
    en: "Item {item}",
    es: "Punto {item}",
    zh: "议程项目 {item}",
  },
  "local.saved.unavailable": {
    en: "Saved record unavailable",
    es: "Registro guardado no disponible",
    zh: "已保存的记录暂不可用",
  },
  "local.saved.retry": {
    en: "Some saved records didn't load. Your follows are still on this device.",
    es: "Algunos registros guardados no se cargaron. Tus seguimientos siguen en este dispositivo.",
    zh: "部分已保存记录未能加载。你的关注仍保存在此设备上。",
  },
  "follow.saveDecision": {
    en: "Follow this city decision",
    es: "Seguir esta decisión municipal",
    zh: "关注此市政决策",
  },
  "follow.removeDecision": {
    en: "Unfollow this city decision",
    es: "Dejar de seguir esta decisión municipal",
    zh: "取消关注此市政决策",
  },
} satisfies Catalog;
