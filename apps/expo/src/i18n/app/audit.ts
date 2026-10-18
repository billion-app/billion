import type { Catalog } from "./types";

export const auditStrings = {
  "Check your address": {
    en: "Check your address",
    es: "Comprueba tu dirección",
    zh: "请检查地址",
  },
  "Enter a complete address and try again.": {
    en: "Enter a complete address and try again.",
    es: "Introduce una dirección completa e inténtalo de nuevo.",
    zh: "请输入完整地址后重试。",
  },
  "We couldn’t load your ballot": {
    en: "We couldn’t load your ballot",
    es: "No pudimos cargar tu papeleta",
    zh: "无法加载你的选票",
  },
  "Try again to load your ballot, or visit your election office for local information.":
    {
      en: "Try again to load your ballot, or visit your election office for local information.",
      es: "Vuelve a intentarlo o consulta tu oficina electoral para obtener información local.",
      zh: "请重试，或向当地选举办公室查询。",
    },
  "Partial ballot data": {
    en: "Partial ballot data",
    es: "Datos parciales de la papeleta",
    zh: "选票资料不完整",
  },
  "Partial provider data · other contests or candidates may be missing. Confirm your complete ballot with your election office.":
    {
      en: "Partial provider data · other contests or candidates may be missing. Confirm your complete ballot with your election office.",
      es: "Datos parciales del proveedor; pueden faltar contiendas o candidaturas. Confirma la papeleta completa con tu oficina electoral.",
      zh: "提供方资料不完整，可能缺少其他选举项目或候选人。请向选举办公室核实完整选票。",
    },
  "Ballot details unavailable": {
    en: "Ballot details unavailable",
    es: "Detalles de la papeleta no disponibles",
    zh: "暂无选票详情",
  },
  "Billion has no contest information for this election. Check your election office for the official ballot.":
    {
      en: "Billion has no contest information for this election. Check your election office for the official ballot.",
      es: "Billion no tiene información de las contiendas de esta elección. Consulta la papeleta oficial con tu oficina electoral.",
      zh: "Billion 暂无本次选举的竞选资料。请向选举办公室查询正式选票。",
    },
  "No ballot data found": {
    en: "No ballot data found",
    es: "No se encontraron datos de la papeleta",
    zh: "未找到选票资料",
  },
  "Billion found no ballot data for this lookup. This does not mean there is no election.":
    {
      en: "Billion found no ballot data for this lookup. This does not mean there is no election.",
      es: "Billion no encontró datos para esta consulta. Esto no significa que no haya una elección.",
      zh: "本次查询未找到选票资料。这不表示没有选举。",
    },
  "Verification date unavailable": {
    en: "Verification date unavailable",
    es: "Fecha de verificación no disponible",
    zh: "暂无核实日期",
  },
  "Last verified {date} by {reviewer}": {
    en: "Last verified {date} by {reviewer}",
    es: "Última verificación: {date}, por {reviewer}",
    zh: "最近由 {reviewer} 于 {date} 核实",
  },
  "Original text link": {
    en: "Original text link",
    es: "Enlace al texto original",
    zh: "原文链接",
  },
  "Statement summary": {
    en: "Statement summary",
    es: "Resumen de la declaración",
    zh: "声明摘要",
  },
  Incumbency: { en: "Incumbency", es: "Cargo actual", zh: "现任情况" },
  "Statement in favor": {
    en: "Statement in favor",
    es: "Declaración a favor",
    zh: "支持声明",
  },
  "Statement against": {
    en: "Statement against",
    es: "Declaración en contra",
    zh: "反对声明",
  },
  Photo: { en: "Photo", es: "Foto", zh: "照片" },
  Content: { en: "Content", es: "Contenido", zh: "内容" },
  "Withdrawn; name remains listed by the ballot source": {
    en: "Withdrawn; name remains listed by the ballot source",
    es: "Retirada; el nombre sigue en la lista de la fuente electoral",
    zh: "已退选；选票来源仍列出其姓名",
  },
  "Listed by the ballot source": {
    en: "Listed by the ballot source",
    es: "En la lista de la fuente electoral",
    zh: "选票来源已列出",
  },
  "Statement guide entry · ballot status unverified": {
    en: "Statement guide entry · ballot status unverified",
    es: "Entrada en la guía de declaraciones · presencia en la papeleta sin verificar",
    zh: "列入声明指南；尚未核实选票状态",
  },
  "Ballot status unknown": {
    en: "Ballot status unknown",
    es: "Estado en la papeleta desconocido",
    zh: "选票状态未知",
  },
  "Complete ballot verified against official records": {
    en: "Complete ballot verified against official records",
    es: "Papeleta completa verificada con registros oficiales",
    zh: "已依据官方记录核实完整选票",
  },
  "Partial provider data · other contests or candidates may be missing": {
    en: "Partial provider data · other contests or candidates may be missing",
    es: "Datos parciales del proveedor · pueden faltar contiendas o candidaturas",
    zh: "提供方资料不完整；可能缺少其他选举项目或候选人",
  },
  "Statement guide · includes statement submitters, not a complete ballot": {
    en: "Statement guide · includes statement submitters, not a complete ballot",
    es: "Guía de declaraciones · incluye a quienes presentaron declaraciones; no es una papeleta completa",
    zh: "声明指南；仅收录提交声明者，并非完整选票",
  },
  "Coverage unknown · missing data does not mean no election or race exists": {
    en: "Coverage unknown · missing data does not mean no election or race exists",
    es: "Cobertura desconocida · la falta de datos no significa que no exista una elección o contienda",
    zh: "收录范围未知；缺少资料不表示没有选举或竞选",
  },
  "Sources disagree · confirm with your election office": {
    en: "Sources disagree · confirm with your election office",
    es: "Las fuentes discrepan · confirma con tu oficina electoral",
    zh: "来源说法不一致；请向选举办公室核实",
  },
  "Retrieval date unavailable": {
    en: "Retrieval date unavailable",
    es: "Fecha de consulta no disponible",
    zh: "暂无获取日期",
  },
  "Source retrieval is out of date · confirm with your election office": {
    en: "Source retrieval is out of date · confirm with your election office",
    es: "Consulta de la fuente desactualizada · confirma con tu oficina electoral",
    zh: "来源资料已过时；请向选举办公室核实",
  },
  "CANDIDATE'S OWN WORDS": {
    en: "CANDIDATE'S OWN WORDS",
    es: "PALABRAS DE LA CANDIDATURA",
    zh: "候选人原话",
  },
  FICTIONAL: { en: "FICTIONAL", es: "FICTICIO", zh: "虚构示例" },
  "U.S. Senator": {
    en: "U.S. Senator",
    es: "Senador de EE. UU.",
    zh: "美国参议员",
  },
  "U.S. Representative": {
    en: "U.S. Representative",
    es: "Representante de EE. UU.",
    zh: "美国众议员",
  },
  "California Assemblymember": {
    en: "California Assemblymember",
    es: "Miembro de la Asamblea de California",
    zh: "加利福尼亚州众议员",
  },
  Democratic: { en: "Democratic", es: "Demócrata", zh: "民主党" },
  Republican: { en: "Republican", es: "Republicano", zh: "共和党" },
  Independent: { en: "Independent", es: "Independiente", zh: "独立人士" },
  Libertarian: { en: "Libertarian", es: "Libertario", zh: "自由意志党" },
  "California State Senator": {
    en: "California State Senator",
    es: "Senador estatal de California",
    zh: "加利福尼亚州参议员",
  },
  "California State Representative": {
    en: "California State Representative",
    es: "Representante estatal de California",
    zh: "加利福尼亚州众议员",
  },
  "Massachusetts State Senator": {
    en: "Massachusetts State Senator",
    es: "Senador estatal de Massachusetts",
    zh: "马萨诸塞州参议员",
  },
  "Massachusetts State Representative": {
    en: "Massachusetts State Representative",
    es: "Representante estatal de Massachusetts",
    zh: "马萨诸塞州众议员",
  },
  "Missouri State Senator": {
    en: "Missouri State Senator",
    es: "Senador estatal de Misuri",
    zh: "密苏里州参议员",
  },
  "Missouri State Representative": {
    en: "Missouri State Representative",
    es: "Representante estatal de Misuri",
    zh: "密苏里州众议员",
  },
  "North Carolina State Senator": {
    en: "North Carolina State Senator",
    es: "Senador estatal de Carolina del Norte",
    zh: "北卡罗来纳州参议员",
  },
  "North Carolina State Representative": {
    en: "North Carolina State Representative",
    es: "Representante estatal de Carolina del Norte",
    zh: "北卡罗来纳州众议员",
  },
  "Texas State Senator": {
    en: "Texas State Senator",
    es: "Senador estatal de Texas",
    zh: "得克萨斯州参议员",
  },
  "Texas State Representative": {
    en: "Texas State Representative",
    es: "Representante estatal de Texas",
    zh: "得克萨斯州众议员",
  },
  "evidence.referenceCount": {
    en: { one: "{count} reference", other: "{count} references" },
    es: { one: "{count} referencia", other: "{count} referencias" },
    zh: { one: "{count} 条来源", other: "{count} 条来源" },
  },
  "Reload ballot to translate": {
    en: "Reload ballot to translate",
    es: "Volver a cargar la papeleta para traducir",
    zh: "重新加载选票以获取翻译",
  },
  Governor: { en: "Governor", es: "Gobernador", zh: "州长" },
  "Lieutenant Governor": {
    en: "Lieutenant Governor",
    es: "Vicegobernador",
    zh: "副州长",
  },
  "Secretary of State": {
    en: "Secretary of State",
    es: "Secretario de Estado",
    zh: "州务卿",
  },
  Controller: { en: "Controller", es: "Contralor", zh: "州主计长" },
  Treasurer: { en: "Treasurer", es: "Tesorero", zh: "州财政部长" },
  "Attorney General": {
    en: "Attorney General",
    es: "Fiscal general",
    zh: "州总检察长",
  },
  "Insurance Commissioner": {
    en: "Insurance Commissioner",
    es: "Comisionado de seguros",
    zh: "保险专员",
  },
  "Superintendent of Public Instruction": {
    en: "Superintendent of Public Instruction",
    es: "Superintendente de instrucción pública",
    zh: "公共教育总监",
  },
  "Democratic Party": {
    en: "Democratic Party",
    es: "Partido Demócrata",
    zh: "民主党",
  },
  "Republican Party": {
    en: "Republican Party",
    es: "Partido Republicano",
    zh: "共和党",
  },
  "No Party Preference": {
    en: "No Party Preference",
    es: "Sin preferencia partidista",
    zh: "无党派偏好",
  },
  Nonpartisan: { en: "Nonpartisan", es: "No partidista", zh: "无党派" },
  "Green Party": { en: "Green Party", es: "Partido Verde", zh: "绿党" },
  "Peace and Freedom Party": {
    en: "Peace and Freedom Party",
    es: "Partido Paz y Libertad",
    zh: "和平与自由党",
  },
  "session.regular": {
    en: "{years} regular session",
    es: "Sesión ordinaria {years}",
    zh: "{years} 年常会",
  },
  "session.texas89": {
    en: "89th Legislature · 2nd called session",
    es: "89.ª Legislatura · 2.ª sesión extraordinaria",
    zh: "第89届议会 · 第2次特别会议",
  },
  "California Legislature": {
    en: "California Legislature",
    es: "Legislatura de California",
    zh: "加利福尼亚州议会",
  },
} satisfies Catalog;
